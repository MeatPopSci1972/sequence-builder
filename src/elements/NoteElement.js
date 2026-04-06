// SequenceForge — NoteElement.js
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
  onDragStart(e, ctx)     { /* stub */ }
  onDragMove(e, ctx)      { /* stub */ }
  onDragEnd(e, ctx)       { /* stub */ }
  onSelect(ctx)           { /* stub */ }
  onDeselect(ctx)         { /* stub */ }
}

if (typeof module !== 'undefined') module.exports = { NoteElement, _neNoteHeight, _NE_NOTE_W }