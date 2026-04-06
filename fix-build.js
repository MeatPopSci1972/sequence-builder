'use strict'
const fs = require('fs')
let t = fs.readFileSync('sf-preflight.ps1','utf8')
const before = (t.match(/137/g)||[]).length
t = t.split('-eq 137').join('-eq 156')
t = t.split('/ 137').join('/ 156')
const after = (t.match(/137/g)||[]).length
fs.writeFileSync('sf-preflight.ps1', t, 'utf8')
console.log('137 occurrences: before=' + before + ' after=' + after)