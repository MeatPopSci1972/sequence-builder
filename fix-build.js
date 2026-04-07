'use strict'
const fs = require('fs')
const lines = fs.readFileSync('sf-server.js', 'utf8').split('\n')
const bi = lines.findIndex(l => l.includes('/bump') && l.includes('url'))
const ctx = lines.slice(Math.max(0,bi-5), bi+20).map((l,i) => (Math.max(0,bi-4)+i+1) + ': ' + l.slice(0,90))
require('fs').writeFileSync('bump-ctx.json', JSON.stringify(ctx), 'utf8')
console.log('done bi=' + bi)