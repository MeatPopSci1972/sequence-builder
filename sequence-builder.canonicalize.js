// sequence-builder.canonicalize.js
// Canonical SVG serializer — Issue #51
//
// v1 rules: attribute order, whitespace, numeric precision (scoped), xmlns root, sibling order preserved
// Out of scope: default elision, d/viewBox/transform/points numeric, CDATA, entity refs
// Numeric convention: parseFloat(n.toFixed(2)) — trailing zeros stripped
//   Known edge case: Math.round(1.005 * 100)/100 is unreliable in some JS engines; toFixed(2) is stable.
//
// No consumers in this issue. Wired into render gate (#52) and Suite 16 comparisons separately.

'use strict'

const { DOMParser, XMLSerializer } = require('@xmldom/xmldom')

/**
 * canonicalize(svgString) → canonicalString
 *
 * Guarantees:
 *   1. Same logical SVG → identical output bytes, every invocation
 *   2. Two semantically-equivalent inputs → identical output
 *   3. Empty / whitespace-only / non-string input → throws 'canonicalize: empty input'
 *   4. Malformed XML → throws with parser error message
 *   5. Non-SVG root element → throws 'canonicalize: root element must be <svg>'
 */
function canonicalize(svgString) {
  // ── Guard: type + empty ──────────────────────────────────────────────────
  if (typeof svgString !== 'string' || !svgString.trim()) {
    throw new Error('canonicalize: empty input')
  }

  // ── Parse ────────────────────────────────────────────────────────────────
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')

  // @xmldom/xmldom surfaces parse errors as a <parsererror> child, not a throw.
  const parsererror = doc.getElementsByTagName('parsererror')[0]
  if (parsererror) {
    throw new Error('canonicalize: ' + (parsererror.textContent || 'parse error').trim())
  }

  const root = doc.documentElement
  if (!root || root.tagName === 'parsererror') {
    throw new Error('canonicalize: parse error')
  }
  if (!root || root.tagName !== 'svg') {
    throw new Error('canonicalize: root element must be <svg>')
  }

  // ── Rules (not yet implemented — stubs in place) ─────────────────────────
  // Rule 5: ensure xmlns on root
  if (!root.hasAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }

  // Rule 1: sort attributes alphabetically on every element
  walkElements(root, sortAttributes)
  // Rule 2: strip insignificant whitespace text nodes
  stripWhitespaceTextNodes(root)
  // Rule 3: round numeric attributes to 2 decimal places (scoped list)
  walkElements(root, roundNumericAttributes)
  // Rule 4: sibling order preserved — no action required

  // ── Serialize ────────────────────────────────────────────────────────────
  return new XMLSerializer().serializeToString(root)
}

// -- Helpers -----------------------------------------------------------------

// Attributes whose values are plain finite numbers rounded to 2 decimal places.
// d, viewBox, transform, points excluded — each has its own grammar (v2 work).
const NUMERIC_ATTRS = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height',
  'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity'
])

/**
 * Rule 3: For each scoped numeric attribute on el, round to 2 decimal places.
 * Uses parseFloat(n.toFixed(2)) — trailing zeros stripped by String(n).
 */
function roundNumericAttributes(el) {
  NUMERIC_ATTRS.forEach(function(name) {
    if (!el.hasAttribute(name)) return
    const raw = el.getAttribute(name)
    const n = Number(raw)
    if (!isFinite(n)) return
    el.setAttribute(name, String(parseFloat(n.toFixed(2))))
  })
}

// Text-content elements whose text nodes must be preserved verbatim (Rule 2).
const TEXT_PRESERVE_TAGS = new Set(['text', 'tspan', 'title', 'desc'])

/**
 * Rule 2: Remove text nodes that contain only whitespace between elements.
 * Text nodes inside TEXT_PRESERVE_TAGS are left untouched.
 */
function stripWhitespaceTextNodes(node) {
  if (node.nodeType === 1 && TEXT_PRESERVE_TAGS.has(node.tagName)) return
  const toRemove = []
  let child = node.firstChild
  while (child) {
    if (child.nodeType === 3 && child.nodeValue.trim() === '') {
      toRemove.push(child)
    } else if (child.nodeType === 1) {
      stripWhitespaceTextNodes(child)
    }
    child = child.nextSibling
  }
  toRemove.forEach(function(n) { node.removeChild(n) })
}

/**
 * Walk every element node in the subtree rooted at node, calling fn(el).
 * Visits in document order (parent before children).
 */
function walkElements(node, fn) {
  if (node.nodeType === 1) fn(node)
  let child = node.firstChild
  while (child) {
    walkElements(child, fn)
    child = child.nextSibling
  }
}

/**
 * Rule 1: Re-order attributes on el alphabetically by name.
 * Namespace-prefixed names (e.g. xmlns:xlink) sort by full literal string.
 */
function sortAttributes(el) {
  const attrs = Array.from(el.attributes)
  if (attrs.length < 2) return
  attrs.sort(function(a, b) {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
  attrs.forEach(function(a) { el.removeAttribute(a.name) })
  attrs.forEach(function(a) { el.setAttribute(a.name, a.value) })
}

module.exports = { canonicalize }
