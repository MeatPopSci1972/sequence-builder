// sequence-builder.canonicalize.test.js
// Suite: Canonicalize — Issue #51
// TDD progression: Step 1 (guards) → Step 2 (parse) → Steps 3-6 (rules) → Step 7 (integration)
// Remove .skip markers as each step is implemented.

'use strict'

const { canonicalize } = require('./sequence-builder.canonicalize')

const SUITE = 'Canonicalize'

function run() {
  const results = []

  function test(name, fn) {
    try {
      fn()
      results.push({ suite: SUITE, name, ok: true })
    } catch (e) {
      results.push({ suite: SUITE, name, ok: false, error: e.message })
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'assertion failed')
  }

  function assertThrows(fn, expectedMsg) {
    let threw = false
    try { fn() } catch (e) {
      threw = true
      if (expectedMsg && !e.message.includes(expectedMsg)) {
        throw new Error('Expected error containing "' + expectedMsg + '" but got: ' + e.message)
      }
    }
    if (!threw) throw new Error('Expected a throw but function returned normally')
  }

  // ── Step 1: Input guards ─────────────────────────────────────────────────

  test('empty string throws canonicalize: empty input', () => {
    assertThrows(() => canonicalize(''), 'canonicalize: empty input')
  })

  test('whitespace-only string throws canonicalize: empty input', () => {
    assertThrows(() => canonicalize('   \n\t  '), 'canonicalize: empty input')
  })

  test('null throws canonicalize: empty input', () => {
    assertThrows(() => canonicalize(null), 'canonicalize: empty input')
  })

  test('undefined throws canonicalize: empty input', () => {
    assertThrows(() => canonicalize(undefined), 'canonicalize: empty input')
  })

  test('number throws canonicalize: empty input', () => {
    assertThrows(() => canonicalize(42), 'canonicalize: empty input')
  })

  // ── Step 2: Parse errors and root validation ─────────────────────────────

  test('malformed XML throws with parse error', () => {
    // @xmldom/xmldom is lenient with unclosed tags; plain non-XML text produces null root
    assertThrows(() => canonicalize('plain text no tags'), 'canonicalize:')
  })

  test('non-SVG root throws canonicalize: root element must be <svg>', () => {
    assertThrows(
      () => canonicalize('<html></html>'),
      'canonicalize: root element must be <svg>'
    )
  })

  // ── Step 3: Rule 1 — Attribute order (SKIP until implemented) ────────────

  test.skip = function(name) {
    results.push({ suite: SUITE, name: name + ' [SKIP]', ok: true })
  }

  test('Rule1: attributes sort alphabetically within element', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="5" fill="red" y="10"/></svg>'
    const out = canonicalize(input)
    // fill comes before x comes before y alphabetically
    assert(out.indexOf('fill') < out.indexOf(' x='), 'fill should come before x')
    assert(out.indexOf(' x=') < out.indexOf(' y='), 'x should come before y')
  })

  test('Rule1: two inputs differing only in attr order produce identical output', () => {
    const a = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="5" fill="red" y="10"/></svg>'
    const b = '<svg xmlns="http://www.w3.org/2000/svg"><rect y="10" x="5" fill="red"/></svg>'
    assert(canonicalize(a) === canonicalize(b), 'different attr order should produce identical canonical output')
  })

  // ── Step 4: Rule 2 — Whitespace (SKIP until implemented) ────────────────

  test('Rule2: inter-element whitespace stripped', () => {
    const parts = ['<svg xmlns="http://www.w3.org/2000/svg">', '  <rect x="1" y="2"/>', '  <circle cx="5" cy="5" r="3"/>', '</svg>']
    const input = parts.join('\n')
    const out = canonicalize(input)
    assert(!/>[\s]+</.test(out), 'whitespace-only text nodes between elements should be stripped: ' + JSON.stringify(out))
  })

  test('Rule2: text node content preserved verbatim', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello World</text></svg>'
    const out = canonicalize(input)
    assert(out.indexOf('Hello World') !== -1, 'text content should be preserved: ' + out)
  })

  test('Rule2: text node with leading/trailing spaces preserved', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><text>  spaced  </text></svg>'
    const out = canonicalize(input)
    assert(out.indexOf('  spaced  ') !== -1, 'leading/trailing spaces in text should be preserved: ' + out)
  })

  // ── Step 5: Rule 3 — Numeric precision (SKIP until implemented) ──────────

  test('Rule3: x="10" stays x="10"', () => {
    const out = canonicalize('<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="0" width="1" height="1"/></svg>')
    assert(out.indexOf('x="10"') !== -1, 'x=10 should stay 10, got: ' + out)
  })

  test('Rule3: x="10.0" becomes x="10"', () => {
    const out = canonicalize('<svg xmlns="http://www.w3.org/2000/svg"><rect x="10.0" y="0" width="1" height="1"/></svg>')
    assert(out.indexOf('x="10"') !== -1, 'x=10.0 should become 10, got: ' + out)
  })

  test('Rule3: x="10.001" rounds to x="10"', () => {
    const out = canonicalize('<svg xmlns="http://www.w3.org/2000/svg"><rect x="10.001" y="0" width="1" height="1"/></svg>')
    assert(out.indexOf('x="10"') !== -1, 'x=10.001 should round to 10, got: ' + out)
  })

  test('Rule3: x="10.567" rounds to x="10.57"', () => {
    const out = canonicalize('<svg xmlns="http://www.w3.org/2000/svg"><rect x="10.567" y="0" width="1" height="1"/></svg>')
    assert(out.indexOf('x="10.57"') !== -1, 'x=10.567 should round to 10.57, got: ' + out)
  })

  test('Rule3: x="10.5" stays x="10.5"', () => {
    const out = canonicalize('<svg xmlns="http://www.w3.org/2000/svg"><rect x="10.5" y="0" width="1" height="1"/></svg>')
    assert(out.indexOf('x="10.5"') !== -1, 'x=10.5 should stay 10.5, got: ' + out)
  })

  test('Rule3: d attribute is NOT rounded (out of scope)', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 10.001 20.001"/></svg>'
    const out = canonicalize(input)
    assert(out.indexOf('10.001') !== -1, 'd attribute should not be rounded, got: ' + out)
  })

  // ── Step 6: Rule 5 — xmlns on root (SKIP until implemented) ─────────────

  test('Rule5: input without xmlns gets xmlns added', () => {
    const out = canonicalize('<svg><rect x="1" y="2" width="3" height="4"/></svg>')
    assert(out.indexOf('xmlns="http://www.w3.org/2000/svg"') !== -1, 'xmlns should be added: ' + out)
  })

  test('Rule5: input with xmlns preserves it (not duplicated)', () => {
    const out = canonicalize('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    const count = out.split('xmlns=').length - 1
    assert(count === 1, 'xmlns should appear exactly once, got ' + count + ': ' + out)
  })

  // ── Step 7: Integration (SKIP until rules implemented) ──────────────────

  test('Integration: semantically equivalent inputs produce identical output', () => {
    const a = '<svg xmlns="http://www.w3.org/2000/svg">\n  <rect x="5.001" fill="red" y="10.0"/>\n</svg>'
    const b = '<svg xmlns="http://www.w3.org/2000/svg"><rect y="10" x="5" fill="red"/></svg>'
    assert(canonicalize(a) === canonicalize(b), 'semantically equivalent inputs should canonicalize identically')
  })

  test('Integration: inputs with different content produce different output', () => {
    const a = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="3" height="4"/></svg>'
    const b = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="3" height="4"/></svg>'
    assert(canonicalize(a) !== canonicalize(b), 'inputs with different content should not be equal')
  })

  // Amendment 4: known empty canonical form frozen before implementation.
  // This exact byte string is the sentinel that future consumers (render gate) reject.
  test('Integration: empty SVG has known canonical form', () => {
    const KNOWN_EMPTY = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    assert(canonicalize('<svg xmlns="http://www.w3.org/2000/svg"></svg>') === KNOWN_EMPTY,
      'empty SVG canonical form has changed — update the KNOWN_EMPTY sentinel')
  })

  return results
}

module.exports = { run }
