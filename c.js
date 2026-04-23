const http = require('http')
const body = JSON.stringify({ message: 'chore: remove scratch file do-commit.js' })
const req = http.request({ hostname: '192.168.68.82', port: 3799, path: '/git', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => process.stdout.write(d + '\n'))
})
req.write(body); req.end()
