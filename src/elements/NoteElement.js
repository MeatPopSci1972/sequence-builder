// Sequence Builder — NoteElement.js
// Implements SequenceElement for note records.
// Audience: Human + fresh AI instance
//
// Store record shape: { id, x, y, text }
//
// Note width is fixed at 120px.
// Note height is dynamic — computed from text content.

const _NE_NOTE_W        = 120
const _NE_CHARS_PER_LINE = 17
const _NE_LINE_H         = 15
const _NE_PADDING        = 14

function _neNoteHeight(text) {
  const lines = (text || 'note').split('\n').reduce(function(acc, seg) {
    return acc + Math.max(1, Math.ceil(seg.length / _NE_CHARS_PER_LINE))
  }, 0)
  return Math.max(36, lines * _NE_LINE_H + _NE_PADDING)
}

class NoteElement /* extends SequenceElement */ {
  constructor(data) {
    this._data = data
  }

  get id() { return this._data.id }

  /**
   * Bounding box centred on the note's y position.
   * @returns {{ x, y, w, h }}
   */
  getBounds() {
    const h = _neNoteHeight(this._data.text)
    return { x: this._data.x || 20, y: this._data.y - h / 2, w: _NE_NOTE_W, h }
  }

  /**
   * Hit test against the note bounding box.
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  hitTest(px, py) {
    const { x, y, w, h } = this.getBounds()
    return px >= x && px <= x + w && py >= y && py <= y + h
  }

  /**
   * Properties schema for the Properties panel.
   * @returns {Array}
   */
  getPropertiesSchema() {
    return [
      { key: 'text', label: 'Text', type: 'textarea' },
    ]
  }

  render(layer, ctx)      { throw new Error('NoteElement.render() not yet wired') }
  renderSelected(il, ctx) { /* stub */ }
    onDragStart(e, ctx) {
    const note = this._data
    const cr = ctx.canvasWrap.getBoundingClientRect()
    ctx._drag = {
      type: 'note', baseX: note.x || 20, baseY: note.y || 0,
      offsetX: (e.clientX - cr.left) / ctx.zoom - (note.x || 20),
      offsetY: (e.clientY - cr.top)  / ctx.zoom - (note.y || 0),
      ghostEl: e.target ? e.target.closest('g[data-id]') : null,
    }
    if (ctx._drag.ghostEl) ctx._drag.ghostEl.style.opacity = '0.4'
    e.preventDefault()
  }
  onDragMove(e, ctx) {
    if (!ctx._drag) return
    const cr = ctx.canvasWrap.getBoundingClientRect()
    this._data.x = Math.max(0,  (e.clientX - cr.left) / ctx.zoom - ctx._drag.offsetX)
    this._data.y = Math.max(60, (e.clientY - cr.top)  / ctx.zoom - ctx._drag.offsetY)
    if (ctx._drag.ghostEl) {
      ctx._drag.ghostEl.setAttribute('transform',
        'translate(' + (this._data.x - ctx._drag.baseX) + ',' + (this._data.y - ctx._drag.baseY) + ')')
    }
  }
  onDragEnd(e, ctx) {
    if (!ctx._drag) return
    if (ctx._drag.ghostEl) { ctx._drag.ghostEl.style.opacity = ''; ctx._drag.ghostEl = null }
    const moved = Math.round(this._data.x) !== Math.round(ctx._drag.baseX) ||
                  Math.round(this._data.y) !== Math.round(ctx._drag.baseY)
    if (moved) {
      ctx.store.dispatch({ type: 'MOVE_NOTE',
        payload: { id: this._data.id, x: this._data.x, y: this._data.y } })
      setTimeout(ctx.render, 0)
    }
    ctx._drag = null
  }
  onSelect(ctx)           { /* stub */ }
  onDeselect(ctx)         { /* stub */ }
}

if (typeof module !== 'undefined') module.exports = { NoteElement, _neNoteHeight, _NE_NOTE_W }