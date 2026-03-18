// ═══════════════════════════════════════════════════════
//  SequenceForge — DiagramStore
//  Version: 0.6.0-pre
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
//    store.state          — { actors, messages, notes, fragments, nextId }
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
const ACTOR_W     = 110   // matches HTML app constant
const ACTOR_GAP   = 60    // gap between actors
const UNDO_LIMIT  = 50    // max snapshot stack depth

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
    actors:    [],
    messages:  [],
    notes:     [],
    fragments: [],
    nextId:    1,
  }

  // Full action log — every dispatched action, in order.
  // Undo scanner reads this; debug tools read this; export reads this.
  const log = []

  // Snapshot stack for undo.
  // Each entry is a deep-clone of state at the moment before a
  // undoable mutation. Capped at UNDO_LIMIT entries.
  const _snapshots = []

  // Redo stack — captures the state displaced by each UNDO.
  // Cleared on any new undoable mutation (branching history invalidates forward stack).
  // Capped at UNDO_LIMIT entries.
  const _redoStack = []

  // Event listeners: { [eventName]: Set<fn> }
  const _listeners = {}

  // ── Private utilities ───────────────────────────────────

  /** Monotonic id generator. Produces 'e1', 'e2', etc. */
  function uid() {
    return 'e' + (state.nextId++)
  }

  /**
   * Returns the x position for the next actor.
   * First actor lands at x:40. Each subsequent actor is placed
   * ACTOR_W + ACTOR_GAP to the right of the rightmost existing actor.
   */
  function getNextActorX() {
    if (!state.actors.length) return 40
    const maxX = Math.max(...state.actors.map(a => a.x))
    return maxX + ACTOR_W + ACTOR_GAP
  }

  /** Deep-clones diagram data only — not log, not snapshots. */
  function snapshot() {
    return JSON.parse(JSON.stringify({
      actors:    state.actors,
      messages:  state.messages,
      notes:     state.notes,
      fragments: state.fragments,
      nextId:    state.nextId,
    }))
  }

  /** Restores state from a snapshot object. Mutates state in place. */
  function restoreSnapshot(snap) {
    state.actors    = snap.actors
    state.messages  = snap.messages
    state.notes     = snap.notes
    state.fragments = snap.fragments
    state.nextId    = snap.nextId
  }

  /**
   * Pushes a snapshot onto the undo stack before a mutation.
   * Must be called BEFORE the mutation, never after.
   * Enforces UNDO_LIMIT by dropping the oldest entry.
   * Clears _redoStack — any new undoable mutation invalidates the forward history.
   */
  function pushSnapshot() {
    _snapshots.push(snapshot())
    if (_snapshots.length > UNDO_LIMIT) _snapshots.shift()
    _redoStack.length = 0  // new branch — forward history is gone
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
        id:    uid(),
        x:     payload.x ?? getNextActorX(),
        label: payload.label || 'Actor',
        type:  payload.type  || 'actor-system',
        ...(payload.emoji !== undefined ? { emoji: payload.emoji } : {}),
      }
      state.actors.push(actor)
      emit('actor:added', actor)
    },

    MOVE_ACTOR({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const actor = state.actors.find(a => a.id === payload.id)
      if (!actor) return
      actor.x = payload.x
      emit('actor:moved', actor)
    },

    REFLOW_ACTORS({ payload, meta }) {
      // payload.positions: [{ id, x }, ...]
      // One snapshot covers the entire reflow — one Ctrl+Z undoes all moves.
      if (meta.undoable) pushSnapshot()
      for (const { id, x } of payload.positions) {
        const actor = state.actors.find(a => a.id === id)
        if (actor) actor.x = x
      }
      emit('actors:reflowed', state.actors)
    },

    UPDATE_ACTOR({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const actor = state.actors.find(a => a.id === payload.id)
      if (!actor) return
      // Partial patch — only provided fields are updated
      if (payload.label !== undefined) actor.label = payload.label
      if (payload.type  !== undefined) actor.type  = payload.type
      if (payload.emoji !== undefined) actor.emoji = payload.emoji
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
      state.actors   = state.actors.filter(a => a.id !== id)
      state.messages = state.messages.filter(m => m.fromId !== id && m.toId !== id)
      emit('actor:deleted', id)
      if (orphanedIds.length) emit('messages:orphaned', orphanedIds)
    },

    // ── Messages ─────────────────────────────────────────

    ADD_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const message = {
        id:        uid(),
        fromId:    payload.fromId,
        toId:      payload.toId,
        label:     payload.label     || 'message',
        kind:      payload.kind      || 'sync',
        direction: payload.direction || 'right',
        y:         0,  // render pipeline assigns real y
        // Network fields — only stored if provided
        ...(payload.protocol  ? { protocol:  payload.protocol  } : {}),
        ...(payload.port      ? { port:      payload.port      } : {}),
        ...(payload.auth      ? { auth:      payload.auth      } : {}),
        ...(payload.dataClass ? { dataClass: payload.dataClass } : {}),
      }
      state.messages.push(message)
      emit('message:added', message)
    },

    MOVE_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const message = state.messages.find(m => m.id === payload.id)
      if (!message) return
      message.y = payload.y
      emit('message:moved', message)
    },

    UPDATE_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const message = state.messages.find(m => m.id === payload.id)
      if (!message) return
      // Partial patch — only provided fields are updated
      const fields = ['label', 'fromId', 'toId', 'kind', 'direction',
                      'protocol', 'port', 'auth', 'dataClass']
      for (const field of fields) {
        if (payload[field] !== undefined) message[field] = payload[field]
      }
      emit('message:updated', message)
    },

    DELETE_MESSAGE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      state.messages = state.messages.filter(m => m.id !== payload.id)
      emit('message:deleted', payload.id)
    },

    // ── Notes ─────────────────────────────────────────────

    ADD_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const note = {
        id:   uid(),
        x:    payload.x    ?? 60,
        y:    payload.y    ?? 200,
        text: payload.text || 'note',
      }
      state.notes.push(note)
      emit('note:added', note)
    },

    MOVE_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const note = state.notes.find(n => n.id === payload.id)
      if (!note) return
      note.x = payload.x
      note.y = payload.y
      emit('note:moved', note)
    },

    UPDATE_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const note = state.notes.find(n => n.id === payload.id)
      if (!note) return
      if (payload.text !== undefined) note.text = payload.text
      emit('note:updated', note)
    },

    DELETE_NOTE({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      state.notes = state.notes.filter(n => n.id !== payload.id)
      emit('note:deleted', payload.id)
    },

    // ── Fragments ─────────────────────────────────────────

    ADD_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = {
        id:   uid(),
        x:    payload.x    ?? 60,
        y:    payload.y    ?? 200,
        w:    payload.w    ?? 200,
        h:    payload.h    ?? 100,
        kind: payload.kind || 'frag-alt',
        cond: payload.cond || 'condition',
      }
      state.fragments.push(fragment)
      emit('fragment:added', fragment)
    },

    MOVE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = state.fragments.find(f => f.id === payload.id)
      if (!fragment) return
      fragment.x = payload.x
      fragment.y = payload.y
      emit('fragment:moved', fragment)
    },

    RESIZE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = state.fragments.find(f => f.id === payload.id)
      if (!fragment) return
      fragment.w = payload.w
      fragment.h = payload.h
      emit('fragment:resized', fragment)
    },

    UPDATE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      const fragment = state.fragments.find(f => f.id === payload.id)
      if (!fragment) return
      if (payload.kind !== undefined) fragment.kind = payload.kind
      if (payload.cond !== undefined) fragment.cond = payload.cond
      emit('fragment:updated', fragment)
    },

    DELETE_FRAGMENT({ payload, meta }) {
      if (meta.undoable) pushSnapshot()
      state.fragments = state.fragments.filter(f => f.id !== payload.id)
      emit('fragment:deleted', payload.id)
    },

    // ── History ───────────────────────────────────────────

    UNDO() {
      // UNDO is never logged — handled before log.push() in dispatch()
      if (!_snapshots.length) return
      // Capture current state onto redo stack before restoring
      _redoStack.push(snapshot())
      if (_redoStack.length > UNDO_LIMIT) _redoStack.shift()
      const snap = _snapshots.pop()
      restoreSnapshot(snap)
      emit('state:restored', { ...snapshot(), direction: 'undo' })
    },

    REDO() {
      // REDO is never logged
      if (!_redoStack.length) return
      // Capture current state onto undo stack so the redo itself is undoable
      _snapshots.push(snapshot())
      if (_snapshots.length > UNDO_LIMIT) _snapshots.shift()
      const snap = _redoStack.pop()
      restoreSnapshot(snap)
      emit('state:restored', { ...snapshot(), direction: 'redo' })
    },

    // ── Bulk / Session ────────────────────────────────────

    CLEAR_DIAGRAM({ meta }) {
      if (meta.undoable) pushSnapshot()
      state.actors    = []
      state.messages  = []
      state.notes     = []
      state.fragments = []
      state.nextId    = 1
      emit('diagram:cleared')
    },

    LOAD_DIAGRAM({ payload }) {
      // LOAD_DIAGRAM clears both stacks — new baseline.
      // Always non-undoable (callers should not pass meta.undoable: true).
      // payload._source — optional caller hint: 'localStorage' | 'import' | undefined
      // The store strips _source before it reaches state; it is only forwarded in the event.
      _snapshots.length = 0
      _redoStack.length = 0
      state.actors    = payload.actors    || []
      state.messages  = payload.messages  || []
      state.notes     = payload.notes     || []
      state.fragments = payload.fragments || []
      state.nextId    = payload.nextId    || 1
      emit('diagram:loaded', { ...snapshot(), source: payload._source || 'import' })
    },

    LOAD_DEMO() {
      // Hardcoded demo — delegates to LOAD_DIAGRAM logic directly
      // so both stacks are also cleared
      _snapshots.length = 0
      _redoStack.length = 0

      // Temporary nextId counter for demo construction — start from current nextId
      // so demo ids never collide with ids already assigned in this session.
      let tempId = state.nextId
      const tid = () => 'e' + (tempId++)

      const user  = { id: tid(), x: 40,  label: 'User',         type: 'actor-person' }
      const api   = { id: tid(), x: 210, label: 'API Gateway',   type: 'actor-system' }
      const auth  = { id: tid(), x: 380, label: 'Auth Service',  type: 'actor-system' }
      const db    = { id: tid(), x: 550, label: 'Database',      type: 'actor-db'     }

      state.actors = [user, api, auth, db]
      state.messages = [
        { id: tid(), fromId: user.id, toId: api.id,  label: 'POST /login',         kind: 'sync',   direction: 'right', y: 0 },
        { id: tid(), fromId: api.id,  toId: auth.id, label: 'validateCredentials',  kind: 'sync',   direction: 'right', y: 0 },
        { id: tid(), fromId: auth.id, toId: db.id,   label: 'SELECT user WHERE…',   kind: 'sync',   direction: 'right', y: 0 },
        { id: tid(), fromId: db.id,   toId: auth.id, label: 'user record',           kind: 'return', direction: 'right', y: 0 },
        { id: tid(), fromId: auth.id, toId: api.id,  label: 'JWT token',             kind: 'return', direction: 'right', y: 0 },
        { id: tid(), fromId: api.id,  toId: user.id, label: '200 OK + token',        kind: 'return', direction: 'right', y: 0 },
      ]
      state.fragments = [
        { id: tid(), x: 160, y: 170, w: 340, h: 175, kind: 'frag-alt', cond: 'valid credentials' }
      ]
      state.notes = [
        { id: tid(), x: 20, y: 0, text: 'Auth flow' }
      ]
      state.nextId = tempId

      emit('diagram:loaded', { ...snapshot(), source: 'demo' })
    },
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
      undoable:  rawMeta.undoable !== false,  // default true
      timestamp: Date.now(),
      ...rawMeta,
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
    } catch(err) {
      // Roll back the log entry — a failed handler must not leave a phantom entry.
      // The snapshot (if any) is still on the stack; undo remains consistent.
      if (!skipLog) log.pop()
      console.error(`[store] Handler for ${type} threw — log entry removed.`, err)
    }
  }

  // ── Public interface ─────────────────────────────────────
  return {
    state,   // live reference — mutations are visible immediately
    log,     // full action log — live reference
    dispatch,
    on,
    off,
    get canUndo() { return _snapshots.length > 0 },  // true when undo stack is non-empty
    get canRedo()  { return _redoStack.length  > 0 },  // true when redo stack is non-empty
  }
}

// ── CommonJS export ──────────────────────────────────────
// Compatible with Node (tests) and browser script tags via bundler.
// In the single-file HTML app, paste the module body inline and
// replace this block with: const { createStore, ... } = (() => { ... })()
module.exports = {
  createStore,
  nextMessageKind,
  nextMessageDirection,
}
