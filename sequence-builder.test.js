// ═══════════════════════════════════════════════════════
//  SequenceForge — Store Contract Tests
//  Version: 0.6.0-pre
//  Run:     node sequence-builder.test.js
//  Deps:    none
//
//  These tests are written against the INTENDED store API.
//  They all fail until sequence-builder.store.js is implemented.
//  Passing all five is the exit criterion for Phase 1.
//
//  Test order is intentional — each test forces a specific
//  piece of the store to exist before the next test needs it.
// ═══════════════════════════════════════════════════════

// ── Minimal test harness (no deps) ──────────────────────
let _passed = 0
let _failed = 0
let _total  = 0

function test(description, fn) {
  _total++
  try {
    fn()
    console.log(`  ✓  ${description}`)
    _passed++
  } catch (err) {
    console.log(`  ✗  ${description}`)
    console.log(`       ${err.message}`)
    _failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    )
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) {
    throw new Error(message || `Expected ${b}, got ${a}`)
  }
}

// ── Import store ─────────────────────────────────────────
// This import will fail until sequence-builder.store.js exists.
// That is the point — tests define the contract first.
let createStore
try {
  // Node-compatible import — store must export createStore as CommonJS
  // or ESM depending on implementation choice.
  // Recommended: module.exports = { createStore }
  ;({ createStore } = require('./sequence-builder.store.js'))
} catch (err) {
  console.log('\n  FATAL: sequence-builder.store.js not found or failed to load.')
  console.log(`  ${err.message}`)
  console.log('\n  This is expected — tests are written before the implementation.')
  console.log('  Implement the store, then run this file again.\n')
  process.exit(1)
}

// Each test gets a fresh store instance — no shared state between tests
function freshStore() {
  return createStore()
}

// ═══════════════════════════════════════════════════════
//  SUITE 1 — ADD_ACTOR
//
//  Forces: dispatch(), store.state.actors, uid(), getNextActorX()
// ═══════════════════════════════════════════════════════
console.log('\nSuite 1 — ADD_ACTOR')

test('dispatching ADD_ACTOR appends one actor to state.actors', () => {
  const store = freshStore()

  store.dispatch({
    type:    'ADD_ACTOR',
    payload: { label: 'User', type: 'actor-person' },
  })

  assertEqual(store.state.actors.length, 1, 'expected 1 actor')
})

test('dispatching ADD_ACTOR assigns a unique id', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  assert(a.id !== b.id, `expected unique ids, got ${a.id} and ${b.id}`)
})

test('dispatching ADD_ACTOR increments nextId', () => {
  const store = freshStore()
  const before = store.state.nextId

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'X', type: 'actor-system' } })

  assert(store.state.nextId > before, 'nextId should increment after ADD_ACTOR')
})

test('dispatching ADD_ACTOR places actors at non-overlapping x positions', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  assert(b.x > a.x, `second actor x (${b.x}) should be greater than first (${a.x})`)
})

test('dispatching ADD_ACTOR stores optional emoji field', () => {
  const store = freshStore()

  store.dispatch({
    type:    'ADD_ACTOR',
    payload: { label: 'Bot', type: 'actor-system', emoji: '🤖' },
  })

  assertEqual(store.state.actors[0].emoji, '🤖', 'emoji should be stored on actor')
})

test('dispatching ADD_ACTOR honours payload.x when provided', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system', x: 350 } })

  assertEqual(store.state.actors[0].x, 350, 'actor should land at payload.x when supplied')
})

test('dispatching ADD_ACTOR falls back to getNextActorX() when payload.x is absent', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  assert(b.x > a.x, 'second actor without payload.x should be placed to the right of first')
})

test('REFLOW_ACTORS repositions all actors in one undoable step', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'C', type: 'actor-system' } })

  const [a, b, c] = store.state.actors

  store.dispatch({ type: 'REFLOW_ACTORS', payload: { positions: [
    { id: a.id, x: 40  },
    { id: b.id, x: 210 },
    { id: c.id, x: 380 },
  ]}})

  assertEqual(store.state.actors.find(ac => ac.id === a.id).x, 40,  'A at 40')
  assertEqual(store.state.actors.find(ac => ac.id === b.id).x, 210, 'B at 210')
  assertEqual(store.state.actors.find(ac => ac.id === c.id).x, 380, 'C at 380')
})

test('REFLOW_ACTORS is undone in a single UNDO step', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  const origA = a.x, origB = b.x

  store.dispatch({ type: 'REFLOW_ACTORS', payload: { positions: [
    { id: a.id, x: 999 },
    { id: b.id, x: 1200 },
  ]}})

  store.dispatch({ type: 'UNDO' })

  assertEqual(store.state.actors.find(ac => ac.id === a.id).x, origA, 'A restored by single UNDO')
  assertEqual(store.state.actors.find(ac => ac.id === b.id).x, origB, 'B restored by single UNDO')
})

// ═══════════════════════════════════════════════════════
//  SUITE 2 — DELETE_ACTOR cascade
//
//  Forces: cascade delete logic — orphaned messages removed
//  This is the most important invariant in the store.
// ═══════════════════════════════════════════════════════
console.log('\nSuite 2 — DELETE_ACTOR cascade')

test('dispatching DELETE_ACTOR removes the actor', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  const id = store.state.actors[0].id

  store.dispatch({ type: 'DELETE_ACTOR', payload: { id } })

  assertEqual(store.state.actors.length, 0, 'actor should be removed')
})

test('dispatching DELETE_ACTOR removes messages where actor is fromId', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  store.dispatch({
    type:    'ADD_MESSAGE',
    payload: { fromId: a.id, toId: b.id, kind: 'sync', label: 'call' },
  })

  assertEqual(store.state.messages.length, 1, 'setup: message should exist')

  store.dispatch({ type: 'DELETE_ACTOR', payload: { id: a.id } })

  assertEqual(
    store.state.messages.length, 0,
    'message with deleted actor as fromId should be removed'
  )
})

test('dispatching DELETE_ACTOR removes messages where actor is toId', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  store.dispatch({
    type:    'ADD_MESSAGE',
    payload: { fromId: a.id, toId: b.id, kind: 'sync', label: 'call' },
  })

  store.dispatch({ type: 'DELETE_ACTOR', payload: { id: b.id } })

  assertEqual(
    store.state.messages.length, 0,
    'message with deleted actor as toId should be removed'
  )
})

test('dispatching DELETE_ACTOR leaves unrelated messages intact', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'C', type: 'actor-system' } })

  const [a, b, c] = store.state.actors
  store.dispatch({
    type:    'ADD_MESSAGE',
    payload: { fromId: a.id, toId: b.id, kind: 'sync', label: 'a-to-b' },
  })
  store.dispatch({
    type:    'ADD_MESSAGE',
    payload: { fromId: b.id, toId: c.id, kind: 'sync', label: 'b-to-c' },
  })

  // Delete actor A — only the a-to-b message should go
  store.dispatch({ type: 'DELETE_ACTOR', payload: { id: a.id } })

  assertEqual(store.state.messages.length, 1, 'b-to-c message should survive')
  assertEqual(store.state.messages[0].label, 'b-to-c', 'surviving message should be b-to-c')
})

// ═══════════════════════════════════════════════════════
//  SUITE 3 — UPDATE_MESSAGE partial patch
//
//  Forces: partial update logic — untouched fields preserved
//  Critical: UPDATE_MESSAGE must not clobber fields not in payload
// ═══════════════════════════════════════════════════════
console.log('\nSuite 3 — UPDATE_MESSAGE partial patch')

test('dispatching UPDATE_MESSAGE changes only the provided fields', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  store.dispatch({
    type:    'ADD_MESSAGE',
    payload: { fromId: a.id, toId: b.id, kind: 'sync', label: 'original', direction: 'right' },
  })

  const id = store.state.messages[0].id

  // Only update the label — kind, direction, fromId, toId must be untouched
  store.dispatch({
    type:    'UPDATE_MESSAGE',
    payload: { id, label: 'updated' },
  })

  const m = store.state.messages[0]
  assertEqual(m.label,     'updated', 'label should be updated')
  assertEqual(m.kind,      'sync',    'kind should be untouched')
  assertEqual(m.direction, 'right',   'direction should be untouched')
  assertEqual(m.fromId,    a.id,      'fromId should be untouched')
  assertEqual(m.toId,      b.id,      'toId should be untouched')
})

test('dispatching UPDATE_MESSAGE with network fields stores them correctly', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a, b] = store.state.actors
  store.dispatch({
    type:    'ADD_MESSAGE',
    payload: { fromId: a.id, toId: b.id, kind: 'sync', label: 'call' },
  })

  const id = store.state.messages[0].id

  store.dispatch({
    type:    'UPDATE_MESSAGE',
    payload: { id, protocol: 'HTTPS', port: '443', auth: 'JWT', dataClass: 'PII' },
  })

  const m = store.state.messages[0]
  assertEqual(m.protocol,  'HTTPS', 'protocol should be stored')
  assertEqual(m.port,      '443',   'port should be stored')
  assertEqual(m.auth,      'JWT',   'auth should be stored')
  assertEqual(m.dataClass, 'PII',   'dataClass should be stored')
})

test('nextMessageKind helper cycles sync → async → return → sync', () => {
  // Pure helper — no store needed, importable separately
  let nextMessageKind
  try {
    ;({ nextMessageKind } = require('./sequence-builder.store.js'))
  } catch(e) {
    assert(false, 'nextMessageKind not exported from store module')
  }

  assertEqual(nextMessageKind('sync'),   'async',  'sync → async')
  assertEqual(nextMessageKind('async'),  'return', 'async → return')
  assertEqual(nextMessageKind('return'), 'sync',   'return → sync')
  assertEqual(nextMessageKind('bogus'),  'sync',   'unknown → sync (safe default)')
})

test('nextMessageDirection helper cycles right → left → both → right', () => {
  let nextMessageDirection
  try {
    ;({ nextMessageDirection } = require('./sequence-builder.store.js'))
  } catch(e) {
    assert(false, 'nextMessageDirection not exported from store module')
  }

  assertEqual(nextMessageDirection('right'), 'left',  'right → left')
  assertEqual(nextMessageDirection('left'),  'both',  'left → both')
  assertEqual(nextMessageDirection('both'),  'right', 'both → right')
  assertEqual(nextMessageDirection('bogus'), 'right', 'unknown → right (safe default)')
})

// ═══════════════════════════════════════════════════════
//  SUITE 4 — meta.undoable = false
//
//  Forces: action log structure, meta stamping, undo scanner filter
//  Validates: mid-drag actions are logged but invisible to undo
// ═══════════════════════════════════════════════════════
console.log('\nSuite 4 — meta.undoable = false')

test('every dispatched action appears in the action log', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  assertEqual(store.log.length, 2, 'both actions should be in the log')
})

test('actions default to undoable: true when meta is not provided', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })

  const entry = store.log[0]
  assert(entry.meta.undoable !== false, 'action without meta should be undoable')
})

test('actions with meta.undoable: false appear in log but not in undo history', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })

  const [a] = store.state.actors

  // Simulate mid-drag: non-undoable move
  store.dispatch({
    type:    'MOVE_ACTOR',
    payload: { id: a.id, x: 200 },
    meta:    { undoable: false },
  })
  store.dispatch({
    type:    'MOVE_ACTOR',
    payload: { id: a.id, x: 300 },
    meta:    { undoable: false },
  })

  // All 4 actions in the full log
  assertEqual(store.log.length, 4, 'all 4 actions should be in the full log')

  // Only 2 undoable actions in the undo history
  const undoable = store.log.filter(e => e.meta.undoable !== false)
  assertEqual(undoable.length, 2, 'only 2 undoable entries should exist')
})

test('dispatch stamps meta.timestamp on every action', () => {
  const store = freshStore()
  const before = Date.now()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })

  const after = Date.now()
  const ts = store.log[0].meta.timestamp

  assert(ts >= before && ts <= after, `timestamp ${ts} should be between ${before} and ${after}`)
})

// ═══════════════════════════════════════════════════════
//  SUITE 5 — UNDO
//
//  Forces: undo stack logic, state restoration, undo scanner
//  The most complex suite — builds on all prior suites passing
// ═══════════════════════════════════════════════════════
console.log('\nSuite 5 — UNDO')

test('dispatching UNDO after ADD_ACTOR removes the actor', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  assertEqual(store.state.actors.length, 1, 'setup: actor should exist')

  store.dispatch({ type: 'UNDO' })

  assertEqual(store.state.actors.length, 0, 'actor should be removed after undo')
})

test('dispatching UNDO restores state before a DELETE_ACTOR', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })
  store.dispatch({
    type:    'ADD_MESSAGE',
    payload: { fromId: store.state.actors[0].id, toId: store.state.actors[1].id,
               kind: 'sync', label: 'call' },
  })

  // Delete actor A (cascades to message)
  const deletedId = store.state.actors[0].id
  store.dispatch({ type: 'DELETE_ACTOR', payload: { id: deletedId } })

  assertEqual(store.state.actors.length,  1, 'setup: one actor after delete')
  assertEqual(store.state.messages.length, 0, 'setup: message cascaded away')

  store.dispatch({ type: 'UNDO' })

  assertEqual(store.state.actors.length,   2, 'both actors restored')
  assertEqual(store.state.messages.length, 1, 'cascaded message restored')
})

test('dispatching UNDO skips non-undoable actions', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  const id = store.state.actors[0].id

  // Two non-undoable mid-drag moves
  store.dispatch({ type: 'MOVE_ACTOR', payload: { id, x: 200 }, meta: { undoable: false } })
  store.dispatch({ type: 'MOVE_ACTOR', payload: { id, x: 300 }, meta: { undoable: false } })

  // One undo should skip both moves and undo the ADD_ACTOR
  store.dispatch({ type: 'UNDO' })

  assertEqual(store.state.actors.length, 0, 'undo should skip non-undoable moves and remove actor')
})

test('dispatching UNDO when log is empty does not throw', () => {
  const store = freshStore()

  // Should be a no-op, not an exception
  let threw = false
  try {
    store.dispatch({ type: 'UNDO' })
  } catch (e) {
    threw = true
  }

  assert(!threw, 'UNDO on empty log should not throw')
  assertEqual(store.state.actors.length, 0, 'state should remain empty')
})

test('multiple UNDO steps walk back through history correctly', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'C', type: 'actor-system' } })

  assertEqual(store.state.actors.length, 3, 'setup: 3 actors')

  store.dispatch({ type: 'UNDO' })
  assertEqual(store.state.actors.length, 2, 'after 1 undo: 2 actors')

  store.dispatch({ type: 'UNDO' })
  assertEqual(store.state.actors.length, 1, 'after 2 undos: 1 actor')

  store.dispatch({ type: 'UNDO' })
  assertEqual(store.state.actors.length, 0, 'after 3 undos: 0 actors')
})

// ═══════════════════════════════════════════════════════
//  SUITE 6 — REDO
//
//  Forces: redo stack logic, branching history invalidation,
//  redo-is-undoable, canRedo getter, empty-stack safety
//  Depends on Suite 5 (UNDO) passing.
// ═══════════════════════════════════════════════════════
console.log('\nSuite 6 — REDO')

test('dispatching REDO after UNDO restores the undone state', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  const id = store.state.actors[0].id
  store.dispatch({ type: 'UNDO' })
  assertEqual(store.state.actors.length, 0, 'setup: actor removed by undo')

  store.dispatch({ type: 'REDO' })

  assertEqual(store.state.actors.length, 1, 'actor restored by redo')
  assertEqual(store.state.actors[0].id,  id, 'restored actor has same id')
})

test('dispatching REDO when stack is empty does not throw', () => {
  const store = freshStore()

  let threw = false
  try {
    store.dispatch({ type: 'REDO' })
  } catch (e) {
    threw = true
  }

  assert(!threw, 'REDO on empty stack should not throw')
  assertEqual(store.state.actors.length, 0, 'state should remain empty')
})

test('new mutation after UNDO clears the redo stack (branching history)', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })
  store.dispatch({ type: 'UNDO' })

  assert(store.canRedo, 'setup: redo stack should be non-empty after undo')

  // New mutation — branches history, redo stack must be cleared
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'C', type: 'actor-system' } })

  assert(!store.canRedo, 'redo stack should be cleared after new mutation')

  // REDO should be a no-op
  store.dispatch({ type: 'REDO' })
  assertEqual(store.state.actors.length, 2, 'redo is no-op — only A and C exist')
  assertEqual(store.state.actors[1].label, 'C', 'second actor is C not B')
})

test('UNDO after REDO works — redo step is itself undoable', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'UNDO' })
  store.dispatch({ type: 'REDO' })

  assertEqual(store.state.actors.length, 1, 'setup: redo restored actor')

  store.dispatch({ type: 'UNDO' })

  assertEqual(store.state.actors.length, 0, 'undo after redo removes the actor again')
})

test('canRedo getter reflects redo stack depth', () => {
  const store = freshStore()

  assert(!store.canRedo, 'canRedo is false on fresh store')

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  assert(!store.canRedo, 'canRedo is false before any undo')

  store.dispatch({ type: 'UNDO' })
  assert(store.canRedo,  'canRedo is true after undo')

  store.dispatch({ type: 'REDO' })
  assert(!store.canRedo, 'canRedo is false after redo exhausts stack')
})

test('multiple REDO steps walk forward through history correctly', () => {
  const store = freshStore()

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'C', type: 'actor-system' } })

  store.dispatch({ type: 'UNDO' })
  store.dispatch({ type: 'UNDO' })
  store.dispatch({ type: 'UNDO' })
  assertEqual(store.state.actors.length, 0, 'setup: all undone')

  store.dispatch({ type: 'REDO' })
  assertEqual(store.state.actors.length, 1, 'after 1 redo: 1 actor')

  store.dispatch({ type: 'REDO' })
  assertEqual(store.state.actors.length, 2, 'after 2 redos: 2 actors')

  store.dispatch({ type: 'REDO' })
  assertEqual(store.state.actors.length, 3, 'after 3 redos: 3 actors')
})

test('state:restored event carries direction field', () => {
  const store = freshStore()
  let lastRestoreDir = null

  store.on('state:restored', p => { lastRestoreDir = p.direction })

  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-system' } })
  store.dispatch({ type: 'UNDO' })
  assertEqual(lastRestoreDir, 'undo', 'state:restored direction is undo after UNDO')

  store.dispatch({ type: 'REDO' })
  assertEqual(lastRestoreDir, 'redo', 'state:restored direction is redo after REDO')
})

// ═══════════════════════════════════════════════════════
//  Suite 7 — _parseUML (PlantUML + Mermaid parser)
// ═══════════════════════════════════════════════════════

// Inline the parser so it runs in Node without a browser
// (mirrors sequence-builder.html _parseUML exactly)
function _parseUML(text) {
  if (!text || !text.trim()) throw new Error('Empty input');

  const lines = text.split(/\r?\n/);

  // Detect format
  const isMermaid  = lines.some(l => /^\s*sequenceDiagram\s*$/i.test(l));
  const isPlantUML = !isMermaid && (
    lines.some(l => /^\s*@startuml/i.test(l)) ||
    lines.some(l => /--?>?>?\s/.test(l) || /<--?-?\s/.test(l))
  );

  if (!isMermaid && !isPlantUML) {
    throw new Error(
      'Format not recognised. Start with "@startuml" (PlantUML) or "sequenceDiagram" (Mermaid).'
    );
  }

  const aliasMap   = {};
  const actorOrder = [];
  const warnings   = [];   // { lineNum, raw, hint }

  function resolveActor(raw) {
    const trimmed = raw.trim();
    const label   = aliasMap[trimmed] ?? trimmed;
    if (!actorOrder.includes(label)) actorOrder.push(label);
    return label;
  }

  function registerActor(labelRaw, alias) {
    const disp = labelRaw.replace(/^["']|["']$/g, '').trim();
    const key  = (alias || disp).trim();
    aliasMap[key] = disp;
    if (!actorOrder.includes(disp)) actorOrder.push(disp);
  }

  const messages = [];

  // Declaration: participant/actor, with optional 'as Alias'
  const DECL_RE = /^\s*(?:participant|actor)\s+(.+?)(?:\s+as\s+(\S+))?\s*$/i;

  // Arrow: optional label after colon; no-space Mermaid style supported
  const ARROW_RE = /^\s*([^<>\-\s][^\s<>\-]*|[^<>\-\s])\s*(<-->|<->|--?>>?|<--?>>?|<--?-?|->|<-)\s*([^:\s]+)(?:\s*:\s*(.*?))?\s*$/;

  // Known directives to skip silently (not user-authored diagram content)
  const SKIP_RE = /^(@startuml|@enduml|sequenceDiagram|title\s|note\s|end\s|loop\s|alt\s|else\s|opt\s|group\s|box\s|skinparam\s|autonumber|activate\s|deactivate\s|return$)/i;

  lines.forEach(function(raw, idx) {
    var lineNum = idx + 1;
    // Strip line comments
    var line = raw.replace(/^\s*'.*$/, '').replace(/^\s*\/\/.*$/, '').trim();
    if (!line) return;
    if (SKIP_RE.test(line)) return;

    var decl = DECL_RE.exec(line);
    if (decl) {
      var labelPart = decl[1].trim();
      // Warn if looks like 'actor Label ShortAlias' without 'as' keyword
      if (!decl[2] && /\s/.test(labelPart) && !/^["']/.test(labelPart)) {
        var tokens = labelPart.split(/\s+/);
        var suggestedAlias = tokens[tokens.length - 1];
        var suggestedLabel = tokens.slice(0, -1).join(' ');
        warnings.push({
          lineNum: lineNum,
          raw: raw.trim(),
          hint: 'Use "as" for aliases — e.g.: ' +
                line.split(/\s+/)[0] + ' "' + suggestedLabel + '" as ' + suggestedAlias
        });
      }
      registerActor(decl[1], decl[2]);
      return;
    }

    var arrow = ARROW_RE.exec(line);
    if (arrow) {
      var a        = arrow[1];
      var arrowStr = arrow[2];
      var b        = arrow[3];
      var msgLabel = arrow[4];
      var isBidirectional = arrowStr === '<->' || arrowStr === '<-->';
      var isLeftward      = !isBidirectional && arrowStr.charAt(0) === '<';
      var from = resolveActor(isLeftward ? b : a);
      var to   = resolveActor(isLeftward ? a : b);

      var kind = 'sync';
      if (/-->>/.test(arrowStr))                             kind = 'return';
      else if (/-->/.test(arrowStr) || arrowStr === '<-->') kind = 'async';
      else if (/->>/.test(arrowStr))                        kind = 'async';

      var direction = isBidirectional ? 'both' : 'right';
      messages.push({ from: from, to: to, label: msgLabel || '', kind: kind, direction: direction });
      return;
    }

    // Not blank, not comment, not directive, not decl, not arrow — user needs to fix it
    warnings.push({ lineNum: lineNum, raw: raw.trim(), hint: null });
  });

  if (actorOrder.length === 0) {
    throw new Error('No actors found. Declare actors with:\n  participant Alice\n  participant Bob as B');
  }

  return { actors: actorOrder.map(function(l) { return { label: l }; }), messages: messages, warnings: warnings };
}

console.log('\nSuite 7 — _parseUML')

test('PlantUML: parses participant declarations and arrows', () => {
    const result = _parseUML(`
@startuml
participant Alice
participant Bob
Alice -> Bob : Hello
Bob --> Alice : Hi back
@enduml
    `)
    assertEqual(result.actors.length, 2, 'two actors parsed')
    assertEqual(result.actors[0].label, 'Alice', 'first actor is Alice')
    assertEqual(result.actors[1].label, 'Bob', 'second actor is Bob')
    assertEqual(result.messages.length, 2, 'two messages parsed')
    assertEqual(result.messages[0].from, 'Alice', 'first message from Alice')
    assertEqual(result.messages[0].to, 'Bob', 'first message to Bob')
    assertEqual(result.messages[0].kind, 'sync', 'solid arrow is sync')
    assertEqual(result.messages[1].kind, 'async', 'dashed arrow is async')
  })

  test('PlantUML: alias resolution maps arrows through declared alias', () => {
    const result = _parseUML(`
@startuml
participant "Order Service" as OS
participant "Payment Service" as PS
OS -> PS : Charge
PS -->> OS : Receipt
@enduml
    `)
    assertEqual(result.actors[0].label, 'Order Service', 'alias resolves to full label')
    assertEqual(result.messages[0].from, 'Order Service', 'from uses resolved label')
    assertEqual(result.messages[1].kind, 'return', 'double-dashed double-arrow is return')
  })

  test('PlantUML: undeclared actors in arrows are auto-created', () => {
    const result = _parseUML(`@startuml
A -> B : go
B -> C : forward
@enduml`)
    assertEqual(result.actors.length, 3, 'three actors auto-created from arrows')
  })

  test('Mermaid: parses sequenceDiagram with participant and arrows', () => {
    const result = _parseUML(`
sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: Request
  Bob-->>Alice: Response
    `)
    assertEqual(result.actors.length, 2, 'two actors from Mermaid')
    assertEqual(result.messages[0].kind, 'async', '->> is async')
    assertEqual(result.messages[1].kind, 'return', '-->> is return')
    assertEqual(result.messages[0].label, 'Request', 'message label parsed')
  })

  test('Mermaid: participant with alias resolves correctly', () => {
    const result = _parseUML(`
sequenceDiagram
  participant Alice as A
  participant Bob as B
  A->>B: ping
    `)
    assertEqual(result.actors[0].label, 'Alice', 'Mermaid alias resolves to label')
    assertEqual(result.messages[0].from, 'Alice', 'from uses resolved label')
  })

  test('throws on empty input', () => {
    let threw = false
    try { _parseUML('') } catch(e) { threw = true }
    assertEqual(threw, true, 'empty string throws')
  })

  test('throws on unrecognised format', () => {
    let threw = false
    try { _parseUML('some random text with no arrows') } catch(e) { threw = true }
    assertEqual(threw, true, 'unrecognised format throws')
})

test('basic @startuml block with -> and <- and <-> parses correctly', () => {
  const result = _parseUML(`
@startuml
participant Alice
participant Bob
Alice -> Bob : Request
Bob <- Alice : Also request
Alice <-> Bob : Bidirectional
@enduml
  `)
  assertEqual(result.actors.length, 2, 'two actors')
  assertEqual(result.actors[0].label, 'Alice', 'first actor Alice')
  assertEqual(result.actors[1].label, 'Bob', 'second actor Bob')
  assertEqual(result.messages.length, 3, 'three messages')
  assertEqual(result.messages[0].from, 'Alice', 'msg[0] from Alice')
  assertEqual(result.messages[0].to,   'Bob',   'msg[0] to Bob')
  assertEqual(result.messages[1].from, 'Alice', 'msg[1] from Alice (left arrow reverses)')
  assertEqual(result.messages[1].to,   'Bob',   'msg[1] to Bob')
  assertEqual(result.messages[2].from, 'Alice', 'msg[2] from Alice (bidirectional)')
  assertEqual(result.messages[2].to,   'Bob',   'msg[2] to Bob')
})


test('actor without "as" keyword produces a warning with a hint', () => {
  const input = '@startuml\nactor Alice a\nA -> B : go\n@enduml'
  const result = _parseUML(input)
  assertEqual(result.warnings.length > 0, true, 'produces at least one warning')
  assertEqual(result.warnings[0].hint !== null, true, 'warning includes a corrective hint')
})

test('valid input with "as" aliases and labelless arrows produces no warnings', () => {
  const input = '@startuml\nactor Alice as a\nactor Bob as b\na -> b\na <- b\na <-> b\na --> b\na <-- b\na <--> b\na <-> a\nb <-> b\n@enduml'
  const result = _parseUML(input)
  assertEqual(result.actors.length, 2, 'two actors')
  assertEqual(result.actors[0].label, 'Alice', 'first actor is Alice')
  assertEqual(result.actors[1].label, 'Bob', 'second actor is Bob')
  assertEqual(result.messages.length, 8, 'all eight arrow lines parsed')
  assertEqual(result.messages[0].from, 'Alice', 'msg[0] -> from Alice')
  assertEqual(result.messages[0].to,   'Bob',   'msg[0] -> to Bob')
  assertEqual(result.messages[1].from, 'Bob',   'msg[1] <- flipped: from Bob')
  assertEqual(result.messages[1].to,   'Alice', 'msg[1] <- flipped: to Alice')
  assertEqual(result.messages[2].direction, 'both',  'msg[2] <-> direction=both')
  assertEqual(result.messages[3].kind,      'async', 'msg[3] --> is async')
  assertEqual(result.messages[5].kind,      'async', 'msg[5] <--> is async')
  assertEqual(result.messages[5].direction, 'both',  'msg[5] <--> direction=both')
  assertEqual(result.messages[6].from, 'Alice', 'msg[6] self-message Alice->Alice')
  assertEqual(result.messages[6].to,   'Alice', 'msg[6] self-message to Alice')
  assertEqual(result.messages[7].from, 'Bob',   'msg[7] self-message Bob->Bob')
  assertEqual(result.messages[7].to,   'Bob',   'msg[7] self-message to Bob')
  assertEqual(result.warnings.length, 0, 'no warnings on clean valid input')
})

// ═══════════════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(50)}`)
console.log(`  ${_passed} passed  |  ${_failed} failed  |  ${_total} total`)
console.log(`${'─'.repeat(50)}\n`)

if (_failed > 0) {
  console.log('  Exit criterion not met — implement sequence-builder.store.js')
  console.log('  and run again until all tests pass.\n')
  process.exit(1)
} else {
  console.log('  All tests pass. Phase 1 + Phase 2 entry criterion met.')
  console.log('  Proceed to Phase 2 — wire HTML to the store.\n')
  process.exit(0)
}
