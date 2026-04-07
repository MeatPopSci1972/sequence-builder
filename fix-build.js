'use strict'
const cp = require('child_process'), fs = require('fs')
const t = fs.readFileSync('sequence-builder.html', 'utf8')
fs.writeFileSync('_check.js', t.slice(t.indexOf('// @@STORE-START'), t.indexOf('// @@EVENTS-END')+15), 'utf8')
try { cp.execSync('node --check _check.js 2>&1', {encoding:'utf8'}); fs.writeFileSync('syntax-err.json', JSON.stringify({ok:true}), 'utf8') }
catch(e) { fs.writeFileSync('syntax-err.json', JSON.stringify({ok:false,msg:(e.stdout||e.stderr||e.message||'').slice(0,200)}), 'utf8') }
console.log('done')