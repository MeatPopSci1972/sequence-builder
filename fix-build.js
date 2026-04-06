'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
let t = fs.readFileSync('sequence-builder.test.js', 'utf8')
const suites = require('./suites-data.js')

// Get entries for the three new groups only
var newGroups = ['MessageElement contract', 'NoteElement contract', 'FragmentElement contract']
var newEntries = suites.filter(function(s) { return newGroups.indexOf(s.group) !== -1 })
console.log('new entries: ' + newEntries.length)

// Build test lines grouped by group name
var groupBlocks = {}
for (var i = 0; i < newEntries.length; i++) {
  var s = newEntries[i]
  if (!groupBlocks[s.group]) groupBlocks[s.group] = []
  groupBlocks[s.group].push(
    'test(' + JSON.stringify(s.desc) + ', function() {' + NL +
    '  ;(' + s.fn.toString() + ')(freshStore, assert)' + NL +
    '})'
  )
}

var blocks = []
for (var g in groupBlocks) {
  blocks.push("setGroup('" + g + "')")
  blocks.push(groupBlocks[g].join(NL + NL))
}
var insertText = NL + NL + blocks.join(NL + NL)

// Insert before the execute block
var EXEC = ';(function runAll() {'
var ei = t.indexOf(EXEC)
if (ei === -1) { console.error('runAll not found'); process.exit(1) }
t = t.slice(0, ei) + insertText + NL + t.slice(ei)

fs.writeFileSync('sequence-builder.test.js', t, 'utf8')
console.log('done. test() calls: ' + (t.match(/^test\(/gm)||[]).length)