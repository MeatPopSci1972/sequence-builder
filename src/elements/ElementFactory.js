// SequenceForge — ElementFactory.js
// Factory that maps store data records to SequenceElement instances.
// Audience: Human + fresh AI instance
//
// Usage:
//   const el = ElementFactory.create(storeRecord);
//   el.render(layer, ctx);
//
// The factory inspects the record shape to determine element type.
// Type detection order: fragment > message > note > actor (by unique fields).
//
// ZERO side effects — create() is a pure mapping function.

class ElementFactory {
  /**
   * Creates a SequenceElement instance from a store data record.
   * @param {object} data — actor, message, note, or fragment store record
   * @returns {SequenceElement}
   */
  static create(data) {
    if (!data || !data.id) throw new Error('ElementFactory.create: data must have an id')
    // In Node (tests), classes from sibling files are not in scope — require them locally.
    // In the browser bundle, build.js injects all files into shared scope — typeof checks prevent double-require.
    const _ActorElement =
      typeof ActorElement !== 'undefined' ? ActorElement : require('./ActorElement.js').ActorElement
    // Type detection by unique field signature
    if ('w' in data && 'h' in data && 'kind' in data) return new FragmentElement(data)
    if ('fromId' in data && 'toId' in data) return new MessageElement(data)
    if ('text' in data && !('label' in data)) return new NoteElement(data)
    if ('label' in data && 'type' in data) return new _ActorElement(data)
    throw new Error('ElementFactory.create: unrecognised record shape for id=' + data.id)
  }
}

if (typeof module !== 'undefined') module.exports = { ElementFactory }
