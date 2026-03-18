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
  console.log('  All tests pass. Phase 1 exit criterion met.')
  console.log('  Proceed to Phase 2 — wire HTML to the store.\n')
  process.exit(0)
}
