const http = require('http')
const body = JSON.stringify({ message: 'chore: follow-ups A+B for Issue #51\n\nA: amend file header to document xmldom leniency and namespace\n   re-declaration as known v2 limitation\nB: add xlink known-limitation test — locks in current stable\n   behavior so render gate (#52) is not surprised' })
const req = http.request({ hostname: '192.168.68.82', port: 3799, path: '/git', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => process.stdout.write(d + '\n'))
})
req.write(body); req.end()
