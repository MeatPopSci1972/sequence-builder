'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
const SQ = String.fromCharCode(39)
let t = fs.readFileSync('sequence-builder.html', 'utf8')

const OLD = [
  '  if (type === ' + SQ + 'actor-move' + SQ + ') {',
  '    const actor = store.getActorById(id)',
  '    if (!actor) return',
  '    _interactionCtx = _makeInteractionContext()',
  '    const el = ElementFactory.create(actor)',
  '    el.onDragStart(e, _interactionCtx)',
  '    return',
  '  }',
].join(NL)

const NEW = [
  '  if (type === ' + SQ + 'actor-move' + SQ + ') {',
  '    const actor = store.getActorById(id)',
  '    if (!actor) return',
  '    _interactionCtx = _makeInteractionContext()',
  '    const el = ElementFactory.create(actor)',
  '    el.onDragStart(e, _interactionCtx)',
  '    dragging = actor            // keeps legacy mousemove/mouseup guards alive',
  '    dragging._type = ' + SQ + 'actor' + SQ + '  // routes mousemove to Factory path',
  '    return',
  '  }',
].join(NL)

if (t.indexOf(OLD) === -1) { console.error('OLD not found'); process.exit(1) }
t = t.split(OLD).join(NEW)
console.log('patch applied')
fs.writeFileSync('sequence-builder.html', t, 'utf8')
console.log('done')