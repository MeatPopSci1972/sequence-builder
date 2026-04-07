'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
const SQ = String.fromCharCode(39)
let lines = fs.readFileSync('sequence-builder.html', 'utf8').split(NL)
if (!lines[3534].includes('setSelected') || !lines[3534].includes('message')) {
  console.error('anchor miss: ' + lines[3534].trim().slice(0,60))
  process.exit(1)
}
console.log('anchor ok:', lines[3534].trim())
lines[3534] = lines[3534].replace(
  'setSelected(store.getMessageById(m.id), ' + SQ + 'message' + SQ + ')',
  'setSelected(store.getMessageById(m.id), ' + SQ + 'message' + SQ + '); render()  // show endpoint handles'
)
console.log('patched:', lines[3534].trim())
fs.writeFileSync('sequence-builder.html', lines.join(NL), 'utf8')
console.log('done')