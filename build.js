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

// ── Write ────────────────────────────────────────────────────
fs.writeFileSync(HTML_SRC, htmlOut, 'utf8')

// ── Report ───────────────────────────────────────────────────
const storeLines = storeBody.split('\n').length
const htmlLines  = htmlOut.split('\n').length
console.log(`✓ build.js complete`)
console.log(`  store lines injected : ${storeLines}`)
console.log(`  html total lines     : ${htmlLines}`)
console.log(`  sentinel span        : ${HTML_SRC} lines ${findLineNumber(htmlOut, SENTINEL_START)}–${findLineNumber(htmlOut, SENTINEL_END)}`)

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
