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
    onDragStart(e, ctx) {
    const frag = this._data
    const cr = ctx.canvasWrap.getBoundingClientRect()
    ctx._drag = {
      type: 'fragment', baseX: frag.x, baseY: frag.y,
      offsetX: (e.clientX - cr.left) / ctx.zoom - frag.x,
      offsetY: (e.clientY - cr.top)  / ctx.zoom - frag.y,
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
      ctx.store.dispatch({ type: 'MOVE_FRAGMENT',
        payload: { id: this._data.id, x: this._data.x, y: this._data.y } })
      setTimeout(ctx.render, 0)
    }
    ctx._drag = null
  }
  onSelect(ctx)           { /* stub */ }
  onDeselect(ctx)         { /* stub */ }
}

if (typeof module !== 'undefined') module.exports = { FragmentElement }