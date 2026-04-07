'use strict'
const fs = require('fs')
const NL = String.fromCharCode(10)
const SQ = String.fromCharCode(39)
let srv = fs.readFileSync('sf-server.js', 'utf8')
const lines = srv.split(NL)

// Find the version helpers block — replace all three functions
const START_MARKER = '// ── Version helpers ──'
const si = lines.findIndex(function(l) { return l.includes(START_MARKER) })
if (si === -1) { console.error('version helpers not found'); process.exit(1) }

// Find end: the line after bumpPatch closing brace
const bumpPatchClose = lines.findIndex(function(l, i) {
  return i > si && l.trim() === '}' && lines[i-1].includes('join')
})
if (bumpPatchClose === -1) { console.error('bumpPatch end not found'); process.exit(1) }
console.log('helpers block: lines', si+1, 'to', bumpPatchClose+1)

// New version helpers — single source of truth from git
const NEW_HELPERS = [
  '// ── Version helpers ───────────────────────────────────────────────────────────────',
  '// nextVersionFromGit: single source of truth. Reads latest git tag,',
  '// increments patch. Never reads HTML. Called by /bump and /tag.',
  '// No stored version, no two patterns, no drift.',
  'function nextVersionFromGit() {',
  '  const {execSync} = require(' + SQ + 'child_process' + SQ + ')',
  '  try {',
  '    const latest = execSync(' + SQ + 'git describe --tags --abbrev=0' + SQ + ', {cwd:ROOT, encoding:' + SQ + 'utf8' + SQ + '}).trim()',
  '    const parts = latest.replace(/^v/, ' + SQ + SQ + ').split(' + SQ + '.' + SQ + ').map(Number)',
  '    parts[2]++',
  '    return parts.join(' + SQ + '.' + SQ + ')',
  '  } catch(e) { return ' + SQ + '0.0.1' + SQ + ' }',
  '}',
  'function writeVersionToHTML(newVer) {',
  '  const fp = path.join(ROOT, ' + SQ + 'sequence-builder.html' + SQ + ')',
  '  let html = fs.readFileSync(fp, ' + SQ + 'utf8' + SQ + ')',
  '  const oldM = html.match(/Version: (\\d+\\.\\d+\\.\\d+)/)',
  '  if (!oldM) throw new Error(' + SQ + 'Version: pattern not found in HTML' + SQ + ')',
  '  const oldVer = oldM[1]',
  '  html = html.split(' + SQ + 'Version: ' + SQ + ' + oldVer).join(' + SQ + 'Version: ' + SQ + ' + newVer)',
  '  html = html.split(' + SQ + 'data-version=' + SQ + ' + JSON.stringify(oldVer)).join(' + SQ + 'data-version=' + SQ + ' + JSON.stringify(newVer))',
  '  fs.writeFileSync(fp, html, ' + SQ + 'utf8' + SQ + ')',
  '}',
]

lines.splice(si, bumpPatchClose - si + 1, ...NEW_HELPERS)
console.log('helpers replaced. lines now:', lines.length)

srv = lines.join(NL)

// Update /bump to use nextVersionFromGit() instead of bumpPatch(oldVer)
const OLD_BUMP_LOGIC = 'const oldVer = readVersionFromHTML()'
const NEW_BUMP_LOGIC = '// Version derived from git — not stored, not assumed'
// Find the bump handler body
const bumpBodyLine = lines.findIndex(function(l) { return l.includes('/bump') && l.includes('urlPath') })
console.log('/bump handler at line:', bumpBodyLine + 1)

// Find 'const oldVer = readVersionFromHTML()' inside /bump
const oldVerLine = srv.indexOf('const oldVer = readVersionFromHTML()')
if (oldVerLine === -1) { console.error('oldVer line not found'); process.exit(1) }

// Replace the whole bump body logic with git-derived version
const OLD_BUMP_BODY = [
  '        const oldVer = readVersionFromHTML()',
  '        if (!oldVer) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:' + SQ + 'version not found' + SQ + '})); return }',
  '        let parsed = {}; try { parsed = JSON.parse(body || ' + SQ + '{}' + SQ + ') } catch(e) {}',
  '        const newVer = parsed.version || bumpPatch(oldVer)',
].join(NL)

const NEW_BUMP_BODY = [
  '        // Version always derived from git — single source of truth',
  '        let parsed = {}; try { parsed = JSON.parse(body || ' + SQ + '{}' + SQ + ') } catch(e) {}',
  '        const newVer = parsed.version || nextVersionFromGit()',
].join(NL)

if (srv.indexOf(OLD_BUMP_BODY) === -1) { console.error('bump body not found'); process.exit(1) }
srv = srv.split(OLD_BUMP_BODY).join(NEW_BUMP_BODY)
console.log('/bump body updated')

// Update /bump response to not return oldVersion (we don't track it)
srv = srv.replace(
  'res.end(JSON.stringify({ok:true, oldVersion:oldVer, newVersion:newVer, ms:Date.now()-t0}))',
  'res.end(JSON.stringify({ok:true, newVersion:newVer, ms:Date.now()-t0}))'
)
srv = srv.replace(
  'addLog(' + SQ + 'POST /bump' + SQ + ', oldVer + ' + SQ + ' -> ' + SQ + ' + newVer)',
  'addLog(' + SQ + 'POST /bump' + SQ + ', ' + SQ + '-> ' + SQ + ' + newVer)'
)

// Update /tag to use nextVersionFromGit() instead of readVersionFromHTML()
srv = srv.replace(
  'const ver = readVersionFromHTML()',
  'const ver = nextVersionFromGit()'
)
srv = srv.replace(
  'if (!ver) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:' + SQ + 'version not found in HTML' + SQ + '})); return; }',
  'if (!ver) { res.writeHead(500); res.end(JSON.stringify({ok:false,error:' + SQ + 'no git tags found' + SQ + '})); return; }'
)
console.log('/tag updated to use nextVersionFromGit()')

fs.writeFileSync('sf-server-new.js', srv, 'utf8')
require('fs').renameSync('sf-server-new.js', 'sf-server.js')
console.log('done')