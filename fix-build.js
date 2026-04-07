'use strict'
const fs = require('fs')
const lines = fs.readFileSync('sequence-builder.html', 'utf8').split('\n')
const start = lines.findIndex(function(l) { return l.includes('function renderNote') })
const end   = lines.findIndex(function(l, i) { return i > start && l.match(/^function /) })
const ctx   = lines.slice(start, end).map(function(l,i){ return (start+1+i) + ': ' + l.slice(0,90) })
fs.writeFileSync('render-note.json', JSON.stringify({ start:start+1, end, ctx }), 'utf8')
console.log('done lines', ctx.length)