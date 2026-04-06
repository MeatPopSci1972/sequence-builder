// SequenceForge — FragmentElement.js
// Implements SequenceElement for fragment (alt/loop/opt) records.
// Audience: Human + fresh AI instance
//
// Store record shape: { id, x, y, w, h, kind, cond }
//
// Geometry is stored directly on the record — no derived dimensions.

class FragmentElement /* extends SequenceElement */ {
  constructor(data) {
    this._data = data
  }

  get id() { return this._data.id }

  /**
   * Bounding box — taken directly from the stored geometry.
   * @returns {{ x, y, w, h }}
   */
  getBounds() {
    return { x: this._data.x, y: this._data.y, w: this._data.w, h: this._data.h }
  }

  /**
   * Hit test against the fragment bounding box.
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
      { key: 'kind', label: 'Kind', type: 'select',
        options: ['frag-alt', 'frag-loop', 'frag-opt'] },
      { key: 'cond', label: 'Condition', type: 'text' },
    ]
  }

  render(layer, ctx)      { throw new Error('FragmentElement.render() not yet wired') }
  renderSelected(il, ctx) { /* stub */ }
  onDragStart(e, ctx)     { /* stub */ }
  onDragMove(e, ctx)      { /* stub */ }
  onDragEnd(e, ctx)       { /* stub */ }
  onSelect(ctx)           { /* stub */ }
  onDeselect(ctx)         { /* stub */ }
}

if (typeof module !== 'undefined') module.exports = { FragmentElement }