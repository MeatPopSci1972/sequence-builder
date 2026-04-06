// Auto-generated suite data — do not edit manually
// Written by fix-build.js, consumed by refactor-runner.js
module.exports = [

// ── ULID ID contract ───────────────────────────────────────────
{ group: 'ULID ID contract', desc: 'ADD_ACTOR id has actor_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  const id = store.state.actors[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('actor_'), 'expected actor_ prefix, got: ' + id)
  assert(RE.test(id.slice(6)), 'expected 26-char ULID suffix, got: ' + id.slice(6))
}},
{ group: 'ULID ID contract', desc: 'ADD_MESSAGE id has msg_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_MESSAGE', payload: { label: 'M' } })
  const id = store.state.messages[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('msg_'), 'expected msg_ prefix, got: ' + id)
  assert(RE.test(id.slice(4)), 'expected 26-char ULID suffix, got: ' + id.slice(4))
}},
{ group: 'ULID ID contract', desc: 'ADD_NOTE id has note_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_NOTE', payload: {} })
  const id = store.state.notes[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('note_'), 'expected note_ prefix, got: ' + id)
  assert(RE.test(id.slice(5)), 'expected 26-char ULID suffix, got: ' + id.slice(5))
}},
{ group: 'ULID ID contract', desc: 'ADD_FRAGMENT id has frag_ prefix + 26-char ULID', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_FRAGMENT', payload: {} })
  const id = store.state.fragments[0].id
  const RE = /^[0-9A-Z]{26}$/
  assert(id.startsWith('frag_'), 'expected frag_ prefix, got: ' + id)
  assert(RE.test(id.slice(5)), 'expected 26-char ULID suffix, got: ' + id.slice(5))
}},
{ group: 'ULID ID contract', desc: 'LOAD_DEMO actor ids are 26-char ULIDs', fn: function(freshStore, assert) {
  const store = freshStore()
  const RE = /^[0-9A-Z]{26}$/
  store.dispatch({ type: 'LOAD_DEMO', payload: { id: 'auth-flow' } })
  for (const actor of store.state.actors) {
    assert(RE.test(actor.id), 'demo actor id should be ULID, got: ' + actor.id)
  }
}},
{ group: 'ULID ID contract', desc: 'dispatch stamps meta.affectedId from payload.id', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  const aid = store.state.actors[0].id
  store.dispatch({ type: 'UPDATE_ACTOR', payload: { id: aid, label: 'B' } })
  const entry = store.log.find(function(e) { return e.type === 'UPDATE_ACTOR' })
  assert(entry.meta.affectedId === aid, 'affectedId should equal actor id')
}},
{ group: 'ULID ID contract', desc: 'two ADD_ACTOR calls produce distinct ULIDs', fn: function(freshStore, assert) {
  const store = freshStore()
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'A' } })
  store.dispatch({ type: 'ADD_ACTOR', payload: { label: 'B' } })
  const id1 = store.state.actors[0].id
  const id2 = store.state.actors[1].id
  assert(id1 !== id2, 'two actors must have distinct ids')
}},
{ group: 'ULID ID contract', desc: 'state has no nextId field', fn: function(freshStore, assert) {
  const store = freshStore()
  assert(!('nextId' in store.state), 'state.nextId should not exist after ULID migration')
}},

// ── ActorElement contract ──────────────────────────────────────
{ group: 'ActorElement contract', desc: 'ActorElement.getBounds() correct box for x=40', fn: function(freshStore, assert) {
  const { ActorElement, _AE_ACTOR_W, _AE_ACTOR_H } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  const b = el.getBounds()
  assert(b.x === 40, 'x should be 40'); assert(b.y === 8, 'y should be 8')
  assert(b.w === _AE_ACTOR_W, 'w'); assert(b.h === _AE_ACTOR_H, 'h')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.getBounds() x tracks data.x', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 210, label: 'B', type: 'actor-system', schema: [], properties: {} })
  assert(el.getBounds().x === 210, 'x should mirror data.x')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.hitTest() true for point inside', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(95, 20) === true, 'centre should hit')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.hitTest() false for point outside', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(200, 20) === false, 'far right should miss')
  assert(el.hitTest(95, 100) === false, 'below should miss')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.hitTest() left edge inclusive', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(40, 20) === true, 'left edge x=40 should hit')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.hitTest() right edge inclusive', fn: function(freshStore, assert) {
  const { ActorElement, _AE_ACTOR_W } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el.hitTest(40 + _AE_ACTOR_W, 20) === true, 'right edge should hit')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.getPropertiesSchema() has 3 fields', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  const s = el.getPropertiesSchema()
  assert(Array.isArray(s) && s.length === 3, 'schema should have 3 fields')
  assert(s[0].key === 'label' && s[1].key === 'type' && s[2].key === 'emoji', 'field keys')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.getPropertiesSchema() type has 4 options', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  const tf = el.getPropertiesSchema().find(function(f) { return f.key === 'type' })
  assert(tf.type === 'select' && tf.options.length === 4, '4 select options')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.id getter returns data.id', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_X', x: 0, label: 'X', type: 'actor-system', schema: [], properties: {} })
  assert(el.id === 'actor_X', 'id getter should return data.id')
}},
{ group: 'ActorElement contract', desc: 'ActorElement.render() throws (not yet wired)', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const el = new ActorElement({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  let threw = false; try { el.render(null, null) } catch(e) { threw = true }
  assert(threw, 'render() should throw until canvas dispatcher is wired')
}},
{ group: 'ActorElement contract', desc: 'ElementFactory.create() returns ActorElement for actor record', fn: function(freshStore, assert) {
  const { ActorElement } = require('./src/elements/ActorElement.js')
  const { ElementFactory } = require('./src/elements/ElementFactory.js')
  const el = ElementFactory.create({ id: 'actor_T', x: 40, label: 'A', type: 'actor-system', schema: [], properties: {} })
  assert(el instanceof ActorElement, 'factory should return ActorElement')
}},
{ group: 'ActorElement contract', desc: 'ElementFactory.create() throws for record without id', fn: function(freshStore, assert) {
  const { ElementFactory } = require('./src/elements/ElementFactory.js')
  let threw = false; try { ElementFactory.create({ label: 'no id' }) } catch(e) { threw = true }
  assert(threw, 'factory should throw for record without id')
}},

// ── MessageElement contract ─────────────────────────────────────────────
{ group: 'MessageElement contract', desc: 'MessageElement.getBounds() returns y-band centred on message y', fn: function(freshStore, assert) {
  const { MessageElement } = require('./src/elements/MessageElement.js')
  const el = new MessageElement({ id: 'msg_T', fromId: null, toId: null, label: 'ping', kind: 'sync', direction: 'right', y: 100 })
  const b = el.getBounds()
  assert(b.y <= 100 && b.y + b.h >= 100, 'y-band should contain message y')
  assert(b.h > 0, 'height should be positive')
}},
{ group: 'MessageElement contract', desc: 'MessageElement.getBounds() uses actor positions from ctx', fn: function(freshStore, assert) {
  const { MessageElement } = require('./src/elements/MessageElement.js')
  const el = new MessageElement({ id: 'msg_T', fromId: 'a1', toId: 'a2', label: 'ping', kind: 'sync', direction: 'right', y: 100 })
  const ctx = { getActorById: function(id) { return id === 'a1' ? { x: 40 } : { x: 210 } } }
  const b = el.getBounds(ctx)
  assert(b.w > 0, 'width should be derived from actor positions')
  assert(b.x >= 40, 'x should start at fromActor center')
}},
{ group: 'MessageElement contract', desc: 'MessageElement.getPropertiesSchema() has label, kind, direction, endpoints', fn: function(freshStore, assert) {
  const { MessageElement } = require('./src/elements/MessageElement.js')
  const el = new MessageElement({ id: 'msg_T', fromId: null, toId: null, label: 'ping', kind: 'sync', direction: 'right', y: 0 })
  const s = el.getPropertiesSchema()
  const keys = s.map(function(f) { return f.key })
  assert(keys.includes('label'),     'schema should include label')
  assert(keys.includes('kind'),      'schema should include kind')
  assert(keys.includes('direction'), 'schema should include direction')
  assert(keys.includes('fromId'),    'schema should include fromId')
  assert(keys.includes('toId'),      'schema should include toId')
}},
{ group: 'MessageElement contract', desc: 'MessageElement.render() throws (not yet wired)', fn: function(freshStore, assert) {
  const { MessageElement } = require('./src/elements/MessageElement.js')
  const el = new MessageElement({ id: 'msg_T', fromId: null, toId: null, label: 'ping', kind: 'sync', direction: 'right', y: 0 })
  let threw = false; try { el.render(null, null) } catch(e) { threw = true }
  assert(threw, 'render() should throw until canvas dispatcher is wired')
}},
{ group: 'MessageElement contract', desc: 'ElementFactory creates MessageElement for message record', fn: function(freshStore, assert) {
  const { MessageElement } = require('./src/elements/MessageElement.js')
  const { ElementFactory } = require('./src/elements/ElementFactory.js')
  const el = ElementFactory.create({ id: 'msg_T', fromId: 'a1', toId: 'a2', label: 'ping', kind: 'sync', direction: 'right', y: 0 })
  assert(el instanceof MessageElement, 'factory should return MessageElement')
}},

// ── NoteElement contract ─────────────────────────────────────────────────
{ group: 'NoteElement contract', desc: 'NoteElement.getBounds() width is fixed at 120', fn: function(freshStore, assert) {
  const { NoteElement, _NE_NOTE_W } = require('./src/elements/NoteElement.js')
  const el = new NoteElement({ id: 'note_T', x: 20, y: 200, text: 'hello' })
  assert(el.getBounds().w === _NE_NOTE_W, 'note width should be fixed at ' + _NE_NOTE_W)
}},
{ group: 'NoteElement contract', desc: 'NoteElement.getBounds() height grows with text content', fn: function(freshStore, assert) {
  const { NoteElement } = require('./src/elements/NoteElement.js')
  const short = new NoteElement({ id: 'note_T', x: 20, y: 200, text: 'hi' })
  const long  = new NoteElement({ id: 'note_T', x: 20, y: 200, text: 'this is a much longer note that wraps across multiple lines' })
  assert(long.getBounds().h > short.getBounds().h, 'longer text should produce taller note')
}},
{ group: 'NoteElement contract', desc: 'NoteElement.hitTest() true for point inside', fn: function(freshStore, assert) {
  const { NoteElement } = require('./src/elements/NoteElement.js')
  const el = new NoteElement({ id: 'note_T', x: 20, y: 200, text: 'hello' })
  const b = el.getBounds()
  assert(el.hitTest(b.x + b.w / 2, b.y + b.h / 2) === true, 'centre should hit')
}},
{ group: 'NoteElement contract', desc: 'NoteElement.getPropertiesSchema() has text field', fn: function(freshStore, assert) {
  const { NoteElement } = require('./src/elements/NoteElement.js')
  const el = new NoteElement({ id: 'note_T', x: 20, y: 200, text: 'hello' })
  const s = el.getPropertiesSchema()
  assert(s.length === 1 && s[0].key === 'text', 'schema should have single text field')
}},
{ group: 'NoteElement contract', desc: 'ElementFactory creates NoteElement for note record', fn: function(freshStore, assert) {
  const { NoteElement } = require('./src/elements/NoteElement.js')
  const { ElementFactory } = require('./src/elements/ElementFactory.js')
  const el = ElementFactory.create({ id: 'note_T', x: 20, y: 200, text: 'hello' })
  assert(el instanceof NoteElement, 'factory should return NoteElement')
}},

// ── FragmentElement contract ──────────────────────────────────────────────
{ group: 'FragmentElement contract', desc: 'FragmentElement.getBounds() returns stored geometry', fn: function(freshStore, assert) {
  const { FragmentElement } = require('./src/elements/FragmentElement.js')
  const el = new FragmentElement({ id: 'frag_T', x: 60, y: 80, w: 300, h: 150, kind: 'frag-alt', cond: 'ok' })
  const b = el.getBounds()
  assert(b.x === 60 && b.y === 80 && b.w === 300 && b.h === 150, 'bounds should match stored geometry')
}},
{ group: 'FragmentElement contract', desc: 'FragmentElement.hitTest() true for point inside', fn: function(freshStore, assert) {
  const { FragmentElement } = require('./src/elements/FragmentElement.js')
  const el = new FragmentElement({ id: 'frag_T', x: 60, y: 80, w: 300, h: 150, kind: 'frag-alt', cond: 'ok' })
  assert(el.hitTest(210, 155) === true,  'centre should hit')
  assert(el.hitTest(10,  155) === false, 'outside left should miss')
}},
{ group: 'FragmentElement contract', desc: 'FragmentElement.getPropertiesSchema() has kind and condition', fn: function(freshStore, assert) {
  const { FragmentElement } = require('./src/elements/FragmentElement.js')
  const el = new FragmentElement({ id: 'frag_T', x: 60, y: 80, w: 300, h: 150, kind: 'frag-alt', cond: 'ok' })
  const keys = el.getPropertiesSchema().map(function(f) { return f.key })
  assert(keys.includes('kind') && keys.includes('cond'), 'schema should have kind and cond')
}},
{ group: 'FragmentElement contract', desc: 'ElementFactory creates FragmentElement for fragment record', fn: function(freshStore, assert) {
  const { FragmentElement } = require('./src/elements/FragmentElement.js')
  const { ElementFactory } = require('./src/elements/ElementFactory.js')
  const el = ElementFactory.create({ id: 'frag_T', x: 60, y: 80, w: 300, h: 150, kind: 'frag-alt', cond: 'ok' })
  assert(el instanceof FragmentElement, 'factory should return FragmentElement')
}},
]