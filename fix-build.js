'use strict'
const cp = require('child_process')
const fs = require('fs')
const t  = fs.readFileSync('sequence-builder.html', 'utf8')
const s  = t.indexOf('// @@STORE-START')
const e  = t.indexOf('// @@EVENTS-END') + 15
fs.writeFileSync('_check.js', t.slice(s, e), 'utf8')
try { cp.execSync('node --check _check.js 2>&1', { encoding:'utf8' }); fs.writeFileSync('syntax-err.json', JSON.stringify({ok:true}), 'utf8') }
catch(err) { fs.writeFileSync('syntax-err.json', JSON.stringify({ok:false,msg:(err.stdout||err.stderr||err.message||'').slice(0,200)}), 'utf8') }
console.log('done')