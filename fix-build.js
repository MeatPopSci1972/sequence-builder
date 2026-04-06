'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
let lines = fs.readFileSync('sequence-builder.test.js', 'utf8').split(NL)

// Remove any existing misplaced console.log group headers we added
lines = lines.filter(function(l) {
  return !(l === "console.log('\\nULID ID contract')" || l === "console.log('\\nActorElement contract')")
})

// Re-insert console.log headers immediately BEFORE the first test() call
// in each group — found by looking for the comment then the next test() line
var result = []
var i = 0
while (i < lines.length) {
  var l = lines[i]
  // Detect group header comments by content
  if (l.indexOf('ULID ID contract') !== -1 && l.startsWith('//')) {
    result.push(l)  // keep the comment
    result.push("console.log('\\nULID ID contract')")
    i++; continue
  }
  if (l.indexOf('ActorElement contract') !== -1 && l.startsWith('//')) {
    result.push(l)  // keep the comment
    result.push("console.log('\\nActorElement contract')")
    i++; continue
  }
  result.push(l)
  i++
}

fs.writeFileSync('sequence-builder.test.js', result.join(NL), 'utf8')
console.log('done. lines: ' + result.length)