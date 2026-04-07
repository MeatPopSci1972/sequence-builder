// @@STORE-START
// ═══════════════════════════════════════════════════════
//  SequenceForge — DiagramStore
//  Audience: Human + fresh AI instance
//
//  Pure JS module — zero DOM touches, zero external deps.
//  Usable in Node (tests) and in the browser (app).
//
//  Exports:
//    createStore()        — factory, returns a fresh store instance
//    nextMessageKind()    — pure helper, no store dependency
//    nextMessageDirection()— pure helper, no store dependency
//
//  Store instance shape:
// store.state          — { actors, messages, notes, fragments }
//    store.log            — full action log, every dispatched action
//    store.dispatch(action) — synchronous, stamps meta, mutates, emits
//    store.on(event, cb)  — subscribe to store events
//    store.off(event, cb) — unsubscribe
//
//  Action shape:
//    { type, payload, meta? }
//    meta defaults: { undoable: true, timestamp: Date.now() }
//    meta.undoable: false — logged but invisible to undo scanner
//
//  Undo contract:
//    - Snapshots taken before every undoable mutation
//    - UNDO pops the snapshot stack, restores state, emits state:restored
//    - UNDO itself is never logged (would create infinite regress)
//    - Non-undoable actions (meta.undoable: false) are logged but never
//      appear in the snapshot stack
//
//  One-way dependency rule:
//    store never touches uiState, never calls render()
//    All UI side effects are handled by listeners registered via store.on()
// ═══════════════════════════════════════════════════════

'use strict'

// ── Constants ────────────────────────────────────────────
const STORE_ACTOR_W = 110 // matches HTML app constant
const STORE_ACTOR_GAP = 60 // gap between actors
const STORE_UNDO_LIMIT = 50 // max snapshot stack depth

// ── ULID ──────────────────────────────────────────────────────────────────────
// Zero-dependency, time-sortable, 26-char unique ID.
// Alphabet: Crockford Base32 (no I, L, O, U — avoids visual ambiguity).
// Format: 10 timestamp chars + 16 random chars = 26 chars total.
// Compatible with Node 14+ and all modern browsers.
const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function ulid() {
  const t = Date.now()
  let ts = ''
  let tmp = t
  for (let i = 9; i >= 0; i--) {
    ts = ULID_CHARS[tmp % 32] + ts
    tmp = Math.floor(tmp / 32)
  }
  let rand = ''
  for (let i = 0; i < 16; i++) {
    rand += ULID_CHARS[Math.floor(Math.random() * 32)]
  }
  return ts + rand
}

// Typed ID generators — prefix makes element type readable in logs and history
function actorId() {
  return 'actor_' + ulid()
}
function messageId() {
  return 'msg_' + ulid()
}
function noteId() {
  return 'note_' + ulid()
}
function fragmentId() {
  return 'frag_' + ulid()
}

// ── Pure helpers (exported, no store dependency) ─────────

/**
 * Cycles message kind: sync → async → return → sync
 * Unknown input returns safe default 'sync'.
 */
function nextMessageKind(kind) {
  return { sync: 'async', async: 'return', return: 'sync' }[kind] || 'sync'
}

/**
 * Cycles message direction: right → left → both → right
 * Unknown input returns safe default 'right'.
 */
function nextMessageDirection(dir) {
  return { right: 'left', left: 'both', both: 'right' }[dir] || 'right'
}

// ── Store factory ────────────────────────────────────────

/**
 * Creates and returns a fresh, independent store instance.
 * Each call returns a completely isolated store — no shared state.
 * This is what the test harness calls per test.
 */
function createStore() {
  // ── Internal state ──────────────────────────────────────
  // Diagram data — the narrow record. Serializable, persistable.
  const state = {
    actors: [],
    messages: [],
    notes: [],
    fragments: []
  }

  // Full action log — every dispatched action, in order.
  // Undo scanner reads this; debug tools read this; export reads this.
  const log = []

  // Snapshot stack for undo.
  // Each entry is a deep-clone of state at the moment before a
  // undoable mutation. Capped at STORE_UNDO_LIMIT entries.
  const _snapshots = []

  // Redo stack — captures the state displaced by each UNDO.
  // Cleared on any new undoable mutation (branching history invalidates forward stack).
  // Capped at STORE_UNDO_LIMIT entries.
  const _redoStack = []

  // Event listeners: { [eventName]: Set<fn> }
  const _listeners = {}

  // ── Private utilities ───────────────────────────────────

  /**
   * Returns the x position for the next actor.
   * First actor lands at x:40. Each subsequent actor is placed
   * STORE_ACTOR_W + STORE_ACTOR_GAP to the right of the rightmost existing actor.
   */
  function getNextActorX() {
    if (!state.actors.length) return 40
    const maxX = Math.max(...state.actors.map(a => a.x))
    return maxX + STORE_ACTOR_W + STORE_ACTOR_GAP
  }

  /** Deep-clones diagram data only — not log, not snapshots. */
  function snapshot() {
    return JSON.parse(
      JSON.stringify({
        actors: state.actors,
        messages: state.messages,
        notes: state.notes,
        fragments: state.fragments
      })
    )
  }

  /** Restores state from a snapshot object. Mutates state in place. */
  function restoreSnapshot(snap) {
    state.actors = snap.actors
    state.messages = snap.messages
    state.notes = snap.notes
    state.fragments = snap.fragments
  }

  /**
   * Pushes a snapshot onto the undo stack before a mutation.
   * Must be called BEFORE the mutation, never after.
   * Enforces STORE_UNDO_LIMIT by dropping the oldest entry.
   * Clears _redoStack — any new undoable mutation invalidates the forward history.
   */
  function pushSnapshot() {
    _snapshots.push(snapshot())
    if (_snapshots.length > STORE_UNDO_LIMIT) _snapshots.shift()
    _redoStack.length = 0 // new branch — forward history is gone
  }

  // ── Event emitter ───────────────────────────────────────

  /** Subscribe to a store event. Returns unsubscribe fn. */
  function on(event, cb) {
    if (!_listeners[event]) _listeners[event] = new Set()
    _listeners[event].add(cb)
    return () => off(event, cb)
  }

  /** Unsubscribe from a store event. */
  function off(event, cb) {
    _listeners[event]?.delete(cb)
  }

  /** Emit a store event synchronously. All listeners fire before emit returns. */
  function emit(event, payload) {
    _listeners[event]?.forEach(cb => cb(payload))
  }

  // ── Action handlers ─────────────────────────────────────
  // Each handler receives the stamped action { type, payload, meta }.
  // Handlers are responsible for:
  //   1. Calling pushSnapshot() before any undoable mutation
  //   2. Mutating state
  //   3. Emitting the appropriate event(s)
  // Handlers never touch uiState, never call render().

  const handlers = {
    // ── Actors ──────────────────────────────────────────

    ADD_ACTOR({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const actor = {
        id: actorId(),
        x: payload.x ?? getNextActorX(),
        label: (() => {
          const base = payload.label || 'Actor'
          const taken = new Set(state.actors.map(a => a.label))
          if (!taken.has(base)) return base
          let n = 2
          while (taken.has(base + '_' + n)) n++
          return base + '_' + n
        })(),
        type: payload.type || 'actor-system',
        ...(payload.emoji !== undefined ? { emoji: payload.emoji } : {}),
        schema: Array.isArray(payload.schema) ? payload.schema : [],
        properties:
          payload.properties && typeof payload.properties === 'object' ? payload.properties : {}
      }
      state.actors.push(actor)
      emit('actor:added', actor)
    },

    MOVE_ACTOR({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const actor = getActorById(payload.id)
      if (!actor) return
      actor.x = payload.x
      emit('actor:moved', actor)
    },

    REFLOW_ACTORS({ payload, meta }) {
      // payload.positions: [{ id, x }, ...]
      // One snapshot covers the entire reflow — one Ctrl+Z undoes all moves.
      if (meta.undoable) pushSnapshot()
      for (const { id, x } of payload.positions) {
        const actor = getActorById(id)
        if (actor) actor.x = x
      }
      emit('actors:reflowed', state.actors)
    },

    UPDATE_ACTOR({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const actor = getActorById(payload.id)
      if (!actor) return
      // Partial patch — only provided fields are updated
      if (payload.label !== undefined) actor.label = payload.label
      if (payload.type !== undefined) actor.type = payload.type
      if (payload.emoji !== undefined) actor.emoji = payload.emoji
      if (payload.x !== undefined) actor.x = payload.x
      if (Array.isArray(payload.schema)) actor.schema = payload.schema
      if (payload.properties && typeof payload.properties === 'object') {
        actor.properties = Object.assign({}, actor.properties || {}, payload.properties)
      }
      emit('actor:updated', actor)
    },

    DELETE_ACTOR({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const id = payload.id
      // Collect orphaned message ids before filtering
      const orphanedIds = state.messages
        .filter(m => m.fromId === id || m.toId === id)
        .map(m => m.id)
      // Cascade: remove actor and all its messages
      state.actors = getActorsExcept(id)
      state.messages = state.messages.filter(m => m.fromId !== id && m.toId !== id)
      emit('actor:deleted', id)
      if (orphanedIds.length) emit('messages:orphaned', orphanedIds)
    },

    // ── Messages ─────────────────────────────────────────

    ADD_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const message = {
        id: messageId(),
        fromId: payload.fromId ?? null,
        toId: payload.toId ?? null,
        label: payload.label || 'message',
        kind: payload.kind || 'sync',
        direction: payload.direction || 'right',
        y: 0, // render pipeline assigns real y
        // Network fields — only stored if provided
        ...(payload.protocol ? { protocol: payload.protocol } : {}),
        ...(payload.port ? { port: payload.port } : {}),
        ...(payload.auth ? { auth: payload.auth } : {}),
        ...(payload.dataClass ? { dataClass: payload.dataClass } : {}),
        schema: Array.isArray(payload.schema) ? payload.schema : [],
        properties:
          payload.properties && typeof payload.properties === 'object' ? payload.properties : {}
      }
      state.messages.push(message)
      emit('message:added', message)
    },

    MOVE_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const message = getMessageById(payload.id)
      if (!message) return
      message.y = payload.y
      emit('message:moved', message)
    },

    UPDATE_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const message = getMessageById(payload.id)
      if (!message) return
      // Partial patch — only provided fields are updated
      const fields = [
        'label',
        'fromId',
        'toId',
        'kind',
        'direction',
        'protocol',
        'port',
        'auth',
        'dataClass'
      ]
      for (const field of fields) {
        if (payload[field] !== undefined) message[field] = payload[field]
      }
      if (Array.isArray(payload.schema)) message.schema = payload.schema
      if (payload.properties && typeof payload.properties === 'object') {
        message.properties = Object.assign({}, message.properties || {}, payload.properties)
      }
      emit('message:updated', message)
    },

    DELETE_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      state.messages = getMessagesExcept(payload.id)
      emit('message:deleted', payload.id)
    },

    // ── Notes ─────────────────────────────────────────────

    ADD_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const note = {
        id: noteId(),
        x: payload.x ?? 60,
        y: payload.y ?? 200,
        text: payload.text || 'note'
      }
      state.notes.push(note)
      emit('note:added', note)
    },

    MOVE_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const note = getNoteById(payload.id)
      if (!note) return
      note.x = payload.x
      note.y = payload.y
      emit('note:moved', note)
    },

    UPDATE_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const note = getNoteById(payload.id)
      if (!note) return
      if (payload.text !== undefined) note.text = payload.text
      emit('note:updated', note)
    },

    DELETE_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      state.notes = getNotesExcept(payload.id)
      emit('note:deleted', payload.id)
    },

    // ── Fragments ─────────────────────────────────────────

    ADD_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = {
        id: fragmentId(),
        x: payload.x ?? 60,
        y: payload.y ?? 200,
        w: payload.w ?? 200,
        h: payload.h ?? 100,
        kind: payload.kind || 'frag-alt',
        cond: payload.cond || 'condition'
      }
      state.fragments.push(fragment)
      emit('fragment:added', fragment)
    },

    MOVE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = getFragmentById(payload.id)
      if (!fragment) return
      fragment.x = payload.x
      fragment.y = payload.y
      emit('fragment:moved', fragment)
    },

    RESIZE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = getFragmentById(payload.id)
      if (!fragment) return
      fragment.w = payload.w
      fragment.h = payload.h
      emit('fragment:resized', fragment)
    },

    UPDATE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = getFragmentById(payload.id)
      if (!fragment) return
      if (payload.kind !== undefined) fragment.kind = payload.kind
      if (payload.cond !== undefined) fragment.cond = payload.cond
      emit('fragment:updated', fragment)
    },

    DELETE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      state.fragments = getFragmentsExcept(payload.id)
      emit('fragment:deleted', payload.id)
    },

    // ── History ───────────────────────────────────────────

    UNDO() {
      // UNDO is never logged — handled before log.push() in dispatch()
      if (!_snapshots.length) return
      // Capture current state onto redo stack before restoring
      _redoStack.push(snapshot())
      if (_redoStack.length > STORE_UNDO_LIMIT) _redoStack.shift()
      const snap = _snapshots.pop()
      restoreSnapshot(snap)
      emit('state:restored', { ...snapshot(), direction: 'undo' })
    },

    REDO() {
      // REDO is never logged
      if (!_redoStack.length) return
      // Capture current state onto undo stack so the redo itself is undoable
      _snapshots.push(snapshot())
      if (_snapshots.length > STORE_UNDO_LIMIT) _snapshots.shift()
      const snap = _redoStack.pop()
      restoreSnapshot(snap)
      emit('state:restored', { ...snapshot(), direction: 'redo' })
    },

    // ── Bulk / Session ────────────────────────────────────

    CLEAR_DIAGRAM({ meta }) {
      if (meta.undoable) pushSnapshot()
      state.actors = []
      state.messages = []
      state.notes = []
      state.fragments = []
      emit('diagram:cleared')
    },

    LOAD_DIAGRAM({ payload }) {
      // LOAD_DIAGRAM clears both stacks — new baseline.
      // Always non-undoable (callers should not pass meta.undoable: true).
      // payload._source — optional caller hint: 'localStorage' | 'import' | undefined
      // The store strips _source before it reaches state; it is only forwarded in the event.
      _snapshots.length = 0
      _redoStack.length = 0
      state.actors = payload.actors || []
      state.messages = payload.messages || []
      state.notes = payload.notes || []
      state.fragments = payload.fragments || []
      emit('diagram:loaded', { ...snapshot(), source: payload._source || 'import' })
    },

    // ── DEMOS ── <<STORE_DEMOS_START>>
    // Named demo diagrams — add entries here to populate the Demo dropdown.
    // loadDemo(id?) dispatches LOAD_DEMO with the matching entry.
    // No id = first entry (index 0). Exposed as window.SF_DEMOS for canary.
    LOAD_DEMO({ payload: { id } = {} } = {}) {
      const DEMOS = [
        // ── Demo 0: Auth Flow ─────────────────────────────────────────────
        {
          id: 'auth-flow',
          label: 'Auth Flow',
          build(tid) {
            const user = { id: tid(), x: 40, label: 'User', type: 'actor-person' }
            const api = { id: tid(), x: 210, label: 'API Gateway', type: 'actor-system' }
            const auth = { id: tid(), x: 380, label: 'Auth Service', type: 'actor-system' }
            const db = { id: tid(), x: 550, label: 'Database', type: 'actor-db' }
            return {
              actors: [user, api, auth, db],
              messages: [
                {
                  id: tid(),
                  fromId: user.id,
                  toId: api.id,
                  label: 'POST /login',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: api.id,
                  toId: auth.id,
                  label: 'validateCredentials',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: auth.id,
                  toId: db.id,
                  label: 'SELECT user WHERE…',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: db.id,
                  toId: auth.id,
                  label: 'user record',
                  kind: 'return',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: auth.id,
                  toId: api.id,
                  label: 'JWT token',
                  kind: 'return',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: api.id,
                  toId: user.id,
                  label: '200 OK + token',
                  kind: 'return',
                  direction: 'right',
                  y: 0
                }
              ],
              fragments: [
                {
                  id: tid(),
                  x: 160,
                  y: 170,
                  w: 340,
                  h: 175,
                  kind: 'frag-alt',
                  cond: 'valid credentials'
                }
              ],
              notes: [{ id: tid(), x: 20, y: 0, text: 'Auth flow' }]
            }
          }
        },
        // ── Demo 1: SCADA Control Flow ────────────────────────────────────
        {
          id: 'scada-control',
          label: 'SCADA: Control Flow',
          build(tid) {
            const hmi = { id: tid(), x: 40, label: 'HMI', type: 'actor-person' }
            const plc = { id: tid(), x: 210, label: 'PLC', type: 'actor-system' }
            const rtu = { id: tid(), x: 380, label: 'RTU', type: 'actor-system' }
            const hist = { id: tid(), x: 550, label: 'Historian', type: 'actor-db' }
            return {
              actors: [hmi, plc, rtu, hist],
              messages: [
                {
                  id: tid(),
                  fromId: hmi.id,
                  toId: plc.id,
                  label: 'Poll cycle (1 s)',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: plc.id,
                  toId: rtu.id,
                  label: 'Read registers',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: rtu.id,
                  toId: plc.id,
                  label: 'Field telemetry',
                  kind: 'return',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: plc.id,
                  toId: rtu.id,
                  label: 'Setpoint command',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: rtu.id,
                  toId: plc.id,
                  label: 'Acknowledge',
                  kind: 'return',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: plc.id,
                  toId: hist.id,
                  label: 'Log values',
                  kind: 'async',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: plc.id,
                  toId: hmi.id,
                  label: 'Status update',
                  kind: 'return',
                  direction: 'right',
                  y: 0
                }
              ],
              fragments: [
                {
                  id: tid(),
                  x: 160,
                  y: 185,
                  w: 340,
                  h: 140,
                  kind: 'frag-loop',
                  cond: 'scan active'
                }
              ],
              notes: [{ id: tid(), x: 20, y: 0, text: 'SCADA control loop' }]
            }
          }
        },
        // ── Demo 2: CyberSecurity Zone Analysis ───────────────────────────
        {
          id: 'cybersec-zones',
          label: 'CyberSecurity: Zone Analysis',
          build(tid) {
            const corp = { id: tid(), x: 40, label: 'Corporate LAN', type: 'actor-system' }
            const fw = { id: tid(), x: 200, label: 'Firewall', type: 'actor-system' }
            const jump = { id: tid(), x: 360, label: 'Jump Server', type: 'actor-system' }
            const ot = { id: tid(), x: 520, label: 'OT Network', type: 'actor-system' }
            const hist = { id: tid(), x: 680, label: 'Historian', type: 'actor-db' }
            return {
              actors: [corp, fw, jump, ot, hist],
              messages: [
                {
                  id: tid(),
                  fromId: corp.id,
                  toId: fw.id,
                  label: 'Remote access request',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: fw.id,
                  toId: jump.id,
                  label: 'Allow (port 3389)',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: jump.id,
                  toId: ot.id,
                  label: 'Authenticated session',
                  kind: 'sync',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: ot.id,
                  toId: hist.id,
                  label: 'Process data write',
                  kind: 'async',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: hist.id,
                  toId: corp.id,
                  label: 'Replication (no DPI)',
                  kind: 'async',
                  direction: 'right',
                  y: 0
                },
                {
                  id: tid(),
                  fromId: ot.id,
                  toId: fw.id,
                  label: 'Audit log egress',
                  kind: 'async',
                  direction: 'right',
                  y: 0
                }
              ],
              fragments: [
                {
                  id: tid(),
                  x: 330,
                  y: 80,
                  w: 390,
                  h: 230,
                  kind: 'frag-alt',
                  cond: 'Purdue L3 / L2 boundary'
                }
              ],
              notes: [
                {
                  id: tid(),
                  x: 20,
                  y: 0,
                  text: 'Unmonitored replication path — no DPI at historian egress'
                }
              ]
            }
          }
        }
      ]
      // <<STORE_DEMOS_END>>

      _snapshots.length = 0
      _redoStack.length = 0

      const demo = DEMOS.find(d => d.id === id) || DEMOS[0]
      // tid uses raw ulid() — demos predate typed generators, build() is type-agnostic
      const tid = () => ulid()

      const built = demo.build(tid)
      state.actors = built.actors
      state.messages = built.messages
      state.fragments = built.fragments || []
      state.notes = built.notes || []

      // Expose demo list for canary + dropdown rendering
      if (typeof window !== 'undefined') {
        window.SF_DEMOS = DEMOS.map(d => ({ id: d.id, label: d.label }))
      }

      emit('diagram:loaded', {
        ...snapshot(),
        source: 'demo',
        demoId: demo.id,
        demoLabel: demo.label
      })
    }
  }

  // ── dispatch ─────────────────────────────────────────────
  /**
   * The single entry point for all state mutations.
   *
   * Responsibilities:
   *   1. Stamp meta (timestamp, undoable default)
   *   2. Log the action (except UNDO / REDO which must not be logged)
   *   3. Invoke the handler
   *
   * Synchronous — everything completes before dispatch() returns.
   * Callers can read store.state immediately after dispatch().
   */
  function dispatch(action) {
    const { type, payload = {}, meta: rawMeta = {} } = action

    // Stamp meta — callers provide undoable: false to opt out of undo
    const meta = {
      undoable: rawMeta.undoable !== false, // default true
      timestamp: Date.now(),
      // affectedId — the element ULID this action targets, for readable history
      // Extracted from payload.id when present; undefined for bulk/session actions
      affectedId: payload.id || undefined,
      ...rawMeta
    }

    // UNDO and REDO are never logged — they operate on the log itself
    const skipLog = type === 'UNDO' || type === 'REDO'
    if (!skipLog) {
      log.push({ type, payload, meta })
    }

    const handler = handlers[type]
    if (!handler) {
      console.warn(`[store] Unknown action type: ${type}`)
      return
    }

    try {
      handler({ type, payload, meta })
    } catch (err) {
      // Roll back the log entry — a failed handler must not leave a phantom entry.
      // The snapshot (if any) is still on the stack; undo remains consistent.
      if (!skipLog) log.pop()
      console.error(`[store] Handler for ${type} threw — log entry removed.`, err)
    }
  }

  // ── Public interface ─────────────────────────────────────
  // Expose demo list at startup — dropdown populates before first LOAD_DEMO
  if (typeof window !== 'undefined') {
    window.SF_DEMOS = [
      { id: 'auth-flow', label: 'Auth Flow' },
      { id: 'scada-control', label: 'SCADA: Control Flow' },
      { id: 'cybersec-zones', label: 'CyberSecurity: Zone Analysis' }
    ]
  }
  function getActorById(id) {
    return state.actors.find(a => a.id === id)
  }
  function getMessageById(id) {
    return state.messages.find(m => m.id === id)
  }
  function getNoteById(id) {
    return state.notes.find(n => n.id === id)
  }
  function getFragmentById(id) {
    return state.fragments.find(f => f.id === id)
  }
  function getActorsExcept(id) {
    return state.actors.filter(a => a.id !== id)
  }
  function getMessagesExcept(id) {
    return state.messages.filter(m => m.id !== id)
  }
  function getNotesExcept(id) {
    return state.notes.filter(n => n.id !== id)
  }
  function getFragmentsExcept(id) {
    return state.fragments.filter(f => f.id !== id)
  }
  return {
    state, // live reference — mutations are visible immediately
    log, // full action log — live reference
    dispatch,
    on,
    off,
    get canUndo() {
      return _snapshots.length > 0
    }, // true when undo stack is non-empty
    get canRedo() {
      return _redoStack.length > 0
    }, // true when redo stack is non-empty
    getActorById,
    getMessageById,
    getNoteById,
    getFragmentById,
    getActorsExcept,
    getMessagesExcept,
    getNotesExcept,
    getFragmentsExcept,
    getNextActorX
  }
}
// @@STORE-END

// ── Single app-level store instance ──
const _store = createStore()
const store  = _store   // alias — some call sites use bare 'store'
const getNextActorX = () => store.getNextActorX(); // window-scope alias

// ── Convenience proxies so the rest of the app reads store.state cleanly ──
// All render/interaction code reads from these — they are live references.
const state = _store.state    // diagram data  — narrow, persistable

// ── uiState — explicit, separate, never persisted ──
const uiState = {
  selected:       null,   // { ...obj, _type, _ref, _preview? }
  mode:           'select',
  connectFrom:    null,
  format:         'plantuml',
  panX:           0,      // canvas pan offset (pixels, pre-zoom)
  panY:           0,      //
}

// ── History button sync — reflects actual stack depths ──
function updateHistoryBtns() {
  const u = document.getElementById('btn-undo')
  const r = document.getElementById('btn-redo')
  if (u) u.disabled = !_store.canUndo
  if (r) r.disabled = !_store.canRedo
}
// Alias — called from many existing sites; all redirect to updateHistoryBtns
function updateUndoBtn() { updateHistoryBtns() }

// ── requestRender — rAF-batched render for high-frequency events (drag, 60fps) ──
// Deduplicates: multiple calls within one frame collapse to a single render().
// Low-frequency mutations (add, delete, undo) call render() directly — no need to batch.
let _rafPending = false;
function requestRender() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; render(); });
}

// ── Store event listeners — UI side effects only, no store mutations ──
// Move events use requestRender (high-frequency during drag).
// All other events call render() directly (low-frequency, immediate feedback expected).
_store.on('actor:added',      actor   => { setSelected(actor, 'actor'); activateTab('tab-props'); updateUndoBtn(); render() })
_store.on('actor:moved',      ()      => { requestRender() })
_store.on('actors:reflowed',  ()      => { render() })
_store.on('actor:updated',    ()      => { render() })
_store.on('actor:deleted', id => { if (state.actors.length === 0) { applyPan(0,0); applyZoom(1.0); } });
store.on('actor:deleted',    id      => { if (uiState.selected?.id === id) uiState.selected = null; updateUndoBtn(); render() })
_store.on('messages:orphaned',ids     => { if (ids.includes(uiState.selected?.id)) uiState.selected = null })
_store.on('message:added',    message => { setSelected(message, 'message'); activateTab('tab-props'); updateUndoBtn(); render() })
_store.on('message:moved',    ()      => { requestRender() })
_store.on('message:updated',  ()      => { render() })
_store.on('message:deleted',  id      => { if (uiState.selected?.id === id) uiState.selected = null; updateUndoBtn(); render() })
_store.on('note:added',       note    => { setSelected(note, 'note'); activateTab('tab-props'); updateUndoBtn(); render() })
_store.on('note:moved',       ()      => { requestRender() })
_store.on('note:updated',     ()      => { render() })
_store.on('note:deleted',     id      => { if (uiState.selected?.id === id) uiState.selected = null; updateUndoBtn(); render() })
_store.on('fragment:added',   frag    => { setSelected(frag, 'fragment'); activateTab('tab-props'); updateUndoBtn(); render() })
_store.on('fragment:moved',   ()      => { requestRender() })
_store.on('fragment:resized', ()      => { requestRender() })
_store.on('fragment:updated', ()      => { render() })
_store.on('fragment:deleted', id      => { if (uiState.selected?.id === id) uiState.selected = null; updateUndoBtn(); render() })
_store.on('diagram:cleared',  ()      => { uiState.selected = null; updateUndoBtn(); applyPan(0,0); applyZoom(1.0); render(); toast('Cleared — Ctrl+Z to undo') })
_store.on('diagram:loaded',   p       => { uiState.selected = null; updateUndoBtn(); render();
  if      (p?.source === 'demo')        toast('Demo loaded — try the Output tab!')
  else if (p?.source === 'import')      toast('Diagram imported ✓')
  else if (p?.source === 'localStorage') { /* silent restore on boot */ }
  else                                  toast('Diagram loaded ✓')
  if (state_settings.autoFitOnLoad) requestAnimationFrame(fitToZoom);
})
_store.on('state:restored',   p       => { uiState.selected = null; updateHistoryBtns(); render() })

// ── Persist + output refresh ─────────────────────────────────────────────────
// _saveDiagram() and updateOutput() were moved out of render() so render() is
// a pure DOM projection. They fire here on every state-mutating event instead.
const _PERSIST_EVENTS = [
  'actor:added','actor:moved','actors:reflowed','actor:updated','actor:deleted',
  'message:added','message:moved','message:updated','message:deleted',
  'note:added','note:moved','note:updated','note:deleted',
  'fragment:added','fragment:moved','fragment:resized','fragment:updated','fragment:deleted',
  'diagram:cleared','diagram:loaded','state:restored'
];
_PERSIST_EVENTS.forEach(ev => _store.on(ev, () => { _saveDiagram(); updateOutput(); }));

// ── Wrap a live store object into a uiState.selected shape ──
// _ref is frozen for real store objects so direct writes throw immediately
// rather than silently corrupting undo history. Preview scratch objects
// (_preview: true) are intentionally writable — the palette form harvests
// values from them before dispatch.
function _wrapSelected(obj, type) {
  if (!obj) return null
  // Freeze a COPY for _ref — not obj itself.
  // obj is a live store object; freezing it in place silently blocks subsequent
  // UPDATE_* dispatches in non-strict script context (frozen property write is a
  // silent no-op, not a throw). The copy gives _ref read-only enforcement without
  // poisoning the store object that dispatch must still mutate.
  const ref = obj._preview ? obj : Object.freeze({ ...obj })
  return { ...obj, _type: type, _ref: ref }
}

// ── Last-added actor helper ──
// ── Undo / Redo dispatchers — called by buttons and keyboard shortcuts ──
function undo() {
  if (!_store.canUndo) { toast('Nothing to undo'); return; }
  _store.dispatch({ type: 'UNDO' });
  const redoable = _store.canRedo ? ' (Ctrl+Y to redo)' : '';
  toast('Undo ✓' + redoable);
  dbg('undo', `canUndo=${_store.canUndo} canRedo=${_store.canRedo}`);
}

function redo() {
  if (!_store.canRedo) { toast('Nothing to redo'); return; }
  _store.dispatch({ type: 'REDO' });
  toast('Redo ✓');
  dbg('redo', `canUndo=${_store.canUndo} canRedo=${_store.canRedo}`);
}

// ═══════════════════════════════════════════════════════
//  ADAPTER PATTERN  (polymorphic serializers)
// ═══════════════════════════════════════════════════════
class DiagramAdapter {
  serialize(actors, messages, notes, fragments) { throw new Error('abstract'); }
  get name() { return 'base'; }
}

class PlantUMLAdapter extends DiagramAdapter {
  get name() { return 'plantuml'; }

  _escape(s) { return (s||'unnamed').replace(/"/g, '\\"'); }
  _actorKeyword(type) {
    return { 'actor-person':'actor', 'actor-system':'participant',
             'actor-db':'database', 'actor-queue':'queue' }[type] || 'participant';
  }

  serialize(actors, messages, notes, fragments) {
    const lines = [];
    lines.push('@startuml');
    lines.push('skinparam backgroundColor #0d0f14');
    lines.push('skinparam sequenceArrowThickness 1.5');
    lines.push('skinparam roundcorner 6');
    lines.push('');

    // Actors (ordered by x position)
    const sorted = [...actors].sort((a,b)=>a.x-b.x);
    for (const a of sorted) {
      lines.push(`${this._actorKeyword(a.type)} "${this._escape(a.label)}" as ${a.id}`);
    }
    if (sorted.length) lines.push('');

    // Fragments (open)
    const openFrags = {};
    for (const f of fragments) openFrags[f.id] = f;

    // Messages sorted by y
    const sortedMsgs = [...messages].sort((a,b)=>a.y-b.y);
    // notes sorted by y
    const notesSorted = [...notes].sort((a,b)=>a.y-b.y);

    // Interleave messages and notes by y
    const items = [
      ...sortedMsgs.map(m => ({...m, _kind:'msg'})),
      ...notesSorted.map(n => ({...n, _kind:'note'})),
    ].sort((a,b) => (a.y||0) - (b.y||0));

    // Fragment open/close markers
    for (const f of fragments) {
      const cond = f.cond || 'condition';
      items.push({ y: f.y, _kind:'frag-open', f });
      items.push({ y: f.y + f.h, _kind:'frag-close', f });
    }
    items.sort((a,b) => (a.y||0) - (b.y||0));

    for (const item of items) {
      if (item._kind === 'msg') {
        const m = item;
        const from = actors.find(a=>a.id===m.fromId);
        const to   = actors.find(a=>a.id===m.toId);
        if (!from||!to) continue;
        const lbl = this._escape(m.label || 'message');
        const fid = from.id, tid = to.id;
        const dir = m.direction || 'right';
        if (dir === 'both') {
          // PlantUML bidirectional: emit both directions
          if (m.kind === 'sync')   { lines.push(`${fid} -> ${tid} : ${lbl}`); lines.push(`${tid} -> ${fid} : ${lbl}`); }
          if (m.kind === 'async')  { lines.push(`${fid} ->> ${tid} : ${lbl}`); lines.push(`${tid} ->> ${fid} : ${lbl}`); }
          if (m.kind === 'return') { lines.push(`${fid} --> ${tid} : ${lbl}`); lines.push(`${tid} --> ${fid} : ${lbl}`); }
        } else {
          const [src, tgt] = dir === 'left' ? [tid, fid] : [fid, tid];
          if (m.kind === 'sync')   lines.push(`${src} -> ${tgt} : ${lbl}`);
          if (m.kind === 'async')  lines.push(`${src} ->> ${tgt} : ${lbl}`);
          if (m.kind === 'return') lines.push(`${src} --> ${tgt} : ${lbl}`);
        }
        // Network details as PlantUML note
        const netNote = [m.protocol, m.port ? ':'+m.port : '', m.auth, m.dataClass].filter(Boolean).join(' | ');
        if (netNote) lines.push(`note right #1c2030 : ${netNote}`);
      } else if (item._kind === 'note') {
        lines.push(`note right : ${item.text||'note'}`);
      } else if (item._kind === 'frag-open') {
        const kw = item.f.kind.replace('frag-','');
        lines.push(`${kw} [${item.f.cond||'condition'}]`);
      } else if (item._kind === 'frag-close') {
        lines.push('end');
      }
    }

    lines.push('');
    lines.push('@enduml');
    return lines.join('\n');
  }
}

class MermaidAdapter extends DiagramAdapter {
  get name() { return 'mermaid'; }

  _safe(s) {
    return (s||'unnamed').replace(/[^a-zA-Z0-9_\s]/g,'').replace(/\s+/g,'_');
  }

  serialize(actors, messages, notes, fragments) {
    const lines = [];
    lines.push('sequenceDiagram');

    const sorted = [...actors].sort((a,b)=>a.x-b.x);
    for (const a of sorted) {
      const kw = (a.type==='actor-person') ? 'actor' : 'participant';
      lines.push(`  ${kw} ${this._safe(a.label)} as ${this._safe(a.label)}`);
    }
    if (sorted.length) lines.push('');

    const items = [
      ...messages.map(m=>({...m,_kind:'msg'})),
      ...notes.map(n=>({...n,_kind:'note'})),
      ...fragments.flatMap(f=>[
        {y:f.y,_kind:'frag-open',f},
        {y:f.y+f.h,_kind:'frag-close',f}
      ])
    ].sort((a,b)=>(a.y||0)-(b.y||0));

    for (const item of items) {
      if (item._kind==='msg') {
        const m = item;
        const from = actors.find(a=>a.id===m.fromId);
        const to   = actors.find(a=>a.id===m.toId);
        if (!from||!to) continue;
        const fs = this._safe(from.label), ts = this._safe(to.label);
        const lbl = m.label||'message';
        const dir = m.direction || 'right';
        if (dir === 'both') {
          if (m.kind==='sync')   { lines.push(`  ${fs}->>${ts}: ${lbl}`); lines.push(`  ${ts}->>${fs}: ${lbl}`); }
          if (m.kind==='async')  { lines.push(`  ${fs}->>${ts}: ${lbl}`); lines.push(`  ${ts}->>${fs}: ${lbl}`); }
          if (m.kind==='return') { lines.push(`  ${ts}-->>${fs}: ${lbl}`); lines.push(`  ${fs}-->>${ts}: ${lbl}`); }
        } else {
          const [src, tgt] = dir === 'left' ? [ts, fs] : [fs, ts];
          if (m.kind==='sync')   lines.push(`  ${src}->>${tgt}: ${lbl}`);
          if (m.kind==='async')  lines.push(`  ${src}->>${tgt}: ${lbl}`);
          if (m.kind==='return') lines.push(`  ${tgt}-->>${src}: ${lbl}`);
        }
        // Network details as Mermaid note
        const netNote = [m.protocol, m.port ? ':'+m.port : '', m.auth, m.dataClass].filter(Boolean).join(' | ');
        if (netNote) lines.push(`  Note right of ${fs}: ${netNote}`);
      } else if (item._kind==='note') {
        const closest = actors[0];
        if (closest) lines.push(`  Note right of ${this._safe(closest.label)}: ${item.text||'note'}`);
      } else if (item._kind==='frag-open') {
        const kw = item.f.kind.replace('frag-','');
        if (kw==='alt') { lines.push(`  alt ${item.f.cond||'condition'}`); }
        else if (kw==='loop') { lines.push(`  loop ${item.f.cond||'condition'}`); }
        else if (kw==='opt')  { lines.push(`  opt ${item.f.cond||'condition'}`); }
      } else if (item._kind==='frag-close') {
        lines.push('  end');
      }
    }
    return lines.join('\n');
  }
}

// Adapter registry (Adapter pattern)
const adapters = {
  plantuml: new PlantUMLAdapter(),
  mermaid:  new MermaidAdapter(),
};

function getAdapter() { return adapters[uiState.format]; }
function serialize()  {
  return getAdapter().serialize(state.actors, state.messages, state.notes, state.fragments);
}

// ═══════════════════════════════════════════════════════
//  MOCK OLLAMA API  (intercepts localhost:11434)
// ═══════════════════════════════════════════════════════

async function mockOllamaHandler(url, opts) {
  await delay(400 + Math.random()*600);

  let body = {};
  try { body = JSON.parse(opts?.body || '{}'); } catch(e){}

  const diagram = body.prompt || '';
  const model   = body.model  || 'llama3.2';

  // Simulate an intelligent mock response
  const actors  = state.actors.map(a=>a.label).join(', ');
  const msgCount = state.messages.length;
  const format   = uiState.format.toUpperCase();

  const mockText = [
    `**Model:** ${model}  **Format:** ${format}`,
    '',
    `I've analyzed the sequence diagram containing ${state.actors.length} participants (${actors||'none yet'}) and ${msgCount} message${msgCount!==1?'s':''}.`,
    '',
    '**Observations:**',
    state.actors.length < 2
      ? '• Consider adding more participants to model realistic interactions.'
      : `• The flow between ${actors} follows a clear request-response pattern.`,
    msgCount === 0
      ? '• No messages defined yet — add arrows between participants.'
      : `• ${msgCount} message(s) detected. Check for missing error-handling paths.`,
    '',
    '**Suggestions:**',
    '• Add alt/opt fragments to model conditional branches.',
    '• Consider adding return messages to show responses explicitly.',
    '• Use notes to document business rules or constraints inline.',
    '',
    `**Generated ${format} snippet received** (${diagram.length} chars)`,
    `Processed at: ${new Date().toISOString()}`,
  ].join('\n');

  // Simulate Ollama streaming response format
  const responseBody = {
    model: model,
    created_at: new Date().toISOString(),
    message: { role: 'assistant', content: mockText },
    done: true,
    done_reason: 'stop',
    total_duration: Math.floor(Math.random() * 2000000000),
    load_duration:  Math.floor(Math.random() * 500000000),
    prompt_eval_count: diagram.split(' ').length,
    eval_count: mockText.split(' ').length,
  };

  return {
    ok: true, status: 200,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════
//  RENDERING
// ═══════════════════════════════════════════════════════
const svg = document.getElementById('canvas');
const actorsLayer    = document.getElementById('actors-layer');
const lifelinesLayer = document.getElementById('lifelines-layer');
const messagesLayer  = document.getElementById('messages-layer');
const notesLayer     = document.getElementById('notes-layer');
const fragmentsLayer    = document.getElementById('fragments-layer');
  const interactionLayer = document.getElementById('interaction-layer');
const editLayer        = document.getElementById('edit-layer');
const emptyHint      = document.getElementById('empty-hint');

const ACTOR_W = 110, ACTOR_H = 42;
const LIFELINE_START = 60, LIFELINE_END_MARGIN = 60;
const MSG_SPACING = 52;

function actorCenterX(a) { return a.x + ACTOR_W/2; }

function calcCanvasHeight() {
  const base = LIFELINE_START + (state.messages.length + state.notes.length + 1) * MSG_SPACING + LIFELINE_END_MARGIN + 60;
  return Math.max(base, 500);
}

// @@RENDER-START
function render() {
  // Clear layers
  actorsLayer.innerHTML    = '';
  lifelinesLayer.innerHTML = '';
  messagesLayer.innerHTML  = '';
  notesLayer.innerHTML     = '';
  fragmentsLayer.innerHTML  = '';
  interactionLayer.innerHTML = '';
  editLayer.innerHTML = '';

  const canvasH = calcCanvasHeight();
  const lifeEnd = canvasH - LIFELINE_END_MARGIN;

  emptyHint.style.display = state.actors.length === 0 ? '' : 'none';

  // ── Fragments ──
  // Selected fragment rendered last — paints on top of any overlapping fragments.
  const selectedFragId = uiState.selected?._type === 'fragment' ? uiState.selected.id : null;
  const fragsOrdered = selectedFragId
    ? [...state.fragments.filter(f => f.id !== selectedFragId), ...state.fragments.filter(f => f.id === selectedFragId)]
    : state.fragments;
  for (const f of fragsOrdered) renderFragment(f);

  // ── Lifelines ──
  for (const a of state.actors) {
    const cx = actorCenterX(a);
    const line = svgEl('line', {
      x1:cx, y1:ACTOR_H + LIFELINE_START/2,
      x2:cx, y2:lifeEnd,
      class:'lifeline'
    });
    lifelinesLayer.appendChild(line);
  }

  // ── Messages (assign y positions) ──
  // Collect all y-positioned items and sort
  const allItems = [
    ...state.messages.map((m,i) => ({ el:m, type:'msg',  y: m.y || (ACTOR_H + LIFELINE_START + i*MSG_SPACING) })),
    ...state.notes.map((n,i)    => ({ el:n, type:'note', y: n.y || (ACTOR_H + LIFELINE_START + 20 + i*MSG_SPACING) })),
  ].sort((a,b) => a.y - b.y);

  // Re-assign y positions cleanly
  let yPos = ACTOR_H + LIFELINE_START + 20;
  for (const item of allItems) {
    item.el.y = yPos;
    yPos += MSG_SPACING;
  }

  for (const item of allItems) {
    if (item.type === 'msg') renderMessage(item.el);
    if (item.type === 'note') renderNote(item.el);
  }

  // ── Actors (on top) ──
  for (const a of state.actors) {
    renderActor(a);
  }



  updateStats();
  if (typeof _renderEditBtn === 'function') _renderEditBtn();
  // fitToZoom NOT called here — only fires via autoFitOnLoad (diagram:loaded) and explicit fit button
}



// ── Template Method base ────────────────────────────────────────────────────────────
// Every render function builds a <g> with identical boilerplate:
//   dataset.id/type, role, aria-label, tabindex, hover bounds, click handler.
// renderElement() owns that contract once. drawFn(g) appends type-specific
// children; clickFn handles clicks (null for drag-only elements like notes).
function renderElement(el, type, layer, ariaLabel, hoverArgs, drawFn, clickFn) {
  const g = svgEl('g');
  g.dataset.id   = el.id;
  g.dataset.type = type;
  g.setAttribute('role',       'button');
  g.setAttribute('aria-label', ariaLabel);
  g.setAttribute('tabindex',   '0');
  g.prepend(svgHoverBounds(...hoverArgs));
  drawFn(g);
  if (clickFn) g.addEventListener('click', clickFn);
  layer.appendChild(g);
  return g;
}

function renderFragment(f) {
  const kw  = f.kind.replace('frag-','');
  const col = ({alt:'#c44af0', loop:'#4af0e0', opt:'#c44af0'})[kw] || '#c44af0';

  renderElement(f, 'fragment', uiState.selected?.id === f.id ? interactionLayer : fragmentsLayer, `${kw} fragment: ${f.cond||'condition'}`,
    [f.x, f.y, f.w, f.h, 4],
    g => {
      g.style.cursor = 'move';
      const rect = svgEl('rect', { x:f.x, y:f.y, width:f.w, height:f.h, rx:6,
        fill:'none', stroke: uiState.selected?.id === f.id ? col : col+'55', 'stroke-width': uiState.selected?.id === f.id ? 2.5 : 1.5, 'stroke-dasharray':'8 3' });
      const lbl  = svgEl('text', { x:f.x+6,  y:f.y+15, fill:col,
        'font-family':'JetBrains Mono, monospace', 'font-size':11, 'font-weight':700 });
      lbl.textContent = kw.toUpperCase();
      const cond = svgEl('text', { x:f.x+40, y:f.y+15, fill:col+'99',
        'font-family':'JetBrains Mono, monospace', 'font-size':10 });
      cond.textContent = `[${f.cond||'condition'}]`;
      g.append(rect, lbl, cond);
      if (uiState.selected?.id === f.id) {
        const HANDLE = 14;
        g.appendChild(svgEl('rect', {
          x:f.x+f.w-HANDLE, y:f.y+f.h-HANDLE, width:HANDLE, height:HANDLE,
          class:'frag-resize-handle', 'data-id':f.id, 'data-type':'frag-resize', rx:3,
        }));
      }
    },
    e => {
      e.stopPropagation();
      setSelected(store.getFragmentById(f.id), 'fragment', true);
    }
  );
}

function renderActor(a) {
  const icon = a.emoji || {'actor-person':'👤','actor-system':'⬜','actor-db':'🗄️','actor-queue':'📥'}[a.type] || '⬜';
  const isConnectSource = uiState.mode === 'connect' && uiState.connectFrom === a.id;
  const rectClass = 'actor-head'
    + (uiState.selected?.id===a.id ? ' selected' : '')
    + (isConnectSource ? ' connect-source' : '');
  const botY = calcCanvasHeight() - LIFELINE_END_MARGIN + 8;

  const g = renderElement(a, 'actor', uiState.selected?.id === a.id ? interactionLayer : actorsLayer, `Actor: ${a.label}`,
    [a.x, 8, ACTOR_W, ACTOR_H, 4],
    g => {
      g.classList.add('actor-group');
      const rect    = svgEl('rect', { x:a.x, y:8, width:ACTOR_W, height:ACTOR_H, class:rectClass, rx:6, cursor:'grab' });
      const lbl     = svgEl('text', { x:a.x+ACTOR_W/2+10, y:8+ACTOR_H/2, class:'actor-label' });
      lbl.textContent = a.label||'Actor';
      const ico     = svgEl('text', { x:a.x+14, y:8+ACTOR_H/2+1, 'font-size':12,
        'dominant-baseline':'middle', 'text-anchor':'middle', 'pointer-events':'none' });
      ico.textContent = icon;
      const botRect = svgEl('rect', { x:a.x, y:botY, width:ACTOR_W, height:ACTOR_H, class:rectClass, rx:6, cursor:'grab' });
      const botLbl  = svgEl('text', { x:a.x+ACTOR_W/2+10, y:botY+ACTOR_H/2, class:'actor-label' });
      botLbl.textContent = a.label||'Actor';
      const botIco  = svgEl('text', { x:a.x+14, y:botY+ACTOR_H/2+1, 'font-size':12,
        'dominant-baseline':'middle', 'text-anchor':'middle', 'pointer-events':'none' });
      botIco.textContent = icon;
      g.append(rect, lbl, ico, botRect, botLbl, botIco);
      // Move overlay — only on selected actor, covers full box, owns drag
      if (uiState.selected?.id === a.id) {
        const ov = svgEl('rect', {
          x: a.x - 6, y: 2, width: ACTOR_W + 12, height: ACTOR_H + 12, rx: 8,
          fill: 'transparent', cursor: 'grab', stroke: 'none',
          'data-id': a.id, 'data-type': 'actor-move'
        });
        g.appendChild(ov);
      }
    },
    null // actor selection handled in svg mousedown — no separate click handler needed
  );
}

// --- renderMessage helpers ---

// Unconnected placeholder: dashed line with warning label
function _renderMsgUnconnected(m) {
  const ug = svgEl('g');
  ug.dataset.id = m.id;
  ug.dataset.type = 'message';
  const isSelected = uiState.selected?.id === m.id;
  const uColor = isSelected ? 'var(--accent)' : 'var(--text-muted, #666)';
  const uLine = svgEl('line', {
    x1: 80, y1: m.y, x2: 260, y2: m.y,
    stroke: uColor, 'stroke-width': 1.5, 'stroke-dasharray': '6 4',
  });
  const uLabel = svgEl('text', {
    x: 84, y: m.y - 6, fill: uColor,
    'font-size': 11, 'font-style': 'italic', 'pointer-events': 'none',
  });
  uLabel.textContent = '\u26a0 ' + (m.label || 'message') + ' \u2013 unconnected';
  const uHit = svgEl('rect', { x: 80, y: m.y - 14, width: 200, height: 22, fill: 'transparent' });
  uHit.addEventListener('click', e => { e.stopPropagation(); setSelected(m, 'message', true); });
  ug.append(uLine, uLabel, uHit);
  (uiState.selected?.id === m.id ? interactionLayer : messagesLayer).appendChild(ug);
}

// Self-loop path element (cubic bezier arc back to same actor)
function _buildSelfPath(x1, y, cls, kindKey) {
  const ox = x1 + 40;
  return svgEl('path', {
    d: `M${x1} ${y} C ${ox} ${y}, ${ox} ${y + 28}, ${x1} ${y + 28}`,
    class: cls,
    'marker-end': `url(#arrow-${kindKey})`,
  });
}

// Network protocol/port/auth badge + dataClass badge below the message line
function _appendNetBadges(g, m, lx, ly, dir) {
  const classColors = {
    Public: '#4af07a', Internal: '#f0c44a', Confidential: '#f07a4a',
    PII: '#ff6b8a', PHI: '#ff6b8a', Secret: '#556080',
  };
  const netParts = [];
  if (m.protocol) netParts.push(m.protocol);
  if (m.port)     netParts.push(':' + m.port);
  if (m.auth)     netParts.push(m.auth);
  const baseY = ly + (dir !== 'right' ? 24 : 14);
  if (netParts.length > 0) {
    const badgeTxt = svgEl('text', { x: lx, y: baseY, class: 'net-badge', 'text-anchor': 'middle' });
    badgeTxt.textContent = netParts.join(' ');
    g.appendChild(badgeTxt);
  }
  if (m.dataClass) {
    const dcColor = classColors[m.dataClass] || 'var(--text3)';
    const dcBadge = svgEl('text', {
      x: lx, y: baseY + (netParts.length ? 12 : 0),
      class: 'net-badge', 'text-anchor': 'middle', fill: dcColor,
    });
    dcBadge.textContent = m.dataClass;
    g.appendChild(dcBadge);
  }
  return { hasNet: netParts.length > 0, hasDC: !!m.dataClass };
}

function renderMessage(m) {
  const dir = m.direction || 'right';
  const fromActor = store.getActorById(m.fromId);
  const toActor   = store.getActorById(m.toId);

  if (!fromActor || !toActor) { _renderMsgUnconnected(m); return; }

  // Geometry
  const x1 = actorCenterX(fromActor), x2 = actorCenterX(toActor);
  const y  = (m.y > 0 ? m.y : ACTOR_H + LIFELINE_START + 20);
  const isSelf = fromActor.id === toActor.id;

  // Group scaffold
  const g = svgEl('g');
  g.dataset.id   = m.id;
  g.dataset.type = 'message';
  g.setAttribute('role', 'button');
  g.setAttribute('aria-label', `${m.kind} message from ${fromActor.label} to ${toActor.label}: ${m.label || ''}`);
  g.setAttribute('tabindex', '0');
  g.style.cursor = 'pointer';

  const sel     = uiState.selected?.id === m.id;
  const kindMap = { sync: 'sync', async: 'async', return: 'return' };
  const cls     = `msg-line ${kindMap[m.kind] || 'sync'}${sel ? ' selected' : ''}`;
  // kindKey drives marker IDs: sync | async | return
  const kindKey = m.kind === 'return' ? 'return' : m.kind === 'async' ? 'async' : 'sync';

  // Arrow markers
  // right -> arrowhead at toActor end; left -> at fromActor end; both -> both ends
  const markerEnd   = (dir === 'right' || dir === 'both') ? `url(#arrow-${kindKey})`     : 'none';
  const markerStart = (dir === 'left'  || dir === 'both') ? `url(#arrow-${kindKey}-rev)` : 'none';

  // Path / line
  let path;
  if (isSelf) {
    path = _buildSelfPath(x1, y, cls, kindKey);
  } else {
    const hit = svgEl('line', { x1, y1: y, x2, y2: y, stroke: 'transparent', 'stroke-width': 24 }); /* 24px min target */
    g.appendChild(hit);
    path = svgEl('line', { x1, y1: y, x2, y2: y, class: cls, 'marker-end': markerEnd, 'marker-start': markerStart });
  }

  // Label
  const lx  = isSelf ? x1 + 44 : (x1 + x2) / 2;
  const ly  = isSelf ? y + 18  : y - 6;
  const lbl = svgEl('text', { x: lx, y: ly, class: `msg-label ${m.kind || 'sync'}` });
  lbl.textContent = m.label || 'message';

  // Bidirectional / left-direction chevron indicator
  if (dir === 'left' || dir === 'both') {
    const cx   = isSelf ? x1 + 4 : x1 + 10;
    const chev = svgEl('text', { x: cx, y: ly + 12, 'font-size': 9, 'text-anchor': 'middle', fill: 'var(--text3)', 'pointer-events': 'none' });
    chev.textContent = dir === 'both' ? '\u2194' : '\u2190';
    g.appendChild(chev);
  }

  // Pre-calculate badge presence for hover bounds
  const netParts = [];
  if (m.protocol) netParts.push(m.protocol);
  if (m.port)     netParts.push(':' + m.port);
  if (m.auth)     netParts.push(m.auth);

  // Hover bounds: label above line + line + badges below
  const mx        = Math.min(x1, x2), mw = Math.abs(x2 - x1) || 60;
  const hoverTop  = ly - 14;
  const hoverBottom = y + (dir !== 'right' ? 30 : 20) + (netParts.length ? 12 : 0) + (m.dataClass ? 12 : 0);
  g.prepend(svgHoverBounds(mx, hoverTop, mw, hoverBottom - hoverTop, 8));

  g.append(path, lbl);

  // Click -> select + open Properties
  g.addEventListener('click', e => {
    if (uiState.mode === 'connect') return;
    e.stopPropagation();
    setSelected(store.getMessageById(m.id), 'message');
    if (DEBUG_VERBOSE) dbg('msg-click', `id=${m.id} selected`);
  });

    // Dblclick -> inline label edit (div overlay, screen-space coords)
  g.addEventListener('dblclick', ev => {
    ev.stopPropagation();
    const msg = store.getMessageById(m.id);
    if (!msg) return;
    const labelEl = g.querySelector('.msg-label');
    if (!labelEl) return;
    // Remove any existing inline editor
    const existing = document.getElementById('sf-label-editor');
    if (existing) existing.remove();
    // Position div over the label using screen coords
    const r = labelEl.getBoundingClientRect();
    const wrap = document.getElementById('canvas-wrap') || document.body;
    const wr = wrap.getBoundingClientRect();
    const inp = document.createElement('input');
    inp.id = 'sf-label-editor';
    inp.type = 'text';
    inp.value = msg.label || '';
    inp.style.cssText = [
      'position:absolute',
      'left:'  + Math.round(r.left  - wr.left - 4) + 'px',
      'top:'   + Math.round(r.top   - wr.top  - 4) + 'px',
      'width:' + Math.max(120, Math.round(r.width  + 40)) + 'px',
      'height:22px',
      'font-size:11px','padding:2px 4px','box-sizing:border-box',
      'border:2px solid ' + (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#4af0c4'),'border-radius:3px',
      'background:' + (getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()||'#141720') + ';color:' + (getComputedStyle(document.documentElement).getPropertyValue('--text').trim()||'#e8ecf4') + ';outline:none',
      'z-index:9999'
    ].join(';');
    let committed = false;
    const commit =() => {
      if (committed) return; committed = true;
      const val = inp.value.trim();
      inp.remove();
      if (val !== (msg.label || '')) store.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: msg.id, label: val } });
    };
    inp.addEventListener('keydown', k => {
      if (k.key == 'Enter') { k.preventDefault(); commit(); }
      if (k.key == 'Escape') { inp.remove(); committed = true; }
    });
    inp.addEventListener('blur', commit);
    wrap.style.position = wrap.style.position || 'relative';
    wrap.appendChild(inp);
    setTimeout(() => inp.select(), 0);
  });

  _appendNetBadges(g, m, lx, ly, dir);

  (uiState.selected?.id === m.id ? interactionLayer : messagesLayer).appendChild(g);
  // Direction changed via Properties panel only.
}
function noteHeight(text) {
  var W_INNER = 104;
  var CHARS_PER_LINE = 17;
  var LINE_H = 15;
  var PADDING = 14;
  var lines = (text || 'note').split('\n').reduce(function(acc, seg) {
    return acc + Math.max(1, Math.ceil(seg.length / CHARS_PER_LINE));
  }, 0);
  return Math.max(36, lines * LINE_H + PADDING);
}

function renderNote(n) {
  var W = 120;
  var H = noteHeight(n.text);
  var x = n.x || 20;
  var y = n.y;
  var sel = uiState.selected && uiState.selected.id === n.id;
  var _noteCol = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#f0c44a';

  renderElement(n, 'note', uiState.selected?.id === n.id ? interactionLayer : notesLayer, 'Note: ' + (n.text || ''),
    [x, y - H/2, W, H, 4],
    function(g) {
      g.style.cursor = 'move';
      var rect = svgEl('rect', { x:x, y:y-H/2, width:W, height:H, rx:4, class:'note-box' });
      if (sel) rect.setAttribute('stroke', _noteCol);
      // SVG text with tspan line wrapping — no foreignObject, taint-free for PNG export
      var CHARS_PER_LINE = 17;
      var LINE_H = 15;
      var lines = (n.text || 'note').split('\n').reduce(function(acc, seg) {
        var words = seg.split(' ');
        var cur = '';
        words.forEach(function(w) {
          if ((cur + (cur ? ' ' : '') + w).length > CHARS_PER_LINE) {
            if (cur) acc.push(cur);
            cur = w;
          } else {
            cur = cur ? cur + ' ' + w : w;
          }
        });
        if (cur) acc.push(cur);
        if (!acc.length) acc.push('');
        return acc;
      }, []);
      var textEl = svgEl('text', {
        x: x + 7,
        y: y - H/2 + 14,
        fill: _noteCol,
        'font-family': 'JetBrains Mono, monospace',
        'font-size': 10,
        'pointer-events': 'none',
      });
      lines.forEach(function(line, i) {
        var ts = svgEl('tspan', { x: x + 7, dy: i === 0 ? 0 : LINE_H });
        ts.textContent = line;
        textEl.appendChild(ts);
      });
      g.append(rect, textEl);
    },
    null
  );
}
// @@RENDER-END

function svgEl(tag, attrs={}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Invisible padded hit-rect that shows as a dashed outline on hover/focus
// Prepend to g so it sits behind content but covers the full bounding area
function svgHoverBounds(x, y, w, h, pad=6) {
  return svgEl('rect', {
    x: x-pad, y: y-pad, width: w+pad*2, height: h+pad*2,
    rx: 4, class: 'hover-bounds'
  });
}

// ═══════════════════════════════════════════════════════
//  INTERACTION — drag & drop, click, keyboard
// ══════════════════�����════════════════════════════════════
const canvasWrap = document.getElementById('canvas-wrap');

// ── Palette drag ──
// ── Palette preview: build a default object and show it in Properties ──
function showPalettePreview(type) {
  // Mark which item is previewing
  document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('previewing'));
  const previewEl = document.querySelector(`.palette-item[data-type="${type}"]`);
  if (previewEl) previewEl.classList.add('previewing');

  // Build a synthetic default object — not added to state arrays
  let obj, objType;
  if (type.startsWith('actor')) {
    obj = { id:'__preview__', x:0, label: labelForType(type), type, emoji: undefined, _preview: true };
    objType = 'actor';
  } else if (type.startsWith('msg')) {
    const kind = type.replace('msg-','');
    const fa = state.actors[0] || { id:'', label:'From' };
    const ta = state.actors[1] || state.actors[0] || { id:'', label:'To' };
    obj = { id:'__preview__', fromId: fa.id, toId: ta.id, label:'message', kind, direction:'right', y:0, _preview: true };
    objType = 'message';
  } else if (type === 'note') {
    obj = { id:'__preview__', x:60, y:200, text:'note', _preview: true };
    objType = 'note';
  } else if (type.startsWith('frag')) {
    obj = { id:'__preview__', x:60, y:200, w:200, h:100, kind: type, cond:'condition', _preview: true };
    objType = 'fragment';
  } else {
    return;
  }

  // Set selected without triggering actor-arm or tab-switch side effects
  _propDirty = false;
  uiState.selected = _wrapSelected(obj, objType);
  activateTab('tab-props');
  renderProperties();
  dbg('palette-preview', `type=${type}`);
}

// ── "+" button handler: add to canvas (using preview values if available) ──
function addFromPaletteBtn(type) {
  // If current preview matches this type, read edited values from props form
  const isPreview = state.selected?._preview && uiState.selected?._type ===
    (type.startsWith('actor') ? 'actor' : type.startsWith('msg') ? 'message' : type === 'note' ? 'note' : 'fragment');

  if (isPreview) {
    // Harvest current form values before calling addFromPalette
    const ref = uiState.selected?._ref;
    if (ref) {
      if (uiState.selected?._type === 'actor') {
        ref.label = document.getElementById('p-label')?.value || ref.label;
        ref.emoji = document.getElementById('p-emoji')?.value?.trim() || undefined;
        ref.type  = document.getElementById('p-atype')?.value || ref.type;
      } else if (uiState.selected?._type === 'message') {
        ref.label     = document.getElementById('p-mlabel')?.value || ref.label;
        ref.kind      = document.getElementById('p-mkind')?.value  || ref.kind;
        ref.direction = document.getElementById('p-mdir')?.value   || ref.direction;
        ref.fromId    = document.getElementById('p-from')?.value   || ref.fromId;
        ref.toId      = document.getElementById('p-to')?.value     || ref.toId;
      } else if (uiState.selected?._type === 'note') {
        ref.text = document.getElementById('p-ntext')?.value || ref.text;
      } else if (uiState.selected?._type === 'fragment') {
        ref.kind = document.getElementById('p-fkind')?.value || ref.kind;
        ref.cond = document.getElementById('p-fcond')?.value || ref.cond;
      }
    }
    // Add to canvas using harvested values
    addFromPaletteWithDefaults(type, ref);
  } else {
    addFromPalette(type, getNextActorX());
  }
  // Clear preview highlight
  document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('previewing'));
}

function addFromPaletteWithDefaults(type, defaults) {
  if (type.startsWith('actor')) {
    _store.dispatch({ type: 'ADD_ACTOR', payload: {
      label: defaults.label, type: defaults.type, emoji: defaults.emoji,
    }});
    toast(`Added ${defaults.label || 'Actor'}`);
  } else if (type.startsWith('msg')) {
    _store.dispatch({ type: 'ADD_MESSAGE', payload: {
      fromId:    defaults.fromId || (() => {
        const sorted = [..._store.state.actors].sort((a,b) => a.x - b.x);
        return sorted[0]?.id || null;
      })(),
      toId:      defaults.toId   || (() => {
        const sorted = [..._store.state.actors].sort((a,b) => a.x - b.x);
        return (sorted[1] || sorted[0])?.id || null;
      })(),
      label:     defaults.label     || 'message',
      kind:      defaults.kind      || 'sync',
      direction: defaults.direction || 'right',
    }});
    toast('Message added — set From/To in Properties');
  } else if (type === 'note') {
    _store.dispatch({ type: 'ADD_NOTE', payload: {
      x: 60, y: calcCanvasHeight()/2, text: defaults.text || 'note',
    }});
    toast('Note added');
  } else if (type.startsWith('frag')) {
    _store.dispatch({ type: 'ADD_FRAGMENT', payload: {
      x: 60, y: calcCanvasHeight()/2 - 50, w: 200, h: 100,
      kind: defaults.kind || type, cond: defaults.cond || 'condition',
    }});
    toast('Fragment added');
  }
}

// ── Wire palette items: click = preview, drag = still works ──
document.querySelectorAll('.palette-item').forEach(item => {
  const type = item.dataset.type;

  // actor-custom: click opens modal directly (no preview step)
  if (type === 'actor-custom') {
    item.addEventListener('click', () => {
      document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('previewing'));
      addFromPalette('actor-custom', getNextActorX());
    });
    item.addEventListener('keydown', e => {
      if (e.key==='Enter'||e.key===' ') {
        e.preventDefault();
        document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('previewing'));
        addFromPalette('actor-custom', getNextActorX());
      }
    });
    return;
  }

  // Drag still adds directly (drop on canvas)
  item.addEventListener('dragstart', e => {
    e.dataTransfer.setData('type', type);
    e.dataTransfer.effectAllowed = 'copy';
  });

  // Click = add directly in icons mode, preview in expanded mode
  item.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('state-icons')) {
      addFromPaletteBtn(type);
    } else {
      showPalettePreview(type);
    }
  });

  // Enter/Space = same routing as click (keyboard)
  item.addEventListener('keydown', e => {
    if (e.key==='Enter'||e.key===' ') {
      e.preventDefault();
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('state-icons')) {
        addFromPaletteBtn(type);
      } else {
        showPalettePreview(type);
      }
    }
  });
});

// ── Wire "+" buttons: click = add to canvas ──
document.querySelectorAll('.palette-add-btn').forEach(btn => {
  const type = btn.dataset.addType;
  btn.addEventListener('click', e => {
    e.stopPropagation(); // don't bubble to palette-item
    addFromPaletteBtn(type);
  });
  btn.addEventListener('keydown', e => {
    if (e.key==='Enter'||e.key===' ') { e.preventDefault(); addFromPaletteBtn(type); }
  });
});

canvasWrap.addEventListener('dragover', e => {
  e.preventDefault(); e.dataTransfer.dropEffect='copy';
  canvasWrap.classList.add('drop-active');
});
canvasWrap.addEventListener('dragleave', () => canvasWrap.classList.remove('drop-active'));
canvasWrap.addEventListener('drop', e => {
  e.preventDefault(); canvasWrap.classList.remove('drop-active');
  const type = e.dataTransfer.getData('type');
  if (!type) return;
  const rect = canvasWrap.getBoundingClientRect();
  const x    = e.clientX - rect.left;
  const y    = e.clientY - rect.top;
  addFromPalette(type, x, y);
});


// ── Centre view on newly added element ───────────────────────────────────
// Pans horizontally so the element appears centred in the canvas viewport.
// Smooth: brief CSS transition on _viewport, removed after animation completes.
// Respects state_settings.centreOnAdd (user preference, default true).
function _centreOnElement(svgCentreX) {
  if (!state_settings.centreOnAdd) return;
  const r = canvasWrap.getBoundingClientRect();
  const target = r.width / 2 - svgCentreX * _zoom;
  _viewport.style.transition = 'transform 0.3s ease';
  applyPan(target, 0);
  setTimeout(() => { _viewport.style.transition = ''; }, 350);
}

function addFromPalette(type, x, y) {
  dbg('addFromPalette', `type=${type} x=${x} y=${y} actors=${state.actors.length}`);
  if (type === 'actor-custom') {
    showActorModal().then(result => {
      if (!result) return;
      _store.dispatch({ type: 'ADD_ACTOR', payload: {
        label: result.label, type: 'actor-system', emoji: result.emoji,
      }});
      toast(`Added ${result.label}`);
      const a = _store.state.actors[_store.state.actors.length - 1];
      if (a) _centreOnElement(a.x + 55);
    });
    return;
  } else if (type.startsWith('actor')) {
    _store.dispatch({ type: 'ADD_ACTOR', payload: {
      label: labelForType(type), type,
    }});
    toast(`Added ${labelForType(type)}`);
    const a = _store.state.actors[_store.state.actors.length - 1];
    if (a) _centreOnElement(a.x + 55);
  } else if (type.startsWith('msg')) {
    const kind = type.replace('msg-','');
    // fromId: selected actor → else leftmost actor
    // toId:   next actor after fromId by x position → else same as fromId (self-message)
    const _sorted = [..._store.state.actors].sort((a,b) => a.x - b.x);
    const _selActor = uiState.selected?._type === 'actor' ? _store.getActorById(uiState.selected.id) : null;
    const _fromActor = _selActor || _sorted[0] || null;
    const _toActor = _sorted.find(a => a.x > (_fromActor?.x ?? -1) && a.id !== _fromActor?.id) || _fromActor;
    _store.dispatch({ type: 'ADD_MESSAGE', payload: {
      fromId: _fromActor?.id || null,
      toId:   _toActor?.id   || null,
      label: 'message', kind, direction: 'right',
    }});
    toast('Message added — set From/To in Properties');
    // Centre on fromActor (parent anchor) — message inherits actor x
    if (_fromActor) _centreOnElement(_fromActor.x + 55);
  } else if (type === 'note') {
    const nx = Math.max(10, x||60);
    _store.dispatch({ type: 'ADD_NOTE', payload: {
      x: nx, y: y||200, text: 'note',
    }});
    toast('Note added');
    _centreOnElement(nx + 60);
  } else if (type.startsWith('frag')) {
    const fx = Math.max(10,(x||60)-80);
    _store.dispatch({ type: 'ADD_FRAGMENT', payload: {
      x: fx, y: y||200, w: 200, h: 100, kind: type, cond: 'condition',
    }});
    toast('Fragment added');
    _centreOnElement(fx + 100);
  }
}

function labelForType(t) {
  return { 'actor-person':'User','actor-system':'System',
           'actor-db':'Database','actor-queue':'Queue' }[t] || 'Actor';
}

// ── Place-actor ghost tracking ──


// ── Canvas click / select ──
svg.addEventListener('click', e => {
  const g = e.target.closest('[data-id]');
  dbg('canvas-click', `mode=${uiState.mode} target=${g ? g.dataset.type+'#'+g.dataset.id : 'none'}`);

  if (!g) { setSelected(null, null, true); return; }

  const id   = g.dataset.id;
  const type = g.dataset.type;

  // Messages handle their own click (select) and dblclick (direction cycle) via stopPropagation.
  // If propagation reached here anyway (e.g. connect mode targeting an actor
  // overlapping a message), let connect mode handle it but skip message selection.
  if (type === 'message') {
    if (uiState.mode === 'connect') return; // connect mode ignores messages
    return; // message's own handler owns selection
  }

  if (uiState.mode==='connect') {
    if (type==='actor') handleConnectClick(id);
    return;
  }

  const found =
    store.getActorById(id) ||
    store.getNoteById(id) ||
    store.getFragmentById(id);

  if (found) { setSelected(found, type, true); render(); }
});

// @@EVENTS-START
// ── Connect mode ──
function handleConnectClick(actorId) {
  dbg('handleConnectClick', `actorId=${actorId} connectFrom=${uiState.connectFrom}`);
  const announce = document.getElementById('connect-announce');
  if (!uiState.connectFrom) {
    uiState.connectFrom = actorId;
    const fromActor = store.getActorById(actorId);
    const msg = `Drawing message from ${fromActor?.label || 'actor'}. Now click the destination actor.`;
    if (announce) announce.textContent = msg;
    toast('Click destination actor to complete');
    render(); // re-render to show connect-source highlight
  } else {
    const fromActor = store.getActorById(uiState.connectFrom);
    const toActor   = store.getActorById(actorId);
    store.dispatch({ type: 'ADD_MESSAGE', payload: {
      fromId: uiState.connectFrom, toId: actorId, label: 'message', kind: 'sync', direction: 'right',
    }});
    const connMsg = `Message created from ${fromActor?.label || 'actor'} to ${toActor?.label || 'actor'}.`;
    if (announce) announce.textContent = connMsg;
    uiState.connectFrom = null;
    setMode('select');
    render();
  }
}

// ── Canvas pan ──
function applyPan(x, y) {
  uiState.panX = x;
  uiState.panY = 0; // sequence diagrams scroll vertically — pan is horizontal-only
  _viewport.setAttribute('transform', `translate(${uiState.panX},${uiState.panY}) scale(${_zoom})`);
}
let _panning = false, _panStartX = 0, _panStartY = 0, _panOriginX = 0, _panOriginY = 0;

// ── Drag actors / notes / fragments / message rows ──
let dragging = null, dragOffX = 0, dragOffY = 0;
let draggingMsg = null, _msgMoved = false; // message Y-drag; _msgMoved guards undo

// ── InteractionContext factory ───────────────────────────────
// Passed to SequenceElement drag/select methods. Single definition.
// Elements never access globals directly — only what ctx exposes.
function _makeInteractionContext() {
  return {
    store:      store,
    svg:        svg,
    canvasWrap: canvasWrap,
    get zoom()  { return _zoom },
    render:     render,
    uiState:    uiState,
    _drag:      null,
  }
}
let _interactionCtx = null // initialised on first mousedown

svg.addEventListener('mousedown', e => {
  if (uiState.mode === 'connect') return; // connect mode owns clicks
  const g = e.target.closest('[data-id]');
  if (!g) {
    // Empty canvas — start pan
    _panning   = true;
    _panStartX = e.clientX;
    _panStartY = e.clientY;
    _panOriginX = uiState.panX;
    _panOriginY = uiState.panY;
    svg.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  const type = g.dataset.type;
  const id   = g.dataset.id;
  const canvasRect = canvasWrap.getBoundingClientRect();

  // ── Message row drag (Y axis only) ──
  // Do NOT pushUndo here — only push if the user actually moves it (see mousemove)
  if (type === 'message') {
    const msg = store.getMessageById(id);
    if (!msg) return;
    e.preventDefault();
    draggingMsg          = msg;
    draggingMsg._baseY   = msg.y;   // capture start Y for translate delta
    draggingMsg._ghostEl = g;       // hold the live SVG element
    g.style.opacity      = '0.4';
    _msgMoved            = false;
    return;
  }

  // ── Fragment SE-corner resize ──
  if (type === 'frag-resize') {
    const frag = store.getFragmentById(id);
    if (!frag) return;
    e.preventDefault();
    dragging           = frag;
    dragging._type     = 'fragment';
    dragging._resizeHandle = 'se';
    // Offset from the SE corner so the handle tracks the pointer precisely
    dragOffX = (e.clientX - canvasRect.left) / _zoom - (frag.x + frag.w);
    dragOffY = (e.clientY - canvasRect.top)  / _zoom - (frag.y + frag.h);
    return;
  }

  // ── Actor select — mousedown, no drag, no preventDefault
  // Selection happens here so it fires regardless of click suppression from other handlers.
  if (type === 'actor') {
    if (uiState.mode === 'connect') { handleConnectClick(id); return; }
    const actor = store.getActorById(id);
    if (actor) setSelected(actor, 'actor', true);
    return; // no drag from actor body — drag is handled by actor-move overlay on selected actors
  }

  // ── Actor move overlay — delegated to ActorElement ──
  if (type === 'actor-move') {
    const actor = store.getActorById(id)
    if (!actor) return
    _interactionCtx = _makeInteractionContext()
    const el = ElementFactory.create(actor)
    el.onDragStart(e, _interactionCtx)
    dragging = actor            // keeps legacy mousemove/mouseup guards alive
    dragging._type = 'actor'  // routes mousemove to Factory path
    return
  }
  // ── Note / fragment drag (X+Y) ──
  // ── Note / fragment drag — delegated to element class ──
  if (type !== 'note' && type !== 'fragment') return
  const obj = store.getNoteById(id) || store.getFragmentById(id)
  if (!obj) return
  e.preventDefault()
  _interactionCtx = _makeInteractionContext()
  const el = ElementFactory.create(obj)
  el.onDragStart(e, _interactionCtx)
  dragging = obj
  dragging._type = type
})
window.addEventListener('mousemove', e => {
  const canvasRect = canvasWrap.getBoundingClientRect();

  if (_panning) {
    applyPan(_panOriginX + (e.clientX - _panStartX), _panOriginY + (e.clientY - _panStartY));
    return;
  }

  if (draggingMsg) {
    _msgMoved = true;
    const newY = Math.max(ACTOR_H + LIFELINE_START + 10, (e.clientY - canvasRect.top) / _zoom);
    draggingMsg.y = newY;   // direct mutation — no dispatch, no full render
    if (draggingMsg._ghostEl) {
      // Update y coords directly on SVG children — message geometry uses absolute coords
      // so translate() would move the arrow off the lifelines. Direct update keeps the
      // ghost snapped to the lifelines matching actor/note/fragment behaviour.
      draggingMsg._ghostEl.querySelectorAll('line').forEach(l => {
        l.setAttribute('y1', newY);
        l.setAttribute('y2', newY);
      });
      draggingMsg._ghostEl.querySelectorAll('path').forEach(p => {
        // Self-loop path: rebuild arc at new Y
        const d = p.getAttribute('d');
        if (d) p.setAttribute('d', d.replace(/M([d.]+) ([d.]+)/, (_,x,__)=>`M${x} ${newY}`)
                                     .replace(/C ([d.]+) ([d.]+), ([d.]+) ([d.]+), ([d.]+) ([d.]+)/,
                                       (_,x1,__,x2,___,x3,____) => `C ${x1} ${newY}, ${x2} ${newY+28}, ${x3} ${newY+28}`));
      });
      draggingMsg._ghostEl.querySelectorAll('text.msg-label').forEach(t => {
        t.setAttribute('y', newY - 6);
      });
    }
    return;
  }

  if (!dragging) return;
  const newX = Math.max(0, (e.clientX - canvasRect.left) / _zoom - dragOffX);
  const newY = Math.max(60, (e.clientY - canvasRect.top)  / _zoom - dragOffY);

  // ── Fragment resize (SE handle) ──
  if (dragging._resizeHandle === 'se') {
    const seX = (e.clientX - canvasRect.left) / _zoom - dragOffX;
    const seY = (e.clientY - canvasRect.top)  / _zoom - dragOffY;
    const newW = Math.max(60, seX - dragging.x);
    const newH = Math.max(40, seY - dragging.y);
    store.dispatch({ type: 'RESIZE_FRAGMENT',
      payload: { id: dragging.id, w: newW, h: newH },
      meta: { undoable: false } });
    requestRender();
    return;
  }

  // Targeted redraw: mutate the live store object directly and translate the ghost element.
  // No dispatch during drag — one undoable commit fires on mouseup.
  // store.state is a live object; writing dragging.x/y updates it without going through
  // the log, which is intentional (mid-drag positions are not undoable steps).
    if (dragging._type === 'actor') {
      if (_interactionCtx && _interactionCtx._drag) {
        ElementFactory.create(dragging).onDragMove(e, _interactionCtx)
      } else { dragging.x = newX }
  } else if (dragging._type === 'note') {
    if (_interactionCtx && _interactionCtx._drag) {
      ElementFactory.create(dragging).onDragMove(e, _interactionCtx)
    } else { dragging.x = newX; dragging.y = newY }
  } else if (dragging._type === 'fragment') {
    if (_interactionCtx && _interactionCtx._drag) {
      ElementFactory.create(dragging).onDragMove(e, _interactionCtx)
    } else { dragging.x = newX; dragging.y = newY }
  }
  if (dragging._ghostEl) {
    // Actors are X-only; notes and fragments move on both axes.
    const dx = dragging.x - (dragging._dragBaseX ?? 0);
    const dy = (dragging.y || 0) - (dragging._dragBaseY ?? 0);
    dragging._ghostEl.setAttribute('transform', `translate(${dx}, ${dy})`);
  }
});

window.addEventListener('mouseup', e => {
  if (_panning) {
    _panning = false;
    svg.style.cursor = '';
    return;
  }

  if (draggingMsg) {
    if (_msgMoved) {
      // Snap fromId/toId to nearest actor pair at drop X — one undoable commit
      const canvasRect = canvasWrap.getBoundingClientRect();
      const dropX = e.clientX - canvasRect.left;
      const sorted = [...state.actors].sort((a,b) => a.x - b.x);
      if (sorted.length >= 2) {
        const nearest = sorted.reduce((best, a) => {
          const cx = a.x + ACTOR_W/2;
          return Math.abs(cx - dropX) < Math.abs((best.x + ACTOR_W/2) - dropX) ? a : best;
        }, sorted[0]);
        const ni = sorted.indexOf(nearest);
        const pairFrom = nearest;
        const pairTo   = sorted[ni + 1] || sorted[ni - 1];
        if (pairFrom && pairTo && pairFrom.id !== pairTo.id) {
          store.dispatch({ type: 'UPDATE_MESSAGE', payload: {
            id: draggingMsg.id, fromId: pairFrom.id, toId: pairTo.id, direction: 'right',
          }});
          // BUG-001 fix: refresh selected ref so Properties panel reflects new From/To
          if (uiState.selected?.id === draggingMsg.id) {
            uiState.selected = _wrapSelected(store.getMessageById(draggingMsg.id), 'message');
          }
          const announce = document.getElementById('connect-announce');
          if (announce) announce.textContent = `Message reassigned from ${pairFrom.label} to ${pairTo.label}`;
          toast(`Reassigned: ${pairFrom.label} → ${pairTo.label}`);
          dbg('msg-snap', `from=${pairFrom.label} to=${pairTo.label}`);
        }
      }
      render();
    }
    // If not moved: plain click — let the svg click handler select it normally
    if (draggingMsg?._ghostEl) {
      draggingMsg._ghostEl.style.opacity = '';
      draggingMsg._ghostEl.removeAttribute('transform');
      draggingMsg._ghostEl = null;
    }
    draggingMsg = null;
    _msgMoved   = false;
    return;
  }
  if (dragging?._ghostEl) {
    dragging._ghostEl.style.opacity = ''; // restore after drag
    dragging._ghostEl = null;
  }
  // Commit resize as a single undoable step
  if (dragging?._resizeHandle === 'se') {
    store.dispatch({ type: 'RESIZE_FRAGMENT',
      payload: { id: dragging.id, w: dragging.w, h: dragging.h } });
    render();
  }
  // Reflow actors on drop — if the dragged actor moved between others, push them apart.
  // Sort all actors by current x, assign clean evenly-spaced positions, commit as one
  // undoable REFLOW_ACTORS (single snapshot → single Ctrl+Z undoes all moves).
  else if (dragging?._type === 'actor' && state.actors.length > 1) {
    if (_interactionCtx && _interactionCtx._drag) {
      ElementFactory.create(dragging).onDragEnd(e, _interactionCtx)
    } else {
      var _slot = 110 + 60
      var _sorted = state.actors.slice().sort(function(a,b) { return a.x - b.x })
      var _positions = _sorted.map(function(a,i) { return { id: a.id, x: 40 + i * _slot } })
      var _changed = _positions.some(function(p) {
        var cur = store.getActorById(p.id)
        return cur && Math.round(cur.x) !== Math.round(p.x)
      })
      if (_changed) {
        store.dispatch({ type: 'REFLOW_ACTORS', payload: { positions: _positions } })
        setTimeout(render, 0)
      }
    }
  } else if (dragging?._type === 'note') {
    if (_interactionCtx && _interactionCtx._drag) {
      ElementFactory.create(dragging).onDragEnd(e, _interactionCtx)
    } else {
      const noteMoved = Math.round(dragging.x) !== Math.round(dragging._dragBaseX) ||
                        Math.round(dragging.y) !== Math.round(dragging._dragBaseY)
      if (noteMoved) {
        store.dispatch({ type: 'MOVE_NOTE', payload: { id: dragging.id, x: dragging.x, y: dragging.y } })
        setTimeout(render, 0)
      }
    }
  } else if (dragging?._type === 'fragment') {
    if (_interactionCtx && _interactionCtx._drag) {
      ElementFactory.create(dragging).onDragEnd(e, _interactionCtx)
    } else {
      const fragMoved = Math.round(dragging.x) !== Math.round(dragging._dragBaseX) ||
                        Math.round(dragging.y) !== Math.round(dragging._dragBaseY)
      if (fragMoved) {
        store.dispatch({ type: 'MOVE_FRAGMENT', payload: { id: dragging.id, x: dragging.x, y: dragging.y } })
        setTimeout(render, 0)
      }
    }
  }
  dragging = null;
});

// ── Keyboard shortcuts ──
window.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey||e.metaKey) && (e.key==='y' || (e.shiftKey && e.key==='Z'))) { e.preventDefault(); redo(); return; }
  if (e.key==='a' || e.key==='A') { e.preventDefault(); addFromPalette('actor-person', getNextActorX()); }
  if (e.key==='m' || e.key==='M') { e.preventDefault(); addFromPalette('msg-sync', undefined, undefined); }
  if (e.key==='n' || e.key==='N') { e.preventDefault(); addFromPalette('note', 60, calcCanvasHeight()/2); }
  if (e.key==='f' || e.key==='F') { e.preventDefault(); addFromPalette('frag-alt', 60, calcCanvasHeight()/2); }
  if (e.key==='Escape') { setSelected(null); setMode('select'); render(); }
  if ((e.key==='Delete'||e.key==='Backspace') && uiState.selected) deleteSelected();

  // ── Arrow keys: pan canvas (nothing selected) or nudge element (something selected) ──
  // Sequence diagrams are vertical documents — horizontal pan only; Up/Down scroll natively.
  const PAN_STEP  = 20; // px per keypress (pan)
  const MOVE_STEP = 10; // px per keypress (element nudge)
  const arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  if (arrows.includes(e.key)) {
    const sel = uiState.selected;
    if (!sel) {
      // Horizontal pan only — let Up/Down fall through to native scroll
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const dx = e.key==='ArrowLeft' ? -PAN_STEP : PAN_STEP;
      applyPan(uiState.panX + dx, 0);
    } else {
      // Nudge selected element — all four directions allowed when element is selected
      e.preventDefault();
      const dx = e.key==='ArrowLeft' ? -MOVE_STEP : e.key==='ArrowRight' ? MOVE_STEP : 0;
      const dy = e.key==='ArrowUp'   ? -MOVE_STEP : e.key==='ArrowDown'  ? MOVE_STEP : 0;
      if (sel._type === 'actor' && dx !== 0) {
        store.dispatch({ type: 'UPDATE_ACTOR', payload: { id: sel.id, x: Math.max(0, (sel.x||0) + dx) } });
        uiState.selected = _wrapSelected(store.getActorById(sel.id), 'actor');
        render();
      } else if (sel._type === 'note') {
        store.dispatch({ type: 'MOVE_NOTE', payload: { id: sel.id, x: Math.max(0, (sel.x||0) + dx), y: Math.max(60, (sel.y||0) + dy) } });
        uiState.selected = _wrapSelected(store.getNoteById(sel.id), 'note');
        render();
      } else if (sel._type === 'fragment') {
        store.dispatch({ type: 'MOVE_FRAGMENT', payload: { id: sel.id, x: Math.max(0, (sel.x||0) + dx), y: Math.max(60, (sel.y||0) + dy) } });
        uiState.selected = _wrapSelected(store.getFragmentById(sel.id), 'fragment');
        render();
      }
    }
  }
});

// ── Connect mode toggle ──

// ── Selection — uiState only, no store mutation ──
let _propDirty = false;
let _selectedKey = null; // tracks last rendered selection to avoid needless rebuilds // hoisted — must survive render() calls during editing
function setSelected(obj, type, doRender = false) {
  _propDirty = false;
  uiState.selected = obj ? _wrapSelected(obj, type) : null;
  if (obj) {
    // Clear palette preview highlight when a real canvas element is selected
    document.querySelectorAll('.palette-item.previewing').forEach(el => el.classList.remove('previewing'));

  } else {
    document.querySelectorAll('.palette-item.previewing').forEach(el => el.classList.remove('previewing'));
  }
  if (typeof _renderEditBtn === 'function') _renderEditBtn();
  renderProperties();

  // Announce selection to screen readers via polite live region
  const selectAnnounce = document.getElementById('select-announce');
  if (selectAnnounce) {
    if (obj) {
      const s = uiState.selected;
      const visitor = propertyVisitors[s._type];
      const msg = visitor ? visitor.announce(s) : `${s._type} selected`;
      selectAnnounce.textContent = `${msg}. Properties panel updated.`;
    } else {
      selectAnnounce.textContent = 'Selection cleared.';
    }
  }
  if (doRender) render();
}

function setMode(m) {
  uiState.mode = m;
  dbg('setMode', m);
  
  


  canvasWrap.classList.toggle('connecting',    m==='connect');
  
  document.querySelector('#stat-mode b').textContent = m.charAt(0).toUpperCase()+m.slice(1);
  if (m !== 'connect')      uiState.connectFrom  = null;
  
}

// ═══════════════════════════════════════════════════════
//  PROPERTY VISITORS
//  Each visitor provides:
//    html(s)    — builds the properties panel HTML string for that type
//    apply(s)   — reads the panel and dispatches the appropriate UPDATE_* action
//    announce(s)— returns the screen-reader selection announcement string
//  Adding a new element type = one new entry here, zero changes elsewhere.
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// SCHEMA FIELD HELPERS
// Shared by actor and message property visitors.
// Schema field shape: { key, label, type, options? }
// Types: text | password | url | select
// ═══════════════════════════════════════════════════════

function _schemaFieldHtml(field, value) {
  const v = esc(value || '');
  const k = esc(field.key);
  const id = 'p-schema-' + k;
  if (field.type === 'select') {
    const opts = (field.options || []).map(o =>
      `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`
    ).join('');
    return `<div class="prop-group">
      <label for="${id}">${esc(field.label)}</label>
      <select id="${id}" class="prop-select" data-schema-key="${k}">${opts}</select>
    </div>`;
  }
  const t = field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text';
  return `<div class="prop-group">
    <label for="${id}">${esc(field.label)}</label>
    <input type="${t}" id="${id}" class="prop-input" data-schema-key="${k}"
      value="${t === 'password' ? '' : v}"
      placeholder="${t === 'password' ? '(runtime only — not saved)' : ''}"
      autocomplete="off"/>
  </div>`;
}

function _renderSchemaSection(s) {
  if (!s.schema || !s.schema.length) {
    return `<div class="prop-section-label" style="margin-top:12px">Properties
      <button id="btn-add-schema-field" class="prop-add-field-btn" title="Add field">＋</button>
    </div>
    <div id="schema-add-row" style="display:none">
      <div class="prop-group" style="flex-direction:column;gap:4px">
        <input type="text" id="p-new-field-key" class="prop-input" placeholder="key (no spaces)" style="margin-bottom:2px"/>
        <input type="text" id="p-new-field-label" class="prop-input" placeholder="label"/>
        <select id="p-new-field-type" class="prop-select">
          <option value="text">text</option>
          <option value="password">password</option>
          <option value="url">url</option>
          <option value="select">select</option>
        </select>
        <input type="text" id="p-new-field-options" class="prop-input" placeholder="options (comma-sep, for select)" style="display:none"/>
        <button id="btn-confirm-add-field" class="btn-small">Add Field</button>
      </div>
    </div>`;
  }
  const fields = s.schema.map(f => _schemaFieldHtml(f, (s.properties || {})[f.key])).join('');
  return `<div class="prop-section-label" style="margin-top:12px">Properties
    <button id="btn-add-schema-field" class="prop-add-field-btn" title="Add field">＋</button>
  </div>
  ${fields}
  <div id="schema-add-row" style="display:none">
    <div class="prop-group" style="flex-direction:column;gap:4px">
      <input type="text" id="p-new-field-key" class="prop-input" placeholder="key (no spaces)" style="margin-bottom:2px"/>
      <input type="text" id="p-new-field-label" class="prop-input" placeholder="label"/>
      <select id="p-new-field-type" class="prop-select">
        <option value="text">text</option>
        <option value="password">password</option>
        <option value="url">url</option>
        <option value="select">select</option>
      </select>
      <input type="text" id="p-new-field-options" class="prop-input" placeholder="options (comma-sep, for select)" style="display:none"/>
      <button id="btn-confirm-add-field" class="btn-small">Add Field</button>
    </div>
  </div>`;
}

function _afterRenderSchemaSection(s, actionType) {
  // Wire ＋ toggle
  document.getElementById('btn-add-schema-field')?.addEventListener('click', function() {
    const row = document.getElementById('schema-add-row');
    if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
  });
  // Show/hide options input based on type select
  const typeSelect = document.getElementById('p-new-field-type');
  const optionsInput = document.getElementById('p-new-field-options');
  typeSelect?.addEventListener('change', function() {
    if (optionsInput) optionsInput.style.display = this.value === 'select' ? '' : 'none';
  });
  // Wire Add Field confirm
  document.getElementById('btn-confirm-add-field')?.addEventListener('click', function() {
    const key = (document.getElementById('p-new-field-key')?.value || '').trim().replace(/\s+/g, '_');
    const label = (document.getElementById('p-new-field-label')?.value || '').trim() || key;
    const type = document.getElementById('p-new-field-type')?.value || 'text';
    const optRaw = document.getElementById('p-new-field-options')?.value || '';
    const options = type === 'select' ? optRaw.split(',').map(o => o.trim()).filter(Boolean) : undefined;
    if (!key) return;
    const existing = s.schema || [];
    if (existing.find(f => f.key === key)) { toast('Field key already exists'); return; }
    const newField = { key, label, type, ...(options ? { options } : {}) };
    const newSchema = [...existing, newField];
    _store.dispatch({ type: actionType, payload: { id: s.id, schema: newSchema } });
    uiState.selected = _wrapSelected(
      actionType === 'UPDATE_ACTOR' ? store.getActorById(s.id) : store.getMessageById(s.id),
      actionType === 'UPDATE_ACTOR' ? 'actor' : 'message'
    );
    _selectedKey = null; // force panel rebuild after schema change
    renderProperties();
  });
}

function _applySchemaProperties(s, actionType) {
  if (!s.schema || !s.schema.length) return;
  const props = {};
  s.schema.forEach(function(field) {
    const el = document.querySelector('[data-schema-key="' + field.key + '"]');
    if (el && field.type !== 'password') props[field.key] = el.value;
    else if (el && field.type === 'password' && el.value) props[field.key] = el.value;
  });
  if (Object.keys(props).length) {
    _store.dispatch({ type: actionType, payload: { id: s.id, properties: props } });
  }
}

const propertyVisitors = {

  actor: {
    announce: s => `Actor: ${s.label}`,
    html: s => `
    <div class="prop-group">
      <label for="p-label">Label</label>
      <input type="text" id="p-label" class="prop-input" value="${esc(s.label)}" aria-label="Actor label"/>
    </div>
    <div class="prop-group">
      <label for="p-emoji">Icon / Emoji</label>
      <input type="text" id="p-emoji" class="prop-input" value="${esc(s.emoji||'')}" placeholder="Paste any emoji, or leave blank for default" aria-label="Actor emoji icon" maxlength="4"/>
    </div>
    <div class="prop-group">
      <label for="p-atype">Type</label>
      <select id="p-atype" class="prop-select" aria-label="Actor type">
        <option value="actor-person"  ${s.type==='actor-person' ?'selected':''}>👤 Person</option>
        <option value="actor-system"  ${s.type==='actor-system' ?'selected':''}>⬜ System</option>
        <option value="actor-db"      ${s.type==='actor-db'     ?'selected':''}>🗄 Database</option>
        <option value="actor-queue"   ${s.type==='actor-queue'  ?'selected':''}>📥 Queue</option>
      </select>
    </div>
    ${_renderSchemaSection(s)}`,
    apply: s => {
      const emojiVal = document.getElementById('p-emoji')?.value?.trim();
      _store.dispatch({ type: 'UPDATE_ACTOR', payload: {
        id: s.id,
        label: document.getElementById('p-label')?.value ?? s.label,
        type: document.getElementById('p-atype')?.value ?? s.type,
        emoji: emojiVal || undefined,
      }});
      _applySchemaProperties(s, 'UPDATE_ACTOR');
      uiState.selected = _wrapSelected(store.getActorById(s.id), 'actor');
    },
    afterRender: s => { _afterRenderSchemaSection(s, 'UPDATE_ACTOR'); },
  },

  message: {
    announce: s => {
      const from = store.getActorById(s.fromId)?.label || s.fromId;
      const to   = store.getActorById(s.toId)?.label   || s.toId;
      return `Message: ${s.label} from ${from} to ${to}`;
    },
    html: s => {
      const nullOpt    = `<option value="" ${!s.fromId?'selected':''}>— unset —</option>`;
      const nullOpt2   = `<option value="" ${!s.toId?'selected':''}>— unset —</option>`;
      const actorOpts  = nullOpt  + state.actors.map(a =>
        `<option value="${a.id}" ${a.id===s.fromId?'selected':''}>${esc(a.label)}</option>`).join('');
      const actorOpts2 = nullOpt2 + state.actors.map(a =>
        `<option value="${a.id}" ${a.id===s.toId?'selected':''}>${esc(a.label)}</option>`).join('');
      return `
    <div class="prop-group">
      <label for="p-mlabel">Message Label</label>
      <input type="text" id="p-mlabel" class="prop-input" value="${esc(s.label)}" aria-label="Message label"/>
    </div>
    <div class="prop-group">
      <label for="p-from">From</label>
      <select id="p-from" class="prop-select" aria-label="Source actor">${actorOpts}</select>
    </div>
    <div class="prop-group">
      <label for="p-to">To</label>
      <select id="p-to" class="prop-select" aria-label="Target actor">${actorOpts2}</select>
    </div>
    <div class="prop-group">
      <label for="p-mkind">Kind</label>
      <select id="p-mkind" class="prop-select" aria-label="Message kind">
        <option value="sync"   ${s.kind==='sync'  ?'selected':''}>→ Synchronous</option>
        <option value="async"  ${s.kind==='async' ?'selected':''}>⇢ Asynchronous</option>
        <option value="return" ${s.kind==='return'?'selected':''}>← Return</option>
      </select>
    </div>
    <div class="prop-group">
      <label for="p-mdir">Direction</label>
      <select id="p-mdir" class="prop-select" aria-label="Arrow direction">
        <option value="right" ${(s.direction||'right')==='right'?'selected':''}>→ Right (from → to)</option>
        <option value="left"  ${(s.direction||'right')==='left' ?'selected':''}>← Left  (to → from)</option>
        <option value="both"  ${(s.direction||'right')==='both' ?'selected':''}>↔ Both  (bidirectional)</option>
      </select>
    </div>
    <div class="prop-section-label">Network Details (InfoSec)</div>
    <div class="prop-group">
      <label for="p-protocol">Protocol</label>
      <select id="p-protocol" class="prop-select" aria-label="Network protocol">
        <option value="">— none —</option>
        <option value="HTTPS">HTTPS</option>
        <option value="HTTP">HTTP</option>
        <option value="gRPC">gRPC</option>
        <option value="gRPC-TLS">gRPC-TLS</option>
        <option value="TCP">TCP</option>
        <option value="TLS">TLS</option>
        <option value="mTLS">mTLS</option>
        <option value="MQTT">MQTT</option>
        <option value="AMQP">AMQP</option>
        <option value="WebSocket">WebSocket</option>
        <option value="UDP">UDP</option>
      </select>
    </div>
    <div class="prop-group">
      <label for="p-port">Port</label>
      <input type="text" id="p-port" class="prop-input" placeholder="e.g. 443" aria-label="Port number"/>
    </div>
    <div class="prop-group">
      <label for="p-auth">Auth Mechanism</label>
      <select id="p-auth" class="prop-select" aria-label="Authentication mechanism">
        <option value="">— none —</option>
        <option value="JWT">JWT</option>
        <option value="mTLS">mTLS</option>
        <option value="API Key">API Key</option>
        <option value="OAuth2">OAuth2</option>
        <option value="SAML">SAML</option>
        <option value="Basic">Basic Auth</option>
        <option value="None">None (unauthenticated)</option>
      </select>
    </div>
    <div class="prop-group">
      <label for="p-dataclass">Data Classification</label>
      <select id="p-dataclass" class="prop-select" aria-label="Data classification">
        <option value="">— unset —</option>
        <option value="Public">&#x1F7E2; Public</option>
        <option value="Internal">&#x1F7E1; Internal</option>
        <option value="Confidential">&#x1F7E0; Confidential</option>
        <option value="PII">&#x1F534; PII</option>
        <option value="PHI">&#x1F534; PHI</option>
        <option value="Secret">&#x26AB; Secret</option>
        </select>
    ${_renderSchemaSection(s)}`;
    },
    apply: s => {
      _store.dispatch({ type: 'UPDATE_MESSAGE', payload: {
        id:        s.id,
        label:     document.getElementById('p-mlabel')?.value,
        fromId:    document.getElementById('p-from')?.value   || null,
        toId:      document.getElementById('p-to')?.value     || null,
        kind:      document.getElementById('p-mkind')?.value,
        direction: document.getElementById('p-mdir')?.value,
        protocol:  document.getElementById('p-protocol')?.value || undefined,
        port:      document.getElementById('p-port')?.value     || undefined,
        auth:      document.getElementById('p-auth')?.value     || undefined,
        dataClass: document.getElementById('p-dataclass')?.value|| undefined,
      }});
      _applySchemaProperties(s, 'UPDATE_MESSAGE');
      uiState.selected = _wrapSelected(store.getMessageById(s.id), 'message');
    },
    // Post-render hook: set network field values (select.value must be set after innerHTML)
    afterRender: s => {
      const sel = (id, val) => { const e = document.getElementById(id); if (e && val) e.value = val; };
      sel('p-protocol', s.protocol);
      sel('p-port', s.port);
      sel('p-auth', s.auth);
      sel('p-dataclass',s.dataClass);
      _afterRenderSchemaSection(s, 'UPDATE_MESSAGE');
    },
  },

  note: {
    announce: s => `Note: ${s.text}`,
    html: s => `
    <div class="prop-group">
      <label for="p-ntext">Text</label>
      <textarea id="p-ntext" class="prop-textarea" aria-label="Note text">${esc(s.text)}</textarea>
    </div>`,
    apply: s => {
      _store.dispatch({ type: 'UPDATE_NOTE', payload: {
        id:   s.id,
        text: document.getElementById('p-ntext')?.value,
      }});
      uiState.selected = _wrapSelected(store.getNoteById(s.id), 'note');
    },
  },

  fragment: {
    announce: s => `Fragment: ${s.kind.replace('frag-','')} — ${s.cond}`,
    html: s => `
    <div class="prop-group">
      <label for="p-fkind">Fragment Type</label>
      <select id="p-fkind" class="prop-select" aria-label="Fragment type">
        <option value="frag-alt"  ${s.kind==='frag-alt' ?'selected':''}>alt — Alternative</option>
        <option value="frag-loop" ${s.kind==='frag-loop'?'selected':''}>loop — Loop</option>
        <option value="frag-opt"  ${s.kind==='frag-opt' ?'selected':''}>opt — Optional</option>
      </select>
    </div>
    <div class="prop-group">
      <label for="p-fcond">Condition</label>
      <input type="text" id="p-fcond" class="prop-input" value="${esc(s.cond)}" aria-label="Fragment condition"/>
    </div>`,
    apply: s => {
      _store.dispatch({ type: 'UPDATE_FRAGMENT', payload: {
        id:   s.id,
        kind: document.getElementById('p-fkind')?.value,
        cond: document.getElementById('p-fcond')?.value,
      }});
      uiState.selected = _wrapSelected(store.getFragmentById(s.id), 'fragment');
    },
  },
};
// @@EVENTS-END