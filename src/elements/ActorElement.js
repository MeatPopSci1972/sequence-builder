// SequenceForge — ActorElement.js
// Implements SequenceElement for actor (participant) records.
// Audience: Human + fresh AI instance
//
// Store record shape:
//   { id, x, label, type, emoji?, schema, properties }
//
// Geometry constants mirror the HTML app (injected at build time as STORE_ prefixed).
// ActorElement uses its own local constants to remain testable in Node without the app.

const _AE_ACTOR_W = 110
const _AE_ACTOR_H = 42 // matches ACTOR_H in the HTML app

class ActorElement /* extends SequenceElement */ {
  constructor(data) {
    // Note: extends SequenceElement omitted here — SequenceElement is defined
    // in a separate file loaded before this one at build time.
    // In tests, ActorElement is required standalone, so we skip the super() call.
    this._data = data
  }

  get id() {
    return this._data.id
  }

  /**
   * Bounding box: top-left corner of the actor head box in SVG space.
   * x = data.x, y = 8 (fixed top margin), w = ACTOR_W, h = ACTOR_H
   * @returns {{ x, y, w, h }}
   */
  getBounds() {
    return { x: this._data.x, y: 8, w: _AE_ACTOR_W, h: _AE_ACTOR_H }
  }

  /**
   * Hit test against the actor head bounding box.
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
      { key: 'label', label: 'Label', type: 'text' },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: ['actor-person', 'actor-system', 'actor-db', 'actor-queue']
      },
      { key: 'emoji', label: 'Emoji', type: 'text' }
    ]
  }

  // render(), renderSelected(), onDragStart/Move/End, onSelect, onDeselect
  // will be implemented in a future session when the canvas dispatcher is wired.
  render(layer, ctx) {
    throw new Error('ActorElement.render() not yet wired')
  }
  renderSelected(il, ctx) {
    /* stub */
  }
  onDragStart(e, ctx) {
    /* stub */
  }
  onDragMove(e, ctx) {
    /* stub */
  }
  onDragEnd(e, ctx) {
    /* stub */
  }
  onSelect(ctx) {
    /* stub */
  }
  onDeselect(ctx) {
    /* stub */
  }
}

if (typeof module !== 'undefined') module.exports = { ActorElement, _AE_ACTOR_W, _AE_ACTOR_H }
