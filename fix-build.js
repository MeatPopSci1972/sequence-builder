'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
let lines = fs.readFileSync('sequence-builder.test.js', 'utf8').split(NL)

// Remove all existing standalone setGroup() calls
lines = lines.filter(function(l) { return !l.match(/^setGroup\(/) })

// Insert setGroup() at the known first test line of each group.
// Line numbers are 1-indexed from the filtered file.
// We insert in DESCENDING line order so earlier positions stay valid.
// Each entry: [line_number_of_first_test_in_group, group_name]
// Determined from ground truth scan above.
var insertions = [
  [2155, 'regex contracts'],
  [2075, 'schema + properties'],
  [1997, 'canvas pan + nudge'],
  [1674, 'message label + inline edit'],
  [1315, 'bounding boxes + selection'],
  [1064, 'end-to-end'],
  [856,  '_parseUML'],
  [611,  'REDO'],
  [513,  'UNDO'],
  [447,  'meta.undoable'],
  [356,  'UPDATE_MESSAGE'],
  [269,  'DELETE_ACTOR cascade'],
  [133,  'ADD_ACTOR']
]

// Verify each insertion line starts with test(
var ok = true
for (var i = 0; i < insertions.length; i++) {
  var li = insertions[i][0] - 1  // 0-indexed
  if (!lines[li] || !lines[li].startsWith('test(')) {
    console.log('WARN: line ' + insertions[i][0] + ' is not test(): ' + (lines[li]||'').slice(0,40))
    ok = false
  }
}
if (!ok) { console.error('verification failed'); process.exit(1) }

// Insert in descending order (already sorted above)
for (var i = 0; i < insertions.length; i++) {
  var li = insertions[i][0] - 1
  lines.splice(li, 0, 'setGroup(' + JSON.stringify(insertions[i][1]) + ')')
}
console.log('inserted ' + insertions.length + ' setGroup() calls')

// Insert setGroup for ULID and AE — find their first test() lines
var joined = lines.join(NL)
var ulidFirst = joined.indexOf(NL + 'test(', joined.indexOf('// ── ULID ID contract'))
var aeFirst   = joined.indexOf(NL + 'test(', joined.indexOf('// ── ActorElement contract'))
if (ulidFirst !== -1) {
  joined = joined.slice(0, ulidFirst+1) + "setGroup('ULID ID contract')" + NL + joined.slice(ulidFirst+1)
  console.log('inserted ULID setGroup')
}
var aeFirst2 = joined.indexOf(NL + 'test(', joined.indexOf('// ── ActorElement contract'))
if (aeFirst2 !== -1) {
  joined = joined.slice(0, aeFirst2+1) + "setGroup('ActorElement contract')" + NL + joined.slice(aeFirst2+1)
  console.log('inserted AE setGroup')
}

fs.writeFileSync('sequence-builder.test.js', joined, 'utf8')
console.log('done. length=' + joined.length)