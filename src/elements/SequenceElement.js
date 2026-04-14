// Sequence Builder — SequenceElement.js
// Base contract for all diagram elements.
// Audience: Human + fresh AI instance
//
// Every element type (Actor, Message, Note, Fragment) implements this contract.
// The canvas calls these methods — elements never call each other.
// The store is injected via InteractionContext, never captured in the constructor.
//
// ENCAPSULATION RULES (enforced by Suite 18 tests):
//   - Elements never call render() themselves
//   - Elements never reference other elements
//   - store is accessed only through ctx.store (injected at drag/select time)
//   - Constructor receives only the store data record
//
// InteractionContext shape (passed to drag/select methods):
//   ctx.store     — live store reference (dispatch, getActorById, etc.)
//   ctx.svgEl     — svgEl() factory function
//   ctx.uiState   — current uiState snapshot
//   ctx.render    — canvas render() function

/**
 * SequenceElement — base interface.
 * Subclasses must override all methods marked @abstract.
 */
class SequenceElement {
  /**
   * @param {object} data — the store record (actor, message, note, or fragment)
   */
  constructor(data) {
    if (new.target === SequenceElement) {
      throw new Error('SequenceElement is abstract — use ElementFactory.create()')
    }
    this._data = data
  }

  /** @returns {string} the element's ULID-format id */
  get id() {
    return this._data.id
  }

  /**
   * Returns the bounding box in SVG coordinate space.
   * @abstract
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  getBounds() {
    throw new Error(this.constructor.name + '.getBounds() not implemented')
  }

  /**
   * Returns true if the given SVG point is inside this element's hit area.
   * @abstract
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  hitTest(x, y) {
    throw new Error(this.constructor.name + '.hitTest() not implemented')
  }

  /**
   * Returns the properties schema for the Properties panel.
   * @abstract
   * @returns {Array<{ key: string, label: string, type: string, options?: string[] }>}
   */
  getPropertiesSchema() {
    throw new Error(this.constructor.name + '.getPropertiesSchema() not implemented')
  }

  /**
   * Renders this element into the given SVG layer.
   * Called by the canvas on every render pass — never call this yourself.
   * @abstract
   * @param {SVGGElement} layer — target SVG layer element
   * @param {object} ctx — InteractionContext
   */
  render(layer, ctx) {
    throw new Error(this.constructor.name + '.render() not implemented')
  }

  /**
   * Renders the selection overlay into the interaction layer.
   * Only called when this element is selected.
   * @param {SVGGElement} interactionLayer
   * @param {object} ctx — InteractionContext
   */
  renderSelected(interactionLayer, ctx) {
    /* default: no-op — override for selection chrome */
  }

  /**
   * Called when the user begins dragging this element.
   * @param {MouseEvent} e
   * @param {object} ctx — InteractionContext
   */
  onDragStart(e, ctx) {
    /* default: no-op */
  }

  /**
   * Called on each mousemove during a drag.
   * @param {MouseEvent} e
   * @param {object} ctx — InteractionContext
   */
  onDragMove(e, ctx) {
    /* default: no-op */
  }

  /**
   * Called when the drag ends (mouseup).
   * @param {MouseEvent} e
   * @param {object} ctx — InteractionContext
   */
  onDragEnd(e, ctx) {
    /* default: no-op */
  }

  /**
   * Called when this element becomes selected.
   * @param {object} ctx — InteractionContext
   */
  onSelect(ctx) {
    /* default: no-op */
  }

  /**
   * Called when this element is deselected.
   * @param {object} ctx — InteractionContext
   */
  onDeselect(ctx) {
    /* default: no-op */
  }
}

if (typeof module !== 'undefined') module.exports = { SequenceElement }
