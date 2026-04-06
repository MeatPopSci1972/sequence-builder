'use strict'
const fs = require('fs')
const t = fs.readFileSync('sequence-builder.html', 'utf8')
const NL = String.fromCharCode(10)
const start = t.indexOf('// \u2500\u2500 Actor move overlay')
const end = t.indexOf('// \u2500\u2500 Note / fragment drag', start)
if (start === -1) { console.error('start not found'); process.exit(1) }
const lines = t.slice(start, end).split(NL)
lines.forEach(function(l, i) {
  const safe = Buffer.from(l).toString('hex')
  console.log(i + ': ' + safe)
})