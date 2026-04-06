// Auto-generated suite data — do not edit manually
// Written by fix-build.js, consumed by refactor-runner.js
module.exports = [

// ── Suite 17: ULID ID contract ───────────────────────────────────────────
{ desc: 'Suite 17: ADD_ACTOR id has actor_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  const id = store.state.actors[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('actor_'), 'expected actor_ prefix, got: ' + id)
  assert(RE.test(id.slice(6)), 'expected 26-char ULID suffix, got: ' + id.slice(6))
}},
{ desc: 'Suite 17: ADD_MESSAGE id has msg_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_MESSAGE', payload: { label: 'M' } })
  const id = store.state.messages[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('msg_'), 'expected msg_ prefix, got: ' + id)
  assert(RE.test(id.slice(4)), 'expected 26-char ULID suffix, got: ' + id.slice(4))
}},
{ desc: 'Suite 17: ADD_NOTE id has note_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_NOTE', payload: {} })
  const id = store.state.notes[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('note_'), 'expected note_ prefix, got: ' + id)
  assert(RE.test(id.slice(5)), 'expected 26-char ULID suffix, got: ' + id.slice(5))
}},
{ desc: 'Suite 17: ADD_FRAGMENT id has frag_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_FRAGMENT', payload: {} })
  const id = store.state.fragments[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('frag_'), 'expected frag_ prefix, got: ' + id)
  assert(RE.test(id.slice(5)), 'expected 26-char ULID suffix, got: ' + id.slice(5))
}},
{ desc: 'Suite 17: LOAD_DEMO actor ids are 26-char ULIDs', fn: function(freshStore, assert) {
  const store = freshStore()
  const RE = /^[0-9A-Z]{26}$/
  store.dispatch({ type: 'LOAD_DEMO', payload: { id: 'auth-flow' } })
  for (const actor of store.state.actors) {
    assert(RE.test(actor.id), 'demo actor id should be ULID, got: ' + actor.id)
  }
}},
{ desc: 'Suite 17: dispatch stamps meta.affectedId from payload.id', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  const aid = store.state.actors[0].id
  store.dispatch({ type: 'UPDATE_ACTOR', payload: { id: aid, label: 'B' } })
  const entry = store.log.find(function(e) { return e.type === 'UPDATE_ACTOR' })
  assert(entry.meta.affectedId === aid, 'affectedId should equal actor id')
}},
{ desc: 'Suite 17: two ADD_ACTOR calls produce distinct ULIDs', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B' } })
  const id1 = store.state.actors[0].id
  const id2 = store.state.actors[1].id
  assert(id1 !== id2, 'two actors must have distinct ids')
}},
{ desc: 'Suite 17: state has no nextId field', fn: function(freshStore, assert) {
  const store = freshStore()
  assert(!('nextId' in store.state), 'state.nextId should not exist after ULID migration')
}},

// ── Suite 18: ActorElement contract ──────────────────────────────────────
{ desc: 'Suite 18: ActorElement.getBounds() correct box for x=40', fn: function(freshStore, assert) {
  const { ActorElement, _AE_ACTOR_W, _AE_ACTOR_H } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  const b = el.getBounds()
  assert(b.x === 40, 'x should be 40'); assert(b.y === 8, 'y should be 8')
  assert(b.w === _AE_ACTOR_W, 'w'); assert(b.h === _AE_ACTOR_H, 'h')
}},
{ desc: 'Suite 18: ActorElement.getBounds() x tracks data.x', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 210, label: 'B', type: 'actor-system', schema: [], properties: {} })
  assert(el.getBounds().x === 210, 'x should mirror data.x')
}},
{ desc: 'Suite 18: ActorElement.hitTest() true for point inside', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(95, 20) === true, 'centre should hit')
}},
{ desc: 'Suite 18: ActorElement.hitTest() false for point outside', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(200, 20) === false, 'far right should miss')
  assert(el.hitTest(95, 100) === false, 'below should miss')
}},
{ desc: 'Suite 18: ActorElement.hitTest() left edge inclusive', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(40, 20) === true, 'left edge x=40 should hit')
}},
{ desc: 'Suite 18: ActorElement.hitTest() right edge inclusive', fn: function(freshStore, assert) {
  const { ActorElement, _AE_ACTOR_W } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(40 + _AE_ACTOR_W, 20) === true, 'right edge should hit')
}},
{ desc: 'Suite 18: ActorElement.getPropertiesSchema() has 3 fields', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  const s = el.getPropertiesSchema()
  assert(Array.isArray(s) && s.length === 3, 'schema should have 3 fields')
  assert(s[0].key === 'label' && s[1].key === 'type' && s[2].key === 'emoji', 'field keys')
}},
{ desc: 'Suite 18: ActorElement.getPropertiesSchema() type has 4 options', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  const tf = el.getPropertiesSchema().find(function(f) { return f.key === 'type' })
  assert(tf.type === 'select' && tf.options.length === 4, '4 select options')
}},
{ desc: 'Suite 18: ActorElement.id getter returns data.id', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_X', x: 0, label: 'X', type: 'actor-system', schema: [], properties: {} })
  assert(el.id === 'actor_X', 'id getter should return data.id')
}},
{ desc: 'Suite 18: ActorElement.render() throws (not yet wired)', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  let threw = false; try { el.render(null, null) } catch(e) { threw = true }
  assert(threw, 'render() should throw until canvas dispatcher is wired')
}},
{ desc: 'Suite 18: ElementFactory.create() returns ActorElement for actor record', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const { ElementFactory } = require('./src/elements/ElementFactory.js')
  const el = ElementFactory.create({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el instanceof ActorElement, 'factory should return ActorElement')
}},
{ desc: 'Suite 18: ElementFactory.create() throws for record without id', fn: function(freshStore, assert) {
  const { ElementFactory } = require('./src/elements/ElementFactory.js')
  let threw = false; try { ElementFactory.create({ label: 'no id' }) } catch(e) { threw = true }
  assert(threw, 'factory should throw for record without id')
}},

]