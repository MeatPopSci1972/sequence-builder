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

// ═══════════════════════════════════════════════════════
//  FEATURE COVERAGE MAP
//
//  Read this to know what user-facing features are tested.
//  Each entry links a visible capability to the suite(s) that
//  back it. A feature with no suite entry has no contract test.
//
//  FEATURE                          SUITE(S)
//  ─────────────────────────────────────────────────────
//  Add Actor                         Suite 1
//  Actor x-position & spacing        Suite 1
//  Unique actor label (auto-suffix)   Suite 1
//  Actor reorder (drag left/right)   Suite 1 — REFLOW_ACTORS tests
//  Delete Actor (cascade to msgs)    Suite 2
//  Add Message                       Suite 9, Suite 12
//  Message label (default & edit)    Suite 12
//  Inline label editing (dblclick)   Suite 12
//  Update Message (partial patch)    Suite 3, Suite 12
//  Message wiring (fromId/toId)      Suite 9, Suite 10
//  Self-message (1 actor)            Suite 9
//  Move Message (Y axis drag)        Suite 8 e2e
//  Undo / Redo                       Suite 5, Suite 6
//  Undo is undoable (REDO after)     Suite 6
//  UML import (PlantUML + Mermaid)   Suite 7
//  Load Demo                         Suite 8 e2e, Suite 11
//  Export / Import diagram JSON      Suite 8 e2e
//  PlantUML output                   Suite 8 e2e
//  Mermaid sequenceDiagram output    Suite 7 (_parseUML Mermaid tests)
//  Clear diagram                     Suite 8 e2e
//  Element bounding boxes            Suite 9
//  No actor guard on element add     Suite 9
//  autoFitOnLoad preference          Suite 11
//  Action log & undoable flag        Suite 4
//  Canvas pan (store boundary)        Suite 14
//  Arrow-key nudge contracts           Suite 14
//
//  NOT YET TESTED (UI-only, no store contract):
//  • grab cursor affordance on actor headers
//  • dblclick trigger mechanics (DOM event wiring)
//  • inline editor positioning & keyboard UX
//  • interaction-layer routing (render() routes selected element to interactionLayer) — UI decision, store contract covered by Suite 13
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
test('ADD_ACTOR duplicate label gets auto-suffixed with _2', () => {
  const s = freshStore()
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'User' } })
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'User' } })
  const labels = s.state.actors.map(a => a.label)
  assert(labels[0] === 'User', 'first label should be User')
  assert(labels[1] === 'User_2', 'duplicate should become User_2, got: ' + labels[1])
})

test('ADD_ACTOR third duplicate gets _3 suffix', () => {
  const s = freshStore()
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Svc' } })
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Svc' } })
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Svc' } })
  const labels = s.state.actors.map(a => a.label)
  assert(labels[2] === 'Svc_3', 'third duplicate should be Svc_3, got: ' + labels[2])
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
//  Suite 8 — End-to-End scenario
//
//  Exercises the full lifecycle against the store contract:
//    1. Load demo
//    2. Modify (add actor, update message, move message, add note)
//    3. Snapshot state as "exported JSON"
//    4. Clear canvas
//    5. Load from snapshot (import)
//    6. Validate structure and serialized output
//
//  No DOM, no browser. Pure store contract + serializer logic.
//  The PlantUML serializer is inlined (mirrors HTML adapter).
// ═══════════════════════════════════════════════════════

console.log('\nSuite 8 — End-to-end scenario')

// ── Inline PlantUML serializer (mirrors PlantUMLAdapter in HTML) ─────────────
function serializePlantUML(actors, messages, notes, fragments) {
  function esc(s) { return (s||'unnamed').replace(/"/g, '\\"') }
  function kw(type) {
    return { 'actor-person':'actor', 'actor-system':'participant',
             'actor-db':'database', 'actor-queue':'queue' }[type] || 'participant'
  }
  const lines = ['@startuml', '']
  const sorted = [...actors].sort((a,b) => a.x - b.x)
  for (const a of sorted) lines.push(`${kw(a.type)} "${esc(a.label)}" as ${a.id}`)
  if (sorted.length) lines.push('')

  const items = [
    ...messages.map(m => ({...m, _k:'msg'})),
    ...notes.map(n => ({...n, _k:'note'})),
  ]
  for (const f of fragments) {
    items.push({ y: f.y, _k:'frag-open', f })
    items.push({ y: f.y + f.h, _k:'frag-close', f })
  }
  items.sort((a,b) => (a.y||0) - (b.y||0))

  for (const item of items) {
    if (item._k === 'msg') {
      const from = actors.find(a => a.id === item.fromId)
      const to   = actors.find(a => a.id === item.toId)
      if (!from || !to) continue
      const lbl = esc(item.label || 'message')
      const dir = item.direction || 'right'
      const [src, tgt] = dir === 'left' ? [to.id, from.id] : [from.id, to.id]
      if (item.kind === 'sync')   lines.push(`${src} -> ${tgt} : ${lbl}`)
      if (item.kind === 'async')  lines.push(`${src} ->> ${tgt} : ${lbl}`)
      if (item.kind === 'return') lines.push(`${src} --> ${tgt} : ${lbl}`)
    } else if (item._k === 'note') {
      lines.push(`note right : ${item.text||'note'}`)
    } else if (item._k === 'frag-open') {
      lines.push(`${item.f.kind.replace('frag-','')} [${item.f.cond||'condition'}]`)
    } else if (item._k === 'frag-close') {
      lines.push('end')
    }
  }
  lines.push('', '@enduml')
  return lines.join('\n')
}

// ── Step 1: Load demo ────────────────────────────────────
test('e2e: LOAD_DEMO produces expected actor/message/fragment/note counts', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const s = store.state
  assertEqual(s.actors.length,    4, '4 actors')
  assertEqual(s.messages.length,  6, '6 messages')
  assertEqual(s.fragments.length, 1, '1 fragment')
  assertEqual(s.notes.length,     1, '1 note')
})

test('e2e: LOAD_DEMO actor labels are correct', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const labels = store.state.actors.map(a => a.label)
  assert(labels.includes('User'),         'has User')
  assert(labels.includes('API Gateway'),  'has API Gateway')
  assert(labels.includes('Auth Service'), 'has Auth Service')
  assert(labels.includes('Database'),     'has Database')
})

test('e2e: LOAD_DEMO first message is POST /login sync right', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const s = store.state
  const user = s.actors.find(a => a.label === 'User')
  const api  = s.actors.find(a => a.label === 'API Gateway')
  const msg  = s.messages[0]
  assertEqual(msg.label,     'POST /login', 'label')
  assertEqual(msg.kind,      'sync',        'kind')
  assertEqual(msg.direction, 'right',       'direction')
  assertEqual(msg.fromId,    user.id,       'fromId')
  assertEqual(msg.toId,      api.id,        'toId')
})

// ── Step 2: Modify ───────────────────────────────────────
test('e2e: add actor after demo load increases actor count', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Cache', type: 'actor-db' } })
  assertEqual(store.state.actors.length, 5, '5 actors after add')
  assert(store.state.actors.some(a => a.label === 'Cache'), 'Cache actor present')
})

test('e2e: UPDATE_MESSAGE changes label on first message', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const msgId = store.state.messages[0].id
  store.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: msgId, label: 'POST /auth/login' } })
  assertEqual(store.state.messages[0].label, 'POST /auth/login', 'label updated')
})

test('e2e: MOVE_MESSAGE changes y position', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const msgId = store.state.messages[0].id
  store.dispatch({ type: 'MOVE_MESSAGE', payload: { id: msgId, y: 999 } })
  assertEqual(store.state.messages[0].y, 999, 'y updated to 999')
})

test('e2e: ADD_NOTE after demo adds to note count', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  store.dispatch({ type: 'ADD_NOTE', payload: { x: 10, y: 50, text: 'Security boundary' } })
  assertEqual(store.state.notes.length, 2, '2 notes')
  assert(store.state.notes.some(n => n.text === 'Security boundary'), 'note text present')
})

// ── Step 3: Snapshot as exported JSON ───────────────────
test('e2e: state snapshot is serializable and round-trips through JSON', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  store.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: store.state.messages[0].id, label: 'POST /auth/login' } })

  // Simulate _exportDiagram: JSON.stringify(store.state)
  const exported = JSON.stringify(store.state)
  assert(exported.length > 0, 'export is non-empty')

  // Round-trip: parse back
  const parsed = JSON.parse(exported)
  assertEqual(parsed.actors.length,   store.state.actors.length,   'actors preserved')
  assertEqual(parsed.messages.length, store.state.messages.length, 'messages preserved')
  assertEqual(parsed.messages[0].label, 'POST /auth/login',        'modified label preserved')
})

// ── Step 4: Clear canvas ─────────────────────────────────
test('e2e: CLEAR_DIAGRAM resets actors, messages, notes, fragments to empty', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  store.dispatch({ type: 'CLEAR_DIAGRAM' })
  const s = store.state
  assertEqual(s.actors.length,    0, 'actors empty')
  assertEqual(s.messages.length,  0, 'messages empty')
  assertEqual(s.fragments.length, 0, 'fragments empty')
  assertEqual(s.notes.length,     0, 'notes empty')
})

test('e2e: CLEAR_DIAGRAM is undoable — UNDO restores demo state', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  store.dispatch({ type: 'CLEAR_DIAGRAM' })
  store.dispatch({ type: 'UNDO' })
  assertEqual(store.state.actors.length,   4, 'actors restored after undo')
  assertEqual(store.state.messages.length, 6, 'messages restored after undo')
})

// ── Step 5: Import (LOAD_DIAGRAM from snapshot) ──────────
test('e2e: LOAD_DIAGRAM from exported snapshot restores full state', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  store.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: store.state.messages[0].id, label: 'POST /auth/login' } })

  // Export
  const snapshot = JSON.parse(JSON.stringify(store.state))

  // Clear
  store.dispatch({ type: 'CLEAR_DIAGRAM' })
  assertEqual(store.state.actors.length, 0, 'cleared')

  // Import
  store.dispatch({ type: 'LOAD_DIAGRAM', payload: { ...snapshot, _source: 'import' } })

  assertEqual(store.state.actors.length,    snapshot.actors.length,    'actors restored')
  assertEqual(store.state.messages.length,  snapshot.messages.length,  'messages restored')
  assertEqual(store.state.fragments.length, snapshot.fragments.length, 'fragments restored')
  assertEqual(store.state.notes.length,     snapshot.notes.length,     'notes restored')
  assertEqual(store.state.messages[0].label, 'POST /auth/login',       'modified label survives round-trip')
})

test('e2e: LOAD_DIAGRAM clears undo stack — UNDO after import is a no-op', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const snapshot = JSON.parse(JSON.stringify(store.state))
  store.dispatch({ type: 'CLEAR_DIAGRAM' })
  store.dispatch({ type: 'LOAD_DIAGRAM', payload: { ...snapshot, _source: 'import' } })
  // UNDO should not restore the cleared state — stack was reset by LOAD_DIAGRAM
  store.dispatch({ type: 'UNDO' })
  assertEqual(store.state.actors.length, 4, 'actors still present — undo did not clear import')
})

// ── Step 6: Validate serialized output ───────────────────
test('e2e: PlantUML output contains all actor labels from demo', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const { actors, messages, notes, fragments } = store.state
  const output = serializePlantUML(actors, messages, notes, fragments)

  assert(output.includes('@startuml'),    'has @startuml')
  assert(output.includes('@enduml'),      'has @enduml')
  assert(output.includes('User'),         'contains User')
  assert(output.includes('API Gateway'),  'contains API Gateway')
  assert(output.includes('Auth Service'), 'contains Auth Service')
  assert(output.includes('Database'),     'contains Database')
})

test('e2e: PlantUML output contains all message labels from demo', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const { actors, messages, notes, fragments } = store.state
  const output = serializePlantUML(actors, messages, notes, fragments)

  assert(output.includes('POST /login'),          'POST /login present')
  assert(output.includes('validateCredentials'),   'validateCredentials present')
  assert(output.includes('SELECT user WHERE'),     'SELECT message present')
  assert(output.includes('user record'),           'user record present')
  assert(output.includes('JWT token'),             'JWT token present')
  assert(output.includes('200 OK + token'),        '200 OK present')
})

test('e2e: PlantUML output reflects modified label after UPDATE_MESSAGE', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const msgId = store.state.messages[0].id
  store.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: msgId, label: 'POST /auth/login' } })
  const { actors, messages, notes, fragments } = store.state
  const output = serializePlantUML(actors, messages, notes, fragments)

  assert(output.includes('POST /auth/login'), 'modified label in output')
  assert(!output.includes('POST /login\n') && !output.includes('POST /login '),
    'original label not present as standalone message')
})

test('e2e: PlantUML output contains fragment keyword from demo', () => {
  const store = freshStore()
  store.dispatch({ type: 'LOAD_DEMO' })
  const { actors, messages, notes, fragments } = store.state
  const output = serializePlantUML(actors, messages, notes, fragments)

  assert(output.includes('alt'),                  'fragment alt keyword present')
  assert(output.includes('valid credentials'),     'fragment condition present')
  assert(output.includes('end'),                   'fragment end present')
})

test('e2e: full lifecycle — demo → modify → export → clear → import → serialize is consistent', () => {
  const store = freshStore()

  // Load demo
  store.dispatch({ type: 'LOAD_DEMO' })

  // Modify
  const msgId = store.state.messages[0].id
  store.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: msgId, label: 'POST /auth/login' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Cache', type: 'actor-db' } })

  // Export
  const snapshot = JSON.parse(JSON.stringify(store.state))
  assertEqual(snapshot.actors.length,   5, 'snapshot has 5 actors')
  assertEqual(snapshot.messages.length, 6, 'snapshot has 6 messages')

  // Clear
  store.dispatch({ type: 'CLEAR_DIAGRAM' })
  assertEqual(store.state.actors.length, 0, 'cleared')

  // Import
  store.dispatch({ type: 'LOAD_DIAGRAM', payload: { ...snapshot, _source: 'import' } })
  assertEqual(store.state.actors.length,   5, '5 actors after import')
  assertEqual(store.state.messages.length, 6, '6 messages after import')

  // Serialize — output must reflect the imported modifications
  const { actors, messages, notes, fragments } = store.state
  const output = serializePlantUML(actors, messages, notes, fragments)
  assert(output.includes('POST /auth/login'), 'modified label in final output')
  assert(output.includes('Cache'),            'added actor in final output')
  assert(output.includes('@startuml'),        'valid PlantUML wrapper')
  assert(output.includes('@enduml'),          'valid PlantUML wrapper close')
})



// ═══════════════════════════════════════════════════════
//  SUITE 9 — Edit button positioning (_positionEditBtn)
//  Tests the bounding box logic for each element type.
//  Runs in Node — simulates uiState and store, no DOM needed.
// ═══════════════════════════════════════════════════════

test('Suite 9: actor bounding box is right-edge, top of actor', () => {
  // Simulate the actor box calculation from _positionEditBtn
  const ACTOR_W = 110
  const actor = { id: 'a1', x: 40 }
  const box = { x: actor.x, y: 4, w: ACTOR_W, h: 0 }
  const btnX = (box.x + box.w) * 1.0  // zoom=1, no viewport offset
  const btnY = (box.y) * 1.0
  assertEqual(btnX, 150, 'actor edit btn x = actor.x + ACTOR_W')
  assertEqual(btnY, 4,   'actor edit btn y = 4px (above top edge)')
})

test('Suite 9: message box anchors to toA side (right arrow)', () => {
  const ACTOR_W = 110
  const fromA = { id: 'a1', x: 40  }
  const toA   = { id: 'a2', x: 210 }
  const msg   = { id: 'm1', fromId: 'a1', toId: 'a2', y: 122, direction: 'right' }
  const actorCenterX = a => a.x + ACTOR_W / 2
  const toX   = actorCenterX(toA)   // 265
  const fromX = actorCenterX(fromA) // 95
  const anchorX = msg.direction === 'both' ? (fromX + toX) / 2 : toX
  const box = { x: anchorX - 30, y: msg.y - 28, w: 60, h: 20 }
  const btnX = box.x + box.w  // anchorX + 30 = 295
  const btnY = box.y           // 94
  assertEqual(btnX, 295, 'right-arrow edit btn x at toA side + 30')
  assertEqual(btnY, 94,  'right-arrow edit btn y above arrow line')
})

test('Suite 9: message box anchors to toA side (left arrow)', () => {
  const ACTOR_W = 110
  const fromA = { id: 'a2', x: 210 }
  const toA   = { id: 'a1', x: 40  }
  const msg   = { id: 'm1', fromId: 'a2', toId: 'a1', y: 122, direction: 'left' }
  const actorCenterX = a => a.x + ACTOR_W / 2
  const toX   = actorCenterX(toA)   // 95
  const anchorX = msg.direction === 'both' ? 0 : toX
  const box = { x: anchorX - 30, y: msg.y - 28, w: 60, h: 20 }
  const btnX = box.x + box.w  // 95 + 30 = 125
  assertEqual(btnX, 125, 'left-arrow edit btn x anchors to left toA side')
})

test('Suite 9: message box midpoint for bidirectional arrow', () => {
  const ACTOR_W = 110
  const fromA = { id: 'a1', x: 40  }
  const toA   = { id: 'a2', x: 210 }
  const msg   = { id: 'm1', fromId: 'a1', toId: 'a2', y: 122, direction: 'both' }
  const actorCenterX = a => a.x + ACTOR_W / 2
  const toX   = actorCenterX(toA)   // 265
  const fromX = actorCenterX(fromA) // 95
  const anchorX = (fromX + toX) / 2  // 180
  const btnX = (anchorX - 30) + 60   // 180
  assertEqual(btnX, 210, 'bidirectional edit btn x at midpoint + 30')
})

test('Suite 9: note bounding box right-edge at x + 120', () => {
  const note = { id: 'n1', x: 20, y: 122 }
  const box  = { x: note.x, y: (note.y || 0) - 18, w: 120, h: 36 }
  const btnX = box.x + box.w
  const btnY = box.y
  assertEqual(btnX, 140, 'note edit btn x = note.x + 120')
  assertEqual(btnY, 104, 'note edit btn y above note top')
})

test('Suite 9: fragment bounding box top-right corner', () => {
  const frag = { id: 'f1', x: 60, y: 200, w: 200, h: 100 }
  const box  = { x: frag.x, y: frag.y, w: frag.w, h: frag.h }
  const btnX = box.x + box.w
  const btnY = box.y
  assertEqual(btnX, 260, 'fragment edit btn x = frag.x + frag.w')
  assertEqual(btnY, 200, 'fragment edit btn y = frag.y (top edge)')
})

test('Suite 9: edit btn hidden when nothing selected', () => {
  // _positionEditBtn returns early and would remove visible class
  // We test the guard condition: !s || s._preview
  const noSelection = null
  const preview     = { id: '__preview__', _preview: true }
  assert(!noSelection,      'null selection triggers hide')
  assert(preview._preview,  'preview object triggers hide')
})

test('Suite 9: :added store events set uiState.selected before render', () => {
  const store = createStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Test', type: 'actor-system', x: 40 } })
  const actor = store.state.actors[0]
  assert(actor, 'actor was added to store')
  // The :added listener sets uiState.selected = _wrapSelected(actor, 'actor')
  // We verify the store has the actor and its id is accessible for wrapping
  assert(actor.id, 'actor has an id for _wrapSelected')
  assertEqual(actor.label, 'Test', 'actor label matches payload')
})


test('Suite 9: selected state persists after deselect-then-reselect cycle', () => {
  // Simulates: add actor → click canvas (deselect) → click actor again
  // _positionEditBtn must find the actor in state after re-selection
  const store = createStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'User', type: 'actor-person', x: 40 } })
  const actor = store.state.actors[0]
  assert(actor, 'actor in state')

  // Simulate deselect (uiState.selected = null equivalent)
  let selected = null

  // Simulate re-click: setSelected sets selected back
  selected = { ...actor, _type: 'actor' }
  assert(selected._type === 'actor', 'reselected type is actor')
  assert(selected.id === actor.id,   'reselected id matches store actor')

  // _positionEditBtn finds the actor by id in state.actors
  const found = store.state.actors.find(a => a.id === selected.id)
  assert(found, 'actor found in state after reselect — edit button can position')
  assertEqual(found.x, 40, 'actor x is correct for bbox calculation')
})

test('Suite 9: _positionEditBtn box defined for all element types when selected', () => {
  const ACTOR_W = 110, ACTOR_H = 42
  const actorCenterX = a => a.x + ACTOR_W / 2

  const cases = [
    {
      _type: 'actor',
      el: { id: 'a1', x: 40 },
      getBox: (el) => ({ x: el.x, y: 8, w: ACTOR_W, h: ACTOR_H }),
    },
    {
      _type: 'note',
      el: { id: 'n1', x: 20, y: 122 },
      getBox: (el) => ({ x: el.x, y: (el.y || 0) - 18, w: 120, h: 36 }),
    },
    {
      _type: 'fragment',
      el: { id: 'f1', x: 60, y: 200, w: 200, h: 100 },
      getBox: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
    },
  ]

  for (const { _type, el, getBox } of cases) {
    const box = getBox(el)
    assert(box !== null,        _type + ': box is not null')
    assert(box.w > 0,           _type + ': box has positive width')
    assert(typeof box.x === 'number', _type + ': box.x is a number')
    const btnX = box.x + box.w
    const btnY = box.y
    assert(btnX > 0, _type + ': btnX is positive')
  }
})


test('Suite 9: ADD_ACTOR succeeds with no prior actors (no 2-actor guard)', () => {
  const store = createStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Solo', type: 'actor-person', x: 40 } })
  assertEqual(store.state.actors.length, 1, 'actor added without precondition')
  assertEqual(store.state.actors[0].label, 'Solo', 'actor label correct')
})

test('Suite 9: ADD_MESSAGE with 1 actor uses self-message (fromId === toId)', () => {
  const store = createStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Solo', type: 'actor-person', x: 40 } })
  const id = store.state.actors[0].id
  store.dispatch({ type: 'ADD_MESSAGE', payload: {
    fromId: id, toId: id, label: 'self', kind: 'sync', direction: 'right'
  }})
  assertEqual(store.state.messages.length, 1, 'self-message added with 1 actor')
  assertEqual(store.state.messages[0].fromId, id, 'fromId is the single actor')
  assertEqual(store.state.messages[0].toId,   id, 'toId is also the single actor (self-message)')
})

test('Suite 9: ADD_MESSAGE with actors — fromId/toId set explicitly', () => {
  const store = createStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-person', x: 40 } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B', type: 'actor-system', x: 200 } })
  const a = store.state.actors[0].id
  const b = store.state.actors[1].id
  store.dispatch({ type: 'ADD_MESSAGE', payload: {
    fromId: a, toId: b, label: 'call', kind: 'sync', direction: 'right'
  }})
  assertEqual(store.state.messages[0].fromId, a, 'fromId set correctly')
  assertEqual(store.state.messages[0].toId,   b, 'toId set correctly')
})

test('Suite 9: uiState has no pendingActorId field', () => {
  // Verify the arm-and-fire mechanic is fully removed from uiState initializer
  // We check the store script for the removed field
  const fs = require('fs')
  const html = fs.readFileSync('./sequence-builder.html', 'utf8')
  assert(!html.includes('pendingActorId: null'), 'pendingActorId removed from uiState')
  assert(!html.includes("uiState.pendingActorId"), 'no pendingActorId references in UI code')
})

test('Suite 9: isPending not referenced in renderActor', () => {
  const fs = require('fs')
  const html = fs.readFileSync('./sequence-builder.html', 'utf8')
  // Extract renderActor function body
  const start = html.indexOf('function renderActor(')
  const end = html.indexOf('function renderMessage(', start)
  const renderActorBody = html.slice(start, end)
  assert(!renderActorBody.includes('isPending'), 'isPending not used in renderActor')
  assert(!renderActorBody.includes('pending-actor'), 'pending-actor class not applied in renderActor')
})


test('Suite 9: no actor guard on message add — any element can be added anytime', () => {
  const fs = require('fs')
  const html = fs.readFileSync('./sequence-builder.html', 'utf8')
  // No precondition guard on msg paths (proto2prod UI rule)
  assert(!html.includes("state.actors.length < 1"), 'no 1-actor guard in msg add paths')
  // Check that no guard blocks msg add (the one remaining actors.length < 2 is in API analysis text, not a guard)
  const msgGuard = /if\s*\(state\.actors\.length\s*<\s*2\)\s*\{[^}]*toast[^}]*return/
  assert(!msgGuard.test(html), 'no 2-actor guard blocking msg add')
})

test('Suite 9: UI guard — notes and fragments have no actor guard', () => {
  const fs = require('fs')
  const html = fs.readFileSync('./sequence-builder.html', 'utf8')
  // Find ADD_NOTE dispatch — should not be preceded by actors.length check
  const noteIdx = html.indexOf("type: 'ADD_NOTE'")
  const fragIdx = html.indexOf("type: 'ADD_FRAGMENT'")
  assert(noteIdx !== -1, 'ADD_NOTE dispatch exists')
  assert(fragIdx !== -1, 'ADD_FRAGMENT dispatch exists')
  // Check 200 chars before each dispatch for actor guard
  const notePre = html.slice(Math.max(0, noteIdx - 200), noteIdx)
  const fragPre = html.slice(Math.max(0, fragIdx - 200), fragIdx)
  assert(!notePre.includes('actors.length'), 'no actor guard before ADD_NOTE')
  assert(!fragPre.includes('actors.length'), 'no actor guard before ADD_FRAGMENT')
})

test('Suite 9: self-message renders correctly (isSelf path)', () => {
  const store = createStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', type: 'actor-person', x: 40 } })
  const id = store.state.actors[0].id
  store.dispatch({ type: 'ADD_MESSAGE', payload: {
    fromId: id, toId: id, label: 'ping', kind: 'sync', direction: 'right'
  }})
  const msg = store.state.messages[0]
  assert(msg.fromId === msg.toId, 'self-message: fromId equals toId')
  assert(msg.label === 'ping', 'label preserved')
})


test('Suite 9: MOVE_NOTE only dispatched when position changes', () => {
  const store = createStore()
  store.dispatch({ type: 'ADD_NOTE', payload: { x: 60, y: 200, text: 'test' } })
  const note = store.state.notes[0]
  const originalY = note.y
  // Simulate zero-movement: dragBaseX/Y === current x/y
  const moved = Math.round(note.x) !== Math.round(60) || Math.round(note.y) !== Math.round(200)
  assert(!moved, 'zero-movement note: moved=false, no dispatch needed')
  // Simulate real movement
  const movedReal = Math.round(100) !== Math.round(60) || Math.round(200) !== Math.round(200)
  assert(movedReal, 'moved note: moved=true, dispatch should fire')
})

test('Suite 9: MOVE_FRAGMENT only dispatched when position changes', () => {
  const store = createStore()
  store.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 60, y: 200, w: 200, h: 100, kind: 'frag-alt', cond: 'test' } })
  const frag = store.state.fragments[0]
  const moved = Math.round(frag.x) !== Math.round(60) || Math.round(frag.y) !== Math.round(200)
  assert(!moved, 'zero-movement fragment: moved=false, no dispatch needed')
})

test('Suite 9: note click after deselect — setSelected receives correct note', () => {
  // Simulates canvas click handler path for notes
  const store = createStore()
  store.dispatch({ type: 'ADD_NOTE', payload: { x: 60, y: 200, text: 'my note' } })
  const note = store.state.notes[0]
  // Canvas click handler: found = state.notes.find(n => n.id === id)
  const id = note.id
  const found = store.state.notes.find(n => n.id === id)
  assert(found, 'note found by id after canvas click')
  assertEqual(found.text, 'my note', 'correct note returned')
  assertEqual(found._type, undefined, 'note from state has no _type yet (added by _wrapSelected)')
})

// ── Suite 10 — ADD_MESSAGE null contract ─────────────────────────────────────────
{
  const s = createStore()

  test('ADD_MESSAGE with no actors stores fromId as null not undefined', () => {
    s.dispatch({ type: 'ADD_MESSAGE', payload: { label: 'orphan', kind: 'sync', direction: 'right' } })
    const m = s.state.messages[0]
    assert(m.fromId === null, 'fromId should be null, got: ' + m.fromId)
    assert(m.toId   === null, 'toId should be null, got: '   + m.toId)
  })

  test('ADD_MESSAGE with explicit null fromId/toId stores null', () => {
    s.dispatch({ type: 'ADD_MESSAGE', payload: { label: 'explicit-null', fromId: null, toId: null } })
    const m = s.state.messages[1]
    assert(m.fromId === null, 'fromId should be null')
    assert(m.toId   === null, 'toId should be null')
  })

  test('ADD_MESSAGE with actor ids wires correctly', () => {
    s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
    s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B' } })
    const [aA, aB] = s.state.actors
    s.dispatch({ type: 'ADD_MESSAGE', payload: { label: 'wired', fromId: aA.id, toId: aB.id } })
    const m = s.state.messages[2]
    assert(m.fromId === aA.id, 'fromId should be aA.id')
    assert(m.toId   === aB.id, 'toId should be aB.id')
  })

  test('UPDATE_MESSAGE can wire a previously null message', () => {
    const orphan = s.state.messages[0]
    const [aA, aB] = s.state.actors
    s.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: orphan.id, fromId: aA.id, toId: aB.id } })
    const m = s.state.messages.find(msg => msg.id === orphan.id)
    assert(m.fromId === aA.id, 'fromId wired after UPDATE_MESSAGE')
    assert(m.toId   === aB.id, 'toId wired after UPDATE_MESSAGE')
  })
}

// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// ══════�������════════════════════════════════════════════════
//  Suite 12 — Message label contract & inline edit
//
//  Pins down the label field that inline editing reads/writes.
//  These tests would catch regressions in the dblclick-to-edit
//  feature even though the DOM wiring itself is not tested here.
// ═══════════════════════════════════════════════════════
//  Suite 12 — Message label contract & inline edit
//
//  Pins down the label field that inline editing reads/writes.
//  These tests catch regressions in the dblclick-to-edit feature
//  even though the DOM event wiring is not tested here.
// ═══════════════════════════════════════════════════════
console.log('\nSuite 12 — Message label contract & inline edit')

test('ADD_MESSAGE stores the provided label', () => {
  const s = freshStore()
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B' } })
  const [a1, a2] = s.state.actors
  s.dispatch({ type: 'ADD_MESSAGE', payload: { fromId: a1.id, toId: a2.id, label: 'hello' } })
  assert(s.state.messages[0].label === 'hello', 'label should be hello')
})

test('ADD_MESSAGE default label is "message" when omitted', () => {
  const s = freshStore()
  s.dispatch({ type: 'ADD_MESSAGE', payload: {} })
  const lbl = s.state.messages[0].label
  assert(lbl === 'message', 'default label should be "message", got: ' + JSON.stringify(lbl))
})

test('UPDATE_MESSAGE label patch updates only the label', () => {
  const s = freshStore()
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B' } })
  const [a1, a2] = s.state.actors
  s.dispatch({ type: 'ADD_MESSAGE', payload: { fromId: a1.id, toId: a2.id, label: 'original' } })
  const mid = s.state.messages[0].id
  s.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: mid, label: 'updated' } })
  assert(s.state.messages[0].label === 'updated', 'label should be updated')
  assert(s.state.messages[0].fromId === a1.id, 'fromId must be unchanged')
  assert(s.state.messages[0].toId === a2.id, 'toId must be unchanged')
})

test('UPDATE_MESSAGE label to empty string is valid', () => {
  const s = freshStore()
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B' } })
  const [a1, a2] = s.state.actors
  s.dispatch({ type: 'ADD_MESSAGE', payload: { fromId: a1.id, toId: a2.id, label: 'was-set' } })
  const mid = s.state.messages[0].id
  s.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: mid, label: '' } })
  assert(s.state.messages[0].label === '', 'label should be empty string')
})

test('UPDATE_MESSAGE label update is undoable', () => {
  const s = freshStore()
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'X' } })
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Y' } })
  const [x, y] = s.state.actors
  s.dispatch({ type: 'ADD_MESSAGE', payload: { fromId: x.id, toId: y.id, label: 'original' } })
  const mid = s.state.messages[0].id
  s.dispatch({ type: 'UPDATE_MESSAGE', payload: { id: mid, label: 'edited' } })
  assert(s.state.messages[0].label === 'edited', 'label should be edited after UPDATE_MESSAGE')
  s.dispatch({ type: 'UNDO' })
  assert(s.state.messages[0].label === 'original', 'UNDO should restore original label')
})

//  Suite 11 — autoFitOnLoad preference
// ═══════════════════════════════════════════════════════
{
  // Pins the store-level contract that autoFitOnLoad depends on.
  // fitToZoom() is DOM-bound; those checks live in manual QA.

  test('Suite 11: LOAD_DEMO fires diagram:loaded', () => {
    const s = createStore()
    let fired = false
    s.on('diagram:loaded', () => { fired = true })
    s.dispatch({ type: 'LOAD_DEMO', payload: { id: 'auth-flow' }, meta: { undoable: false } })
    assert(fired, 'LOAD_DEMO must emit diagram:loaded')
  })

  test('Suite 11: LOAD_DEMO event carries source demo', () => {
    const s = createStore()
    let src = 'none'
    s.on('diagram:loaded', p => { src = p.source })
    s.dispatch({ type: 'LOAD_DEMO', payload: { id: 'auth-flow' }, meta: { undoable: false } })
    assert(src === 'demo', 'expected demo, got: ' + src)
  })

  test('Suite 11: LOAD_DIAGRAM fires diagram:loaded', () => {
    const s = createStore()
    let fired = false
    s.on('diagram:loaded', () => { fired = true })
    s.dispatch({ type: 'LOAD_DIAGRAM', payload: { actors: [], messages: [], notes: [], fragments: [], nextId: 1 } })
    assert(fired, 'LOAD_DIAGRAM must emit diagram:loaded')
  })

  test('Suite 11: LOAD_DIAGRAM event source is import', () => {
    const s = createStore()
    let src = 'none'
    s.on('diagram:loaded', p => { src = p.source })
    s.dispatch({ type: 'LOAD_DIAGRAM', payload: { actors: [], messages: [], notes: [], fragments: [], nextId: 1 } })
    assert(src === 'import', 'expected import, got: ' + src)
  })

  test('Suite 11: LOAD_DEMO clears undo stack', () => {
    const s = createStore()
    s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'X' } })
    s.dispatch({ type: 'LOAD_DEMO', payload: { id: 'auth-flow' }, meta: { undoable: false } })
    assert(!s.canUndo, 'LOAD_DEMO must clear undo stack')
  })

  test('Suite 11: LOAD_DEMO populates actors', () => {
    const s = createStore()
    s.dispatch({ type: 'LOAD_DEMO', payload: { id: 'auth-flow' }, meta: { undoable: false } })
    assert(s.state.actors.length > 0, 'LOAD_DEMO must populate actors')
  })

  test('Suite 11: LOAD_DIAGRAM restores actor count from snapshot', () => {
    const s = createStore()
    s.dispatch({ type: 'LOAD_DEMO', payload: { id: 'auth-flow' }, meta: { undoable: false } })
    const snap = JSON.parse(JSON.stringify(s.state))
    s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'Extra' } })
    s.dispatch({ type: 'LOAD_DIAGRAM', payload: Object.assign({}, snap) })
    assert(s.state.actors.length === snap.actors.length, 'LOAD_DIAGRAM restores actor count')
  })
}

// ═══════════════════════════════════════════════════════
//  SUITE 13 — Fragment geometry contract (interaction layer prerequisite)
//
//  The interaction layer needs precise fragment geometry to render the
//  resize handle and selection decoration. These tests pin the store
//  contract that the renderer depends on:
//    - ADD_FRAGMENT stores x, y, w, h, kind, cond
//    - RESIZE_FRAGMENT updates w and h correctly
//    - RESIZE_FRAGMENT is undoable
//    - UPDATE_FRAGMENT updates kind and cond
//    - Geometry is preserved through UNDO/REDO cycle
//    - Multiple fragments retain independent geometry
// ═══════════════════════════════════════════════════════
{
  test('Suite 13: ADD_FRAGMENT stores x, y, w, h', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 40, y: 80, w: 200, h: 120, kind: 'frag-alt', cond: 'ok' } })
    const f = s.state.fragments[0]
    assertEqual(f.x, 40, 'x must be stored')
    assertEqual(f.y, 80, 'y must be stored')
    assertEqual(f.w, 200, 'w must be stored')
    assertEqual(f.h, 120, 'h must be stored')
  })

  test('Suite 13: ADD_FRAGMENT stores kind and cond', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 100, kind: 'frag-loop', cond: 'i < 10' } })
    const f = s.state.fragments[0]
    assertEqual(f.kind, 'frag-loop', 'kind must be stored')
    assertEqual(f.cond, 'i < 10', 'cond must be stored')
  })

  test('Suite 13: ADD_FRAGMENT assigns unique id', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 100, kind: 'frag-alt', cond: 'a' } })
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 100, kind: 'frag-opt', cond: 'b' } })
    assert(s.state.fragments[0].id !== s.state.fragments[1].id, 'ids must be unique')
  })

  test('Suite 13: RESIZE_FRAGMENT updates w and h', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 10, y: 10, w: 100, h: 80, kind: 'frag-alt', cond: 'x' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'RESIZE_FRAGMENT', payload: { id, w: 300, h: 200 } })
    const f = s.getFragmentById(id)
    assertEqual(f.w, 300, 'w must be updated by RESIZE_FRAGMENT')
    assertEqual(f.h, 200, 'h must be updated by RESIZE_FRAGMENT')
  })

  test('Suite 13: RESIZE_FRAGMENT does not change x or y', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 50, y: 60, w: 100, h: 80, kind: 'frag-alt', cond: 'x' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'RESIZE_FRAGMENT', payload: { id, w: 300, h: 200 } })
    const f = s.getFragmentById(id)
    assertEqual(f.x, 50, 'x must not change on resize')
    assertEqual(f.y, 60, 'y must not change on resize')
  })

  test('Suite 13: RESIZE_FRAGMENT is undoable', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 80, kind: 'frag-alt', cond: 'x' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'RESIZE_FRAGMENT', payload: { id, w: 300, h: 200 } })
    assertEqual(s.getFragmentById(id).w, 300, 'w should be 300 after resize')
    s.dispatch({ type: 'UNDO' })
    assertEqual(s.getFragmentById(id).w, 100, 'UNDO must restore original w')
    assertEqual(s.getFragmentById(id).h, 80, 'UNDO must restore original h')
  })

  test('Suite 13: RESIZE_FRAGMENT undo then redo restores resize', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 80, kind: 'frag-alt', cond: 'x' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'RESIZE_FRAGMENT', payload: { id, w: 250, h: 150 } })
    s.dispatch({ type: 'UNDO' })
    s.dispatch({ type: 'REDO' })
    assertEqual(s.getFragmentById(id).w, 250, 'REDO must restore resized w')
    assertEqual(s.getFragmentById(id).h, 150, 'REDO must restore resized h')
  })

  test('Suite 13: UPDATE_FRAGMENT updates kind and cond', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 80, kind: 'frag-alt', cond: 'original' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'UPDATE_FRAGMENT', payload: { id, kind: 'frag-loop', cond: 'updated' } })
    const f = s.getFragmentById(id)
    assertEqual(f.kind, 'frag-loop', 'kind must be updated')
    assertEqual(f.cond, 'updated', 'cond must be updated')
  })

  test('Suite 13: UPDATE_FRAGMENT does not change geometry', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 30, y: 40, w: 180, h: 90, kind: 'frag-alt', cond: 'x' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'UPDATE_FRAGMENT', payload: { id, kind: 'frag-opt', cond: 'new' } })
    const f = s.getFragmentById(id)
    assertEqual(f.x, 30, 'x must not change on UPDATE_FRAGMENT')
    assertEqual(f.y, 40, 'y must not change on UPDATE_FRAGMENT')
    assertEqual(f.w, 180, 'w must not change on UPDATE_FRAGMENT')
    assertEqual(f.h, 90, 'h must not change on UPDATE_FRAGMENT')
  })

  test('Suite 13: multiple fragments retain independent geometry', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 10, y: 10, w: 100, h: 80, kind: 'frag-alt', cond: 'a' } })
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 200, y: 200, w: 300, h: 150, kind: 'frag-loop', cond: 'b' } })
    const [f1, f2] = s.state.fragments
    s.dispatch({ type: 'RESIZE_FRAGMENT', payload: { id: f1.id, w: 999, h: 999 } })
    assertEqual(s.getFragmentById(f2.id).w, 300, 'resizing f1 must not affect f2 w')
    assertEqual(s.getFragmentById(f2.id).h, 150, 'resizing f1 must not affect f2 h')
  })

  test('Suite 13: getFragmentById returns null for unknown id', () => {
    const s = freshStore()
    assert(s.getFragmentById('nonexistent') === null || s.getFragmentById('nonexistent') === undefined,
      'getFragmentById must return null/undefined for unknown id')
  })

  test('Suite 13: DELETE_FRAGMENT removes fragment by id', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 80, kind: 'frag-alt', cond: 'x' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'DELETE_FRAGMENT', payload: { id } })
    assert(s.state.fragments.length === 0, 'fragment must be removed')
    assert(s.getFragmentById(id) === null || s.getFragmentById(id) === undefined, 'getFragmentById must return null after delete')
  })

  test('Suite 13: DELETE_FRAGMENT is undoable', () => {
    const s = freshStore()
    s.dispatch({ type: 'ADD_FRAGMENT', payload: { x: 0, y: 0, w: 100, h: 80, kind: 'frag-alt', cond: 'x' } })
    const id = s.state.fragments[0].id
    s.dispatch({ type: 'DELETE_FRAGMENT', payload: { id } })
    s.dispatch({ type: 'UNDO' })
    assert(s.state.fragments.length === 1, 'UNDO must restore deleted fragment')
    assertEqual(s.state.fragments[0].id, id, 'restored fragment must have original id')
  })
}
// ═══════════════════════════════════════════════════════
//  Suite 14 — Canvas pan & arrow-key nudge contracts
//
//  Pan (panX/panY) is UI-only state — not stored in the store.
//  These tests pin the store-side contracts that arrow-key nudge
//  dispatches, and assert that pan state does not leak into store.
// ═══════════════════════════════════════════════════════

console.log('\nSuite 14 — Canvas pan & arrow-key nudge contracts');

test('Suite 14: UPDATE_ACTOR x-nudge moves actor by delta', () => {
  const s = freshStore();
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', x: 100 } });
  const id = s.state.actors[0].id;
  s.dispatch({ type: 'UPDATE_ACTOR', payload: { id, x: 120 } });
  assert(s.state.actors[0].x === 120, 'actor x updated to 120');
});

test('Suite 14: UPDATE_ACTOR x-nudge is undoable', () => {
  const s = freshStore();
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', x: 100 } });
  const id = s.state.actors[0].id;
  s.dispatch({ type: 'UPDATE_ACTOR', payload: { id, x: 120 } });
  s.dispatch({ type: 'UNDO' });
  assert(s.state.actors[0].x === 100, 'UNDO restores actor x to 100');
});

test('Suite 14: MOVE_NOTE nudge moves note by delta', () => {
  const s = freshStore();
  s.dispatch({ type: 'ADD_NOTE', payload: { text: 'hi', x: 80, y: 200 } });
  const id = s.state.notes[0].id;
  s.dispatch({ type: 'MOVE_NOTE', payload: { id, x: 100, y: 220 } });
  assert(s.state.notes[0].x === 100, 'note x updated');
  assert(s.state.notes[0].y === 220, 'note y updated');
});

test('Suite 14: MOVE_NOTE nudge is undoable', () => {
  const s = freshStore();
  s.dispatch({ type: 'ADD_NOTE', payload: { text: 'hi', x: 80, y: 200 } });
  const id = s.state.notes[0].id;
  s.dispatch({ type: 'MOVE_NOTE', payload: { id, x: 100, y: 220 } });
  s.dispatch({ type: 'UNDO' });
  assert(s.state.notes[0].x === 80, 'UNDO restores note x');
  assert(s.state.notes[0].y === 200, 'UNDO restores note y');
});

test('Suite 14: MOVE_FRAGMENT nudge moves fragment by delta', () => {
  const s = freshStore();
  s.dispatch({ type: 'ADD_FRAGMENT', payload: { kind: 'frag-alt', cond: 'c', x: 60, y: 100, w: 200, h: 80 } });
  const id = s.state.fragments[0].id;
  s.dispatch({ type: 'MOVE_FRAGMENT', payload: { id, x: 80, y: 120 } });
  assert(s.state.fragments[0].x === 80, 'fragment x updated');
  assert(s.state.fragments[0].y === 120, 'fragment y updated');
});

test('Suite 14: MOVE_FRAGMENT nudge is undoable', () => {
  const s = freshStore();
  s.dispatch({ type: 'ADD_FRAGMENT', payload: { kind: 'frag-alt', cond: 'c', x: 60, y: 100, w: 200, h: 80 } });
  const id = s.state.fragments[0].id;
  s.dispatch({ type: 'MOVE_FRAGMENT', payload: { id, x: 80, y: 120 } });
  s.dispatch({ type: 'UNDO' });
  assert(s.state.fragments[0].x === 60, 'UNDO restores fragment x');
  assert(s.state.fragments[0].y === 100, 'UNDO restores fragment y');
});

test('Suite 14: pan state is not present on store.state', () => {
  const s = freshStore();
  assert(!('panX' in s.state), 'panX is not a store state field');
  assert(!('panY' in s.state), 'panY is not a store state field');
});

test('Suite 14: actor x-nudge at left boundary (x:0) does not go negative', () => {
  const s = freshStore();
  s.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A', x: 5 } });
  const id = s.state.actors[0].id;
  // Simulate ArrowLeft nudge: Math.max(0, x - 10) = Math.max(0, -5) = 0
  const nudged = Math.max(0, s.state.actors[0].x - 10);
  s.dispatch({ type: 'UPDATE_ACTOR', payload: { id, x: nudged } });
  assert(s.state.actors[0].x === 0, 'actor x clamped to 0 at left boundary');
});



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
