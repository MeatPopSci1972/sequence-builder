#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  SequenceForge — build.js
//  Syncs sequence-builder.store.js → sequence-builder.html
//
//  What it does:
//    1. Reads sequence-builder.store.js
//    2. Strips the CommonJS export block (module.exports = { ... })
//    3. Strips the trailing comment that precedes it
//    4. Splices the result into sequence-builder.html between:
//         // @@STORE-START
//         // @@STORE-END
//    5. Writes sequence-builder.html in place
//
//  Usage:
//    node build.js
//
//  Gate (run after build):
//    node build.js && \
//    sed -n '/<script>/,/<\/script>/p' sequence-builder.html \
//      | sed '1s/<script>//' | sed '$s/<\/script>//' > sf-script.js && \
//    node --check sf-script.js && \
//    node sequence-builder.test.js
//
//  Zero dependencies. Node 14+.
// ═══════════════════════════════════════════════════════════════

'use strict'

const fs   = require('fs')
const path = require('path')

// ── Paths ────────────────────────────────────────────────────
const ROOT      = path.dirname(__filename)
const STORE_SRC = path.join(ROOT, 'sequence-builder.store.js')
const HTML_SRC  = path.join(ROOT, 'sequence-builder.html')

const SENTINEL_START = '// @@STORE-START'
const SENTINEL_END   = '// @@STORE-END'

// ── Read sources ─────────────────────────────────────────────
if (!fs.existsSync(STORE_SRC)) fatal(`Store source not found: ${STORE_SRC}`)
if (!fs.existsSync(HTML_SRC))  fatal(`HTML target not found:  ${HTML_SRC}`)

const storeRaw = fs.readFileSync(STORE_SRC, 'utf8')
const htmlRaw  = fs.readFileSync(HTML_SRC,  'utf8')

// ── Validate sentinels ───────────────────────────────────────
const startIdx = htmlRaw.indexOf(SENTINEL_START)
const endIdx   = htmlRaw.indexOf(SENTINEL_END)

if (startIdx === -1) fatal(`Sentinel not found in HTML: ${SENTINEL_START}`)
if (endIdx   === -1) fatal(`Sentinel not found in HTML: ${SENTINEL_END}`)
if (startIdx >= endIdx) fatal('@@STORE-START must appear before @@STORE-END')

const startCount = (htmlRaw.match(/\/\/ @@STORE-START/g) || []).length
const endCount   = (htmlRaw.match(/\/\/ @@STORE-END/g)   || []).length
if (startCount !== 1) fatal(`Expected exactly 1 @@STORE-START, found ${startCount}`)
if (endCount   !== 1) fatal(`Expected exactly 1 @@STORE-END, found ${endCount}`)

// ── Strip CommonJS export block from store source ────────────
//
//  Removes everything from the trailing comment block that
//  precedes module.exports through the end of the exports block.
//
//  Target pattern (exact text from store.js):
//
//    // ── CommonJS export ──...
//    // Compatible with Node ...
//    // In the single-file HTML ...
//    // replace this block with: ...
//    module.exports = {
//      ...
//    }
//
//  Strategy: find `module.exports` and walk back to find the
//  comment block that belongs to it, then excise both.

let storeBody = storeRaw

// Remove module.exports block (including its leading comment)
storeBody = storeBody.replace(
  /\n\/\/ ── CommonJS export.*?\nmodule\.exports\s*=\s*\{[^}]*\}\n?/s,
  '\n'
)

// Verify module.exports is gone (build fails loudly, not silently)
if (/module\.exports/.test(storeBody)) {
  fatal('module.exports still present after strip — pattern may need updating')
}

// ── Rename store-local constants that collide with app-level names ──
//
//  store.js uses ACTOR_W and ACTOR_GAP as module-level constants.
//  The HTML app declares its own ACTOR_W / ACTOR_H / ACTOR_GAP for
//  rendering. To avoid duplicate `const` errors, prefix the store
//  copies with STORE_ on inject — matching the convention already
//  established in the original hand-maintained IIFE.
//
//  Word-boundary replace so e.g. ACTOR_WIDTH is not touched.
const RENAMES = [
  [/\bACTOR_W\b/g,    'STORE_ACTOR_W'],
  [/\bACTOR_GAP\b/g,  'STORE_ACTOR_GAP'],
  [/\bUNDO_LIMIT\b/g, 'STORE_UNDO_LIMIT'],
]
for (const [pattern, replacement] of RENAMES) {
  storeBody = storeBody.replace(pattern, replacement)
}

// Trim trailing whitespace/newlines, leave a single newline
storeBody = storeBody.trimEnd() + '\n'

// ── Indent: match the surrounding script indentation ─────────
//
//  The sentinel lines in the HTML are indented with 0 leading
//  spaces (they sit at column 0 inside the <script> block).
//  store.js functions also start at column 0.
//  No re-indentation needed — but we verify by checking the
//  sentinel's own leading whitespace and warning if non-zero.

const sentinelLine = htmlRaw.slice(
  htmlRaw.lastIndexOf('\n', startIdx) + 1,
  startIdx
)
if (sentinelLine.trim() !== '' && sentinelLine !== '') {
  warn(`@@STORE-START has leading whitespace: ${JSON.stringify(sentinelLine)} — store content will not match indentation`)
}

// ── Splice ───────────────────────────────────────────────────
//
//  Keep the sentinel lines themselves; replace only the content
//  between them.
//
//  Before:
//    // @@STORE-START\n
//    <old content>\n
//    // @@STORE-END\n
//
//  After:
//    // @@STORE-START\n
//    <new content>\n
//    // @@STORE-END\n

const before = htmlRaw.slice(0, startIdx + SENTINEL_START.length)
const after  = htmlRaw.slice(endIdx)    // includes @@STORE-END and everything after

const htmlOut = before + '\n' + storeBody + after

// ── Inject themes.json as window._SF_THEMES ─────────────────
//
//  themes.json is the source of truth. At build time we read it
//  and splice it between @@THEMES-START / @@THEMES-END so the
//  standalone HTML works without any fetch (GitHub Pages safe).

const THEMES_SRC   = path.join(ROOT, 'themes.json')
const THEMES_START = '// @@THEMES-START'
const THEMES_END   = '// @@THEMES-END'

let htmlFinal = htmlOut

if (fs.existsSync(THEMES_SRC)) {
  const themesRaw  = fs.readFileSync(THEMES_SRC, 'utf8')
  const themesData = JSON.parse(themesRaw) // validate JSON before injecting
  const injection  = `window._SF_THEMES = ${JSON.stringify(themesData, null, 2)};`

  const tStart = htmlFinal.indexOf(THEMES_START)
  const tEnd   = htmlFinal.indexOf(THEMES_END)

  if (tStart !== -1 && tEnd !== -1 && tStart < tEnd) {
    const tBefore = htmlFinal.slice(0, tStart + THEMES_START.length)
    const tAfter  = htmlFinal.slice(tEnd) // includes @@THEMES-END and rest
    htmlFinal = tBefore + '\n' + injection + '\n' + tAfter
  } else {
    warn('@@THEMES-START / @@THEMES-END sentinels not found — themes not injected')
  }
} else {
  warn('themes.json not found — themes not injected')
}

// ── Inject elements (src/elements/*.js) ────────────────────────────────────
// Concatenates all element source files between @@ELEMENTS-START / @@ELEMENTS-END.
// SequenceElement.js is always injected first (base class), then others alphabetically.
const ELEMENTS_DIR   = path.join(ROOT, 'src', 'elements')
const ELEMENTS_START = '// @@ELEMENTS-START'
const ELEMENTS_END   = '// @@ELEMENTS-END'

const NL = String.fromCharCode(10)
if (fs.existsSync(ELEMENTS_DIR)) {
  let elementFiles = fs.readdirSync(ELEMENTS_DIR).filter(f => f.endsWith('.js')).sort()
  // SequenceElement must be first — base class must be defined before subclasses
  const seIdx = elementFiles.indexOf('SequenceElement.js')
  if (seIdx > 0) { elementFiles.splice(seIdx, 1); elementFiles.unshift('SequenceElement.js') }

  const elementBodies = elementFiles.map(f => {
    let src = fs.readFileSync(path.join(ELEMENTS_DIR, f), 'utf8')
    const exportMarker = "if (typeof module !== 'undefined')"
    const exportIdx = src.lastIndexOf(exportMarker)
    if (exportIdx !== -1) src = src.slice(0, exportIdx).trimEnd() + NL
    return '// ── ' + f + ' ──' + NL + src.trimEnd()
  }).join(NL + NL)

  const eStart = htmlFinal.indexOf(ELEMENTS_START)
  const eEnd   = htmlFinal.indexOf(ELEMENTS_END)

  if (eStart !== -1 && eEnd !== -1 && eStart < eEnd) {
    const eBefore = htmlFinal.slice(0, eStart + ELEMENTS_START.length)
    const eAfter  = htmlFinal.slice(eEnd)
    htmlFinal = eBefore + NL + elementBodies + NL + eAfter
    console.log('  element files injected : ' + elementFiles.join(', '))
  } else {
    warn('@@ELEMENTS-START / @@ELEMENTS-END sentinels not found — elements not injected')
  }
} else {
  warn('src/elements/ directory not found — elements not injected')
}

// ── Write ────────────────────────────────────────────────────
fs.writeFileSync(HTML_SRC, htmlFinal, 'utf8')

// ── Report ───────────────────────────────────────────────────
const storeLines = storeBody.split('\n').length
const htmlLines  = htmlFinal.split('\n').length
console.log(`✓ build.js complete`)
console.log(`  store lines injected : ${storeLines}`)
console.log(`  html total lines     : ${htmlLines}`)
console.log(`  sentinel span        : ${HTML_SRC} lines ${findLineNumber(htmlFinal, SENTINEL_START)}–${findLineNumber(htmlFinal, SENTINEL_END)}`)

// ── Helpers ──────────────────────────────────────────────────
function findLineNumber(text, needle) {
  const idx = text.indexOf(needle)
  if (idx === -1) return '?'
  return text.slice(0, idx).split('\n').length
}

function fatal(msg) {
  console.error(`✗ build.js error: ${msg}`)
  process.exit(1)
}

function warn(msg) {
  console.warn(`⚠ build.js warning: ${msg}`)
}
