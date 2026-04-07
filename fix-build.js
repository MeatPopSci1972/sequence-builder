'use strict'
const fs = require('fs')
const t = fs.readFileSync('HANDOFF.md', 'utf8')
const bi = t.indexOf('## BACKLOG')
const snippet = t.slice(bi, bi + 1500)
const counts = {
  activeBacklog: (t.match(/### Active backlog/g)||[]).length,
  icebox: (t.match(/### Icebox/g)||[]).length,
  bug001shipped: t.includes('SHIPPED v0.9.95'),
  bumpRow: t.includes('/bump | Increment patch'),
}
fs.writeFileSync('backlog-check.json', JSON.stringify(counts), 'utf8')
console.log('done')