'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
let lines = fs.readFileSync('sequence-builder.test.js', 'utf8').split(NL)

// Remove old inline runner (lines 97-113, 0-indexed 96-112)
// These are: let _passed, let _failed, let _total, function test(){...}
// Find them by content to be safe
const startIdx = lines.findIndex(function(l) { return l === 'let _passed = 0' })
const endIdx   = lines.findIndex(function(l, i) { return i > startIdx && l === '}' })
if (startIdx === -1) { console.error('old runner not found'); process.exit(1) }
console.log('removing old runner lines ' + (startIdx+1) + ' to ' + (endIdx+1))
lines.splice(startIdx, endIdx - startIdx + 1)

// Remove the stale summary console.log line
const summaryIdx = lines.findIndex(function(l) { return l.indexOf('_passed} passed') !== -1 })
if (summaryIdx !== -1) {
  // Remove it and surrounding separator logs (up to 4 lines before/after)
  var bs = summaryIdx
  while (bs > 0 && (lines[bs-1].trim().startsWith('console.log') || lines[bs-1].trim() === '')) bs--
  var be = summaryIdx + 1
  while (be < lines.length && (lines[be].trim().startsWith('console.log') || lines[be].trim() === '')) be++
  console.log('removing stale summary lines ' + (bs+1) + ' to ' + be)
  lines.splice(bs, be - bs)
} else { console.log('no stale summary found') }

fs.writeFileSync('sequence-builder.test.js', lines.join(NL), 'utf8')
const count = (lines.join(NL).match(/^test\(/gm)||[]).length
console.log('done. test() calls: ' + count)