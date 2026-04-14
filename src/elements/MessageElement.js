// Sequence Builder — MessageElement.js
// Implements SequenceElement for message records.
// Audience: Human + fresh AI instance
//
// Store record shape:
//   { id, fromId, toId, label, kind, direction, y,
//     protocol?, port?, auth?, dataClass?, schema, properties }
//
// getBounds() requires actor positions — passed via ctx.getActorById().
// For hitTest() without ctx, a conservative y-band is used.

class MessageElement /* extends SequenceElement */ {
  constructor(data) {
    this._data = data
  }

  get id() { return this._data.id }

  /**
   * Bounding box in SVG space.
   * Requires ctx.getActorById to resolve x positions.
   * Falls back to a default span if ctx is not provided.
   * @param {object} [ctx] — InteractionContext with getActorById(id)
   * @returns {{ x, y, w, h }}
   */
  getBounds(ctx) {
    const y = this._data.y || 0
    const h = 24 // hit band above and below the line
    if (ctx && ctx.getActorById) {
      const from = ctx.getActorById(this._data.fromId)
      const to   = ctx.getActorById(this._data.toId)
      if (from && to) {
        const x1 = from.x + 55  // actorCenterX = x + ACTOR_W/2
        const x2 = to.x   + 55
        const x  = Math.min(x1, x2)
        const w  = Math.abs(x2 - x1) || 60
        return { x, y: y - h / 2, w, h }
      }
    }
    // No ctx — return a positional stub
    return { x: 0, y: y - h / 2, w: 200, h }
  }

  /**
   * Hit test against the message y-band.
   * @param {number} px
   * @param {number} py
   * @param {object} [ctx]
   * @returns {boolean}
   */
  hitTest(px, py, ctx) {
    const { x, y, w, h } = this.getBounds(ctx)
    return px >= x && px <= x + w && py >= y && py <= y + h
  }

  /**
   * Properties schema for the Properties panel.
   * @returns {Array}
   */
  getPropertiesSchema() {
    return [
      { key: 'label',     label: 'Label',     type: 'text' },
      { key: 'kind',      label: 'Kind',      type: 'select',
        options: ['sync', 'async', 'return'] },
      { key: 'direction', label: 'Direction', type: 'select',
        options: ['right', 'left', 'both'] },
      { key: 'fromId',    label: 'From',      type: 'actor-ref' },
      { key: 'toId',      label: 'To',        type: 'actor-ref' },
      { key: 'protocol',  label: 'Protocol',  type: 'text' },
      { key: 'port',      label: 'Port',      type: 'text' },
      { key: 'auth',      label: 'Auth',      type: 'text' },
      { key: 'dataClass', label: 'Data Class',type: 'select',
        options: ['Public', 'Internal', 'Confidential', 'PII', 'PHI', 'Secret'] },
    ]
  }

  render(layer, ctx)      { throw new Error('MessageElement.render() not yet wired') }
  renderSelected(il, ctx) { /* stub */ }
  onDragStart(e, ctx)     { /* stub */ }
  onDragMove(e, ctx)      { /* stub */ }
  onDragEnd(e, ctx)       { /* stub */ }
  onSelect(ctx)           { /* stub */ }
  onDeselect(ctx)         { /* stub */ }
}

if (typeof module !== 'undefined') module.exports = { MessageElement }