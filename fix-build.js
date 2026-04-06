'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
let lines = fs.readFileSync('sequence-builder.test.js', 'utf8').split(NL)

// Verify anchors are still at expected lines (1-indexed)
const checks = [[2179,'test('], [2075,'test('], [1315,'test(']]
for (var i = 0; i < checks.length; i++) {
  var li = checks[i][0] - 1
  if (!lines[li].startsWith(checks[i][1])) {
    console.error('ANCHOR MISS at line ' + checks[i][0] + ': ' + lines[li].slice(0,50))
    process.exit(1)
  }
}
console.log('anchors verified')

// Insert in descending order
lines.splice(2178, 0, "setGroup('regex contracts')")
lines.splice(2074, 0, "setGroup('schema + properties')")
lines.splice(1314, 0, "setGroup('bounding boxes + selection')")
console.log('setGroup calls inserted')

fs.writeFileSync('sequence-builder.test.js', lines.join(NL), 'utf8')
console.log('done')