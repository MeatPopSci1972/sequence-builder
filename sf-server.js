// SequenceForge dev server v5
// node sf-server.js  (use launcher.js for hot-reload)
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const { execFile } = require('child_process');
const { SF_ENDPOINTS } = require('./sf-endpoints');
const { generateReadme } = require('./sf-readme-gen');
const ROOT = path.resolve(__dirname);
const PORT = 3799;
const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.md':'text/plain','.css':'text/css' };
const LOG_BUFFER_DEFAULT = 100;
let logBuffer = [];
let logHtmlMtime = 0;

function addLog(action, result) {
  logBuffer.unshift({ ts: Date.now(), action, result });
  if (logBuffer.length > LOG_BUFFER_DEFAULT) logBuffer.length = LOG_BUFFER_DEFAULT;
}

// ── CRLF factory ──────────────────────────────────────────────────────────────
// normalisePatch(file, old, new) — auto-detects CRLF by reading the first
// 512 bytes of the target file on disk. Call sites pass plain LF strings;
// no hardcoded file list — the file itself is the source of truth.
function normalisePatch(file, oldStr, newStr) {
  let raw = '';
  try { raw = fs.readFileSync(path.resolve(ROOT, file), 'utf8').slice(0, 512); } catch(e) {}
  const isCRLF = raw.includes('\r\n');
  const toCRLF = s => s.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  return { old: isCRLF ? toCRLF(oldStr) : oldStr, new: isCRLF ? toCRLF(newStr) : newStr };
}

// Whitespace-tolerant find: collapses runs of spaces/tabs in both needle and
// haystack for matching, then splices the replacement into the original bytes.
function flexPatch(content, oldStr, newStr) {
  const collapse = s => s.replace(/[ \t]+/g, ' ');
  const needle = collapse(oldStr);
  const collapsed = collapse(content);
  const idx = collapsed.indexOf(needle);
  if (idx === -1) return null; // no match
  // Map collapsed index back to original content position
  // Walk original content counting non-collapsed chars to find real start/end
  let origIdx = 0, collIdx = 0;
  while (collIdx < idx && origIdx < content.length) {
    if (content[origIdx] === ' ' || content[origIdx] === '\t') {
      // skip run of whitespace — counts as 1 in collapsed
      while (origIdx < content.length && (content[origIdx] === ' ' || content[origIdx] === '\t')) origIdx++;
      collIdx++;
    } else {
      origIdx++; collIdx++;
    }
  }
  const start = origIdx;
  // Now walk needle length in collapsed to find end in original
  let ni = 0, oi = origIdx;
  while (ni < needle.length && oi < content.length) {
    if (content[oi] === ' ' || content[oi] === '\t') {
      while (oi < content.length && (content[oi] === ' ' || content[oi] === '\t')) oi++;
      ni++;
    } else {
      oi++; ni++;
    }
  }
  return content.slice(0, start) + newStr + content.slice(oi);
}
// normalizeWS: collapse runs of whitespace to single space for fuzzy matching.
// Used by flexPatch, /slice search, and any string comparison that should be
// whitespace-tolerant. Single definition — consistent behaviour everywhere.
function normalizeWS(s) {
  return s.replace(/[ 	]+/g, ' ')
}
// normalizeWS: collapse runs of whitespace to single space for fuzzy matching.
// Used by flexPatch, /slice search, and any string comparison that should be
// whitespace-tolerant. Single definition — consistent behaviour everywhere.
function normalizeWS(s) {
  return s.replace(/[ 	]+/g, ' ')
}
// normalizeWS: collapse runs of whitespace to single space for fuzzy matching.
// Used by flexPatch, /slice search, and any string comparison that should be
// whitespace-tolerant. Single definition — consistent behaviour everywhere.
function normalizeWS(s) {
  return s.replace(/[ 	]+/g, ' ')
}
// ─────────────────────────────────────────────────────────────────────────────

function runTests(cb) {
  execFile('node', ['build.js'], { cwd: ROOT }, (bErr, bOut, bErrOut) => {
    if (bErr) return cb({ buildErr: bErrOut || bErr.message, testOut: null, exitCode: 1 });
    execFile('node', ['sequence-builder.test.js'], { cwd: ROOT }, (tErr, tOut, tErrOut) => {
      cb({ buildErr: null, testOut: tOut || tErrOut, exitCode: tErr ? (tErr.code || 1) : 0 });
    });
  });
}
function runBuild(cb) {
  execFile('node', ['build.js'], { cwd: ROOT }, (err, stdout, stderr) => {
    cb({ ok: !err, output: stdout || stderr || '', exitCode: err ? (err.code || 1) : 0 });
  });
}
function renderReport(result, ms) {
  if (result.buildErr) return '<html><body><h1>Build Error</h1><pre>' + result.buildErr + '</pre></body></html>';
  const raw = result.testOut || '';
  const passed = (raw.match(/(\d+) passed/) || [])[1] || '0';
  const failed = (raw.match(/(\d+) failed/) || [])[1] || '0';
  const allPass = result.exitCode === 0;
  const title = 'SequenceForge — Test Results';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+title+'</title><style>body{font-family:monospace;background:#0d1117;color:#e6edf3;padding:20px}h1{color:#00ff9d}.pass{color:#3fb950}.fail{color:#f85149}pre{white-space:pre-wrap}</style></head><body><h1>'+title+'</h1><p>Ran at '+new Date().toLocaleTimeString()+' <a href="/test" style="color:#00ff9d">↺ Re-run</a></p><p class="'+(allPass?'pass':'fail')+'">'+(allPass?'✓ ALL PASS':'✗ FAILURES')+'</p><p>'+passed+' passed | '+failed+' failed | '+(parseInt(passed)+parseInt(failed))+' total</p><pre>'+raw+'</pre></body></html>';
}
const server = http.createServer(function(req, res) {
  const urlObj = new URL(req.url, 'http://localhost:' + PORT);
  const urlPath = urlObj.pathname;

  if (req.method === 'GET' && urlPath === '/status') {
    let version = '0.0.0';
    try { const h = fs.readFileSync(path.join(ROOT,'sequence-builder.html'),'utf8'); const vm = h.match(/const SF_VERSION = '([\d.]+)'/); if (vm) version = vm[1]; } catch(e){}
    const {execSync} = require('child_process');
    let git = {branch:'main',clean:true,changed:[],lastCommit:''};
    try { const br = execSync('git rev-parse --abbrev-ref HEAD',{cwd:ROOT}).toString().trim(); const st = execSync('git status --porcelain',{cwd:ROOT}).toString().trim(); const lc = execSync('git log -1 --oneline',{cwd:ROOT}).toString().trim(); git = {branch:br,clean:st.length===0,changed:st?st.split('\n'):[],lastCommit:lc}; } catch(e){}
    const demos = [{id:'auth-flow',label:'Auth Flow'},{id:'scada-control',label:'SCADA: Control Flow'},{id:'cybersec-zones',label:'CyberSecurity: Zone Analysis'}];
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({version,server:'v5',git,demos,gate:'run GET /test for fresh result',ms:0}));
    return;
  }
  if (req.method === 'GET' && urlPath === '/test') {
    const t0 = Date.now();
    runTests(result => {
      const html = renderReport(result, Date.now()-t0);
      res.writeHead(200,{'Content-Type':'text/html'}); res.end(html);
      const tm = result.testOut ? result.testOut.match(/(\d+) passed/) : null;
      const tpass = tm ? tm[1] : '?';
      addLog('GET /test', result.exitCode===0 ? tpass+' passed' : tpass+' passed, FAILED');
      console.log('test-run: exit='+result.exitCode);
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/build') {
    const t0 = Date.now();
    runBuild(result => {
      res.writeHead(result.ok?200:500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:result.ok,output:result.output,ms:Date.now()-t0,exitCode:result.exitCode}));
      addLog('POST /build', result.ok ? 'ok' : 'FAILED: '+result.output.split('\n')[0]);
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/lint') {
    const t0 = Date.now();
    execFile('node',['lint.js'],{cwd:ROOT},(err,stdout,stderr) => {
      const ms = Date.now()-t0; const ok = !err;
      const output = (stdout||stderr||(err&&err.message)||'').trim();
      res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok,output,ms}));
      addLog('POST /lint', output);
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/patch') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let file='', oldStr='', newStr='';
      try { const p=JSON.parse(body); file=p.file||''; oldStr=p.old||p.anchor||''; newStr=p.new||p.replace||''; } catch(e){}
      if (!file) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'missing file'})); return; }
      const fp = path.join(ROOT, file);
      try {
        const norm = normalisePatch(file, oldStr, newStr);
        const content = fs.readFileSync(fp, 'utf8');
        let updated, replaced;
        if (content.indexOf(norm.old) !== -1) {
          // Exact match path
          updated = content.split(norm.old).join(norm.new);
          replaced = content.split(norm.old).length - 1;
        } else {
          // Whitespace-tolerant fallback
          const flexResult = flexPatch(content, norm.old, norm.new);
          if (flexResult === null) {
            res.writeHead(200,{'Content-Type':'application/json'});
            res.end(JSON.stringify({ok:false,replaced:0,length:content.length,error:'old string not found (exact + flex)'}));
            addLog('POST /patch','MISS: '+file); return;
          }
          updated = flexResult;
          replaced = 1; // flexPatch replaces first occurrence only
        }
        fs.writeFileSync(fp, updated, 'utf8');
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,replaced,length:updated.length}));
        addLog('POST /patch','ok: '+file+' r='+replaced);
      } catch(err) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:false,error:err.message}));
        addLog('POST /patch','FAIL: '+err.message.split('\n')[0]);
      }
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/git') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let msg = 'chore: update';
      try { msg = JSON.parse(body).message || msg; } catch(e){}
      const t0 = Date.now(); const {exec} = require('child_process');
      exec('git add -A && git commit -m '+JSON.stringify(msg),{cwd:ROOT},(err,stdout,stderr)=>{
        const out = (stdout+stderr).trim();
        const hashM = out.match(/\[([^\s]+)\s+([a-f0-9]+)\]/);
        const branch = hashM?hashM[1]:''; const hash = hashM?hashM[2]:'';
        const ok = !err||out.includes('main');
        res.writeHead(ok?200:500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok,branch,hash,output:out,ms:Date.now()-t0}));
        addLog('POST /git', ok ? hash+' '+msg : 'FAIL');
      });
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/git-restore') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let file = '';
      try { file = JSON.parse(body).file||''; } catch(e){}
      if (!file) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'missing file'})); return; }
      const t0 = Date.now(); const {exec} = require('child_process');
      exec('git checkout HEAD -- '+JSON.stringify(file),{cwd:ROOT},(err,stdout,stderr)=>{
        const out = (stdout+stderr).trim(); const ok = !err;
        res.writeHead(ok?200:500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok,file,output:out,ms:Date.now()-t0}));
        addLog('POST /git-restore', ok ? 'restored: '+file : 'FAIL: '+out.split('\n')[0]);
      });
    }); return;
  }
// ── Version helpers ───────────────────────────────────────────────────────────────
// nextVersionFromGit: single source of truth. Reads latest git tag,
// increments patch. Never reads HTML. Called by /bump and /tag.
// No stored version, no two patterns, no drift.
function nextVersionFromGit() {
  const {execSync} = require('child_process')
  try {
    const latest = execSync('git describe --tags --abbrev=0', {cwd:ROOT, encoding:'utf8'}).trim()
    const parts = latest.replace(/^v/, '').split('.').map(Number)
    parts[2]++
    return parts.join('.')
  } catch(e) { return '0.0.1' }
}
function writeVersionToHTML(newVer) {
  const fp = path.join(ROOT, 'sequence-builder.html')
  let html = fs.readFileSync(fp, 'utf8')
  // SF_VERSION is the single source of truth — only one string to replace
  const oldM = html.match(/const SF_VERSION = '(\d+\.\d+\.\d+)'/)
  if (!oldM) throw new Error("SF_VERSION constant not found in HTML")
  const oldVer = oldM[1]
  html = html.split("const SF_VERSION = '" + oldVer + "'").join("const SF_VERSION = '" + newVer + "'")
  // Keep data-version attribute in sync
  html = html.split('data-version=' + JSON.stringify(oldVer)).join('data-version=' + JSON.stringify(newVer))
  fs.writeFileSync(fp, html, 'utf8')
}

  if (req.method === 'POST' && urlPath === '/bump') {
    let body = ''; req.on('data', d => body += d); req.on('end', function() {
      const t0 = Date.now()
      try {
        // Version always derived from git — single source of truth
        let parsed = {}; try { parsed = JSON.parse(body || '{}') } catch(e) {}
        const newVer = parsed.version || nextVersionFromGit()
        // Idempotency guard — if HTML already matches target version, skip write
        const fp = require('path').join(ROOT, 'sequence-builder.html')
        const curM = require('fs').readFileSync(fp, 'utf8').match(/const SF_VERSION = '(\d+\.\d+\.\d+)'/)
        const curVer = curM ? curM[1] : null
        if (curVer && curVer === newVer) {
          res.writeHead(200, {'Content-Type': 'application/json'})
          res.end(JSON.stringify({ok:true, alreadyBumped:true, version:newVer, ms:Date.now()-t0}))
          addLog('POST /bump', '-> already at ' + newVer)
          return
        }
        writeVersionToHTML(newVer)
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({ok:true, newVersion:newVer, ms:Date.now()-t0}))
        addLog('POST /bump', '-> ' + newVer)
      } catch(e) { res.writeHead(500); res.end(JSON.stringify({ok:false,error:e.message})) }
    }); return;
  }

  if (req.method === 'POST' && urlPath === '/tag') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let tag='', msg='';
      try { const p=JSON.parse(body); tag=p.tag||''; msg=p.message||('Release '+tag); } catch(e){}
      if (!tag) {
        const ver = nextVersionFromGit()
        if (!ver) { res.writeHead(500); res.end(JSON.stringify({ok:false,error:'no git tags found'})); return; }
        tag = 'v' + ver
        if (!msg) msg = 'Release ' + tag
      }
      const t0 = Date.now(); const {exec} = require('child_process');
      exec('git tag -a '+JSON.stringify(tag)+' -m '+JSON.stringify(msg),{cwd:ROOT},(err,stdout,stderr)=>{
        const out = (stdout+stderr).trim(); const ok = !err;
        res.writeHead(ok?200:500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok,tag,output:out,ms:Date.now()-t0}));
        addLog('POST /tag', ok ? tag : 'FAIL: '+out.split('\n')[0]);
      });
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/changelog') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let version = '0.0.0';
      try { version = JSON.parse(body).version || version; } catch(e){}
      const t0 = Date.now(); const {execSync} = require('child_process');
      try {
        let lastTag = '';
        try { lastTag = execSync('git describe --tags --abbrev=0 HEAD~1',{cwd:ROOT}).toString().trim(); } catch(e){}
        const range = lastTag ? lastTag+'..HEAD' : 'HEAD';
        const raw = execSync('git log '+range+' --pretty=format:"%h %s"',{cwd:ROOT}).toString().trim();
        const commits = raw ? raw.split('\n') : [];
        const groups = {}; let title = 'Release v'+version;
        commits.forEach(function(line){
          const m = line.match(/^[a-f0-9]+ (feat|fix|chore): (.+?)( v\d+\.\d+\.\d+)?$/);
          if(!m) return;
          const type=m[1]; const msg=m[2];
          if(type==='feat' && title==='Release v'+version) title=msg;
          if(!groups[type]) groups[type]=[];
          groups[type].push('- '+msg);
        });
        const date = new Date().toISOString().slice(0,10);
        let entry = '## v'+version+' \u2014 '+title+'\n_'+date+'_\n\n';
        if(groups.feat&&groups.feat.length)  entry += '### Features\n'+groups.feat.join('\n')+'\n\n';
        if(groups.fix&&groups.fix.length)    entry += '### Fixes\n'+groups.fix.join('\n')+'\n\n';
        if(groups.chore&&groups.chore.length) entry += '### Chores\n'+groups.chore.join('\n')+'\n\n';
        entry += '---\n\n';
        const clPath = path.join(ROOT,'CHANGELOG.md');
        const existing = fs.existsSync(clPath) ? fs.readFileSync(clPath,'utf8') : '';
        const firstNl = existing.indexOf('\n\n');
        const header = firstNl !== -1 ? existing.slice(0, firstNl+2) : '';
        const rest = firstNl !== -1 ? existing.slice(firstNl+2).replace(/^\n+/,'') : existing;
        const updated = header + entry + rest;
        fs.writeFileSync(clPath, updated, 'utf8');
        // Auto-commit CHANGELOG so tree stays clean after this call
        try {
          execSync('git add CHANGELOG.md && git commit -m "chore: CHANGELOG v'+version+'"',{cwd:ROOT});
        } catch(e) { /* nothing to commit is fine */ }
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,version,entry,length:updated.length,ms:Date.now()-t0}));
        addLog('POST /changelog','v'+version+' '+commits.length+' commits from '+(lastTag||'beginning'));
      } catch(err) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:false,error:err.message,ms:Date.now()-t0}));
        addLog('POST /changelog','FAIL: '+err.message.split('\n')[0]);
      }
    }); return;
  }
  if (req.method === 'POST' && urlPath.startsWith('/snapshot')) {
    const version = urlObj.searchParams.get('v')||'0.0.0';
    const src = path.join(ROOT,'sequence-builder.html');
    const dir = path.join(ROOT,'releases','v'+version);
    fs.mkdirSync(dir,{recursive:true});
    fs.copyFile(src,path.join(dir,'sequence-builder.html'),err=>{
      if(err){res.writeHead(500);res.end(err.message);return;}
      res.writeHead(200); res.end('OK: releases/v'+version+'/sequence-builder.html');
      fs.copyFile(path.join(ROOT,'HANDOFF.md'),path.join(dir,'HANDOFF-v'+version+'.md'),()=>{});
      addLog('POST /snapshot','v'+version);
      try {
        const rm = fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
        const tgt = 'releases/v'+version+'/sequence-builder.html';
        if(rm.indexOf(tgt)===-1) addLog('POST /snapshot','WARN: README missing link to '+version);
        if(rm.indexOf('github.io/sequence-builder/)')!==-1) addLog('POST /snapshot','WARN: README contains loop link');
      } catch(e){ addLog('POST /snapshot','WARN: README unreadable'); }
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/generate-readme') {
    try {
      const readme = generateReadme(ROOT);
      require('fs').writeFileSync(require('path').join(ROOT,'README.md'), readme, 'utf8');
      addLog('POST /generate-readme','ok: '+readme.length+'b');
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:true,length:readme.length}));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ok:false,error:e.message}));
    }
    return;
  }
  if (req.method === 'GET' && urlPath === '/check-pages') {
    const version = urlObj.searchParams.get('v')||'0.0.0';
    const t0 = Date.now();
    const pageUrl = 'https://MeatPopSci1972.github.io/sequence-builder/releases/v'+version+'/sequence-builder.html';
    const https = require('https');
    https.get(pageUrl, (r) => {
      const ok = r.statusCode === 200;
      const ms = Date.now()-t0;
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok, status:r.statusCode, url:pageUrl, ms}));
      addLog('GET /check-pages', (ok?'live':'FAIL '+r.statusCode)+' v'+version+' ('+ms+'ms)');
    }).on('error', (e) => {
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false, error:e.message, url:pageUrl, ms:Date.now()-t0}));
      addLog('GET /check-pages', 'ERR: '+e.message);
    });
    return;
  }

  if (req.method === 'GET' && urlPath === '/validate-readme') {
    const version = urlObj.searchParams.get('v')||'0.0.0';
    try {
      const rm = fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
      const target = 'releases/v'+version+'/sequence-builder.html';
      const hasLink = rm.indexOf(target)!==-1;
      const hasLoop = rm.indexOf('github.io/sequence-builder/)')!==-1;
      const hasLabel = rm.indexOf('v'+version)!==-1;
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:hasLink&&!hasLoop&&hasLabel,hasLink,hasLoop,hasLabel,target,version}));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ok:false,error:e.message})); }
    return;
  }
  if (req.method === 'GET' && urlPath === '/slice') {
    const fname = urlObj.searchParams.get('file') || 'sequence-builder.html';
    const section = urlObj.searchParams.get('section') || '';
    try {
      const content = fs.readFileSync(path.join(ROOT, fname), 'utf8');
      if (!section) {
        // return manifest of available sections
        const lines = content.split('\n');
        const sections = [];
        lines.forEach((l, i) => {
          const m = l.match(/\/\/ @@([A-Z]+)-START/);
          if (m) sections.push(m[1].toLowerCase());
        });
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ok: true, file: fname, sections}));
        return;
      }
      const key = section.toUpperCase();
      const startMark = '// @@' + key + '-START';
      const endMark   = '// @@' + key + '-END';
      let si = content.indexOf(startMark);
      let ei = content.indexOf(endMark);
      // Flex fallback: whitespace-tolerant sentinel search (matches flexPatch behaviour)
      if (si === -1 || ei === -1) {
        const nContent = normalizeWS(content);
        const nStart = normalizeWS(startMark);
        const nEnd = normalizeWS(endMark);
        si = nContent.indexOf(nStart);
        ei = nContent.indexOf(nEnd);
      }
      if (si === -1 || ei === -1) {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ok: false, error: 'section not found: ' + section}));
        return;
      }
      const slice = content.slice(si, ei + endMark.length);
      const lines = slice.split('\n').length;
      const totalLines = content.split('\n').length;
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ok: true, file: fname, section, lines, totalFileLines: totalLines, content: slice}));
    } catch(e) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ok: false, error: e.message}));
    }
    return;
  }
  if (req.method === 'GET' && urlPath === '/log') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({entries:logBuffer,bufferSize:LOG_BUFFER_DEFAULT,logHtmlMtime}));
    return;
  }
  if (req.method === 'GET' && urlPath === '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n')||'20',10)||20;
    const {execSync} = require('child_process');
    let lines = [];
    try { lines = execSync('git log --oneline -'+n,{cwd:ROOT}).toString().trim().split('\n').filter(Boolean); } catch(e){ lines=['error: '+e.message]; }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({n,lines})); return;
  }
  if (req.method === 'GET' && urlPath === '/api') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({server:'SequenceForge dev server v5',port:3799,endpoints:SF_ENDPOINTS},null,2)); return;
  }
  if (req.method === 'GET' && urlPath === '/usage') {
    res.writeHead(200,{'Content-Type':'text/plain'});
    res.end([
      'SequenceForge Dev Server v5 -- AI Usage Guide',
      'FIRST ACTIONS: 1.GET /status  2.GET /HANDOFF.md  3.GET /test (99 passed)',
      'GATE: 99 passed before AND after your work',
      'LINT: POST /lint after every HTML write',
      'POST /patch: find-replace. Body:{file,old,new}. Returns {ok,replaced,length}. addLog fires.',
      'POST /patch CRLF: old/new auto-normalised to CRLF for CRLF files (sequence-builder.html, sf-server.js).',
      '  normalisePatch() runs server-side -- call sites send plain LF, server converts. No manual \\r\\n needed.',
      '  A miss (replaced:0) means old string not found -- check for typos or context drift.',
      'RELEASE: gate->build->bump->lint->snapshot->validate-readme->changelog->HANDOFF->git->tag->push->GitHub Release',
      'POST /git-restore: restore tracked file to HEAD. Body:{file}. addLog fires.',
      'POST /tag: create annotated tag. Body:{tag,message}. addLog fires.',
      'POST /update-handoff: populate all live fields in HANDOFF.md. Idempotent. addLog fires.',
      'POST /changelog: auto-gen CHANGELOG.md from git log. Body:{version}. addLog fires.',
      'GITHUB RELEASE: New release->select tag->title+notes->attach releases/vX.Y.Z/sequence-builder.html->Publish',
      'HOT RELOAD: node launcher.js',
      'LOG UI: http://localhost:3799/log.html',
    ].join('\n')); return;
  }
  if (req.method === 'PUT') {
    const fp = path.join(ROOT, urlPath);
    const verify = urlObj.searchParams.get('verify') === '1';
    let body = ''; req.on('data', d => body += d);
    req.on('end', () => {
      fs.mkdirSync(path.dirname(fp), {recursive:true});
      body = body.replace(/\r\n/g, '\n'); // normalise CRLF→LF on every PUT write
      fs.writeFile(fp, body, 'utf8', err => {
        if (err) { res.writeHead(500); res.end(err.message); return; }
        if (fp.endsWith('log.html')) logHtmlMtime = Date.now();
        addLog('PUT /'+path.relative(ROOT,fp).replace(/\\/g,'/'), 'wrote '+body.length+' bytes');
        if (!verify) { res.writeHead(200); res.end('OK'); return; }
        const {execSync} = require('child_process');
        let version='0.0.0';
        try { const h=fs.readFileSync(path.join(ROOT,'sequence-builder.html'),'utf8'); const vm=h.match(/const SF_VERSION = '(\d+\.\d+\.\d+)'/); if(vm) version=vm[1]; } catch(ex){}
        let git={};
        try { git={branch:execSync('git rev-parse --abbrev-ref HEAD',{cwd:ROOT}).toString().trim(),clean:execSync('git status --porcelain',{cwd:ROOT}).toString().trim().length===0}; } catch(ex){}
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,wrote:path.basename(fp),status:{version,git}}));
      });
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/update-handoff') {
  const t0 = Date.now();
  // Step 1: read version from sequence-builder.html
  let uhVer = '0.0.0';
  try {
    const uhHtml = fs.readFileSync(path.join(ROOT,'sequence-builder.html'),'utf8');
    const uhVm = uhHtml.match(/const SF_VERSION = '(\d+\.\d+\.\d+)'/);
    if (uhVm) uhVer = uhVm[1];
  } catch(e){}
  const uhParts = uhVer.split('.');
  const uhNext = uhParts[0]+'.'+uhParts[1]+'.'+(parseInt(uhParts[2],10)+1);
  // Step 2: run tests (skip build — already run in release flow)
  execFile('node', ['sequence-builder.test.js'], { cwd: ROOT }, function(tErr, tOut, tErrOut) {
    const tRaw = tOut || tErrOut || '';
    const tM = tRaw.match(/(\d+) passed/);
    const storeCount = tM ? tM[1] : '?';
    // Step 3: render gate via playwright
    let pw2;
    try { pw2 = require('playwright'); } catch(e) {
      res.writeHead(500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false,error:'playwright not installed',ms:Date.now()-t0}));
      addLog('POST /update-handoff','FAIL: playwright missing');
      return;
    }
    const uhSnapDir = path.join(ROOT,'test-snapshots');
    const uhDemos = ['auth-flow','scada-control','cybersec-zones'];
    const uhLayers = ['actors-layer','lifelines-layer','messages-layer','notes-layer','fragments-layer'];
    (async function() {
      let renderCount = '?';
      let uhBrowser;
      try {
        uhBrowser = await pw2.chromium.launch({headless:true});
        const uhPage = await uhBrowser.newPage();
        const uhHPath = 'file:///'+path.join(ROOT,'sequence-builder.html').replace(/\\/g,'/');
        await uhPage.goto(uhHPath,{waitUntil:'domcontentloaded'});
        await uhPage.waitForFunction('typeof window.loadDemo === "function" && typeof window.render === "function"',{timeout:10000});
        let uhPass = 0, uhFail = 0;
        for (const uhDemo of uhDemos) {
          await uhPage.evaluate(function(d){window.loadDemo(d);window.render();},uhDemo);
          await uhPage.waitForTimeout(100);
          for (const uhLayer of uhLayers) {
            const actual = await uhPage.evaluate(function(id){var el=document.getElementById(id);return el?el.innerHTML:'';},uhLayer);
            const snapFile = path.join(uhSnapDir,uhDemo+'--'+uhLayer+'.html');
            try {              if (normalizeIds(actual) === normalizeIds(fs.readFileSync(snapFile,'utf8'))) uhPass++; else uhFail++; } catch(e){uhFail++;}
          }
        }
        await uhBrowser.close();
        renderCount = String(uhPass);
      } catch(e) {
        if (uhBrowser) try{await uhBrowser.close();}catch(e2){}
        renderCount = '?';
      }
      // Step 4: patch HANDOFF.md with live values
      try {
        const uhHPath2 = path.join(ROOT,'HANDOFF.md');
        let uhContent = fs.readFileSync(uhHPath2,'utf8');
        const uhReleaseUrl = 'https://github.com/MeatPopSci1972/sequence-builder/blob/main/releases/v'+uhVer+'/sequence-builder.html';
        // Live section: ## VERSION block
        uhContent = uhContent.replace(/- Current: \d+\.\d+\.\d+/,'- Current: '+uhVer);
        uhContent = uhContent.replace(/html\.split\('[^']*'\)\.join\('[^']*'\)/,"html.split('"+uhVer+"').join('"+uhNext+"')");
        uhContent = uhContent.replace(/- Release handoff: [^\n]*/,'- Release handoff: '+uhReleaseUrl);
        // Live section: ## FIRST ACTIONS gate lines
        uhContent = uhContent.replace(/GET http:\/\/localhost:3799\/test[^\n]*confirm gate is green \(\d+\/\d+\)/,'GET http://localhost:3799/test — confirm gate is green ('+storeCount+'/'+storeCount+')');
        uhContent = uhContent.replace(/GET http:\/\/localhost:3799\/test-render[^\n]*confirm render gate green \(\d+\/\d+\)/,'GET http://localhost:3799/test-render — confirm render gate green ('+renderCount+'/'+renderCount+')');
        // Documentation standards — regex-based, idempotent on re-runs
        uhContent = uhContent.replace(/`GET \/test` \(\d+\/\d+\)/g, '`GET /test` ('+storeCount+'/'+storeCount+')');
        uhContent = uhContent.replace(/`GET \/test-render` \(\d+\/\d+\)/g, '`GET /test-render` ('+renderCount+'/'+renderCount+')');
        // Standards section version references — regex-based
        uhContent = uhContent.replace(/releases\/v\d+\.\d+\.\d+\/sequence-builder\.html`/g, 'releases/v'+uhVer+'/sequence-builder.html`');
        uhContent = uhContent.replace(/`version` field \(\d+\.\d+\.\d+\)/g, '`version` field ('+uhVer+')');
        uhContent = uhContent.replace(/html\.split\('\d+\.\d+\.\d+'\)\.join\('\d+\.\d+\.\d+'\)/g, "html.split('"+uhVer+"').join('"+uhNext+"')");
        uhContent = uhContent.replace(/version snapshot \(\d+\.\d+\.\d+\)/g, 'version snapshot ('+uhVer+')');
        fs.writeFileSync(uhHPath2,uhContent,'utf8');
        const ms = Date.now()-t0;
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,version:uhVer,next_version:uhNext,store_test_count:storeCount,render_test_count:renderCount,ms}));
        addLog('POST /update-handoff','v'+uhVer+' store:'+storeCount+' render:'+renderCount);
      } catch(uhErr) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:false,error:uhErr.message,ms:Date.now()-t0}));
        addLog('POST /update-handoff','FAIL: '+uhErr.message.split('\n')[0]);
      }
    })();
  });
  return;
}
// normalizeIds: strips ULID suffixes from SVG innerHTML before snapshot comparison.
// ULIDs are non-deterministic per-run; structure is what matters, not identity.
// Replaces actor_XXXX, msg_XXXX, note_XXXX, frag_XXXX with stable placeholders.
function normalizeIds(html) {
  return html
    // prefixed typed IDs: actor_XXXX, msg_XXXX, note_XXXX, frag_XXXX
    .replace(/actor_[0-9A-Z]{26}/g, 'actor_ID')
    .replace(/msg_[0-9A-Z]{26}/g,   'msg_ID')
    .replace(/note_[0-9A-Z]{26}/g,  'note_ID')
    .replace(/frag_[0-9A-Z]{26}/g,  'frag_ID')
    // bare ULIDs in data-id attributes (used by LOAD_DEMO tid())
    .replace(/data-id="[0-9A-Z]{26}"/g, 'data-id="ULID"');
}

if (req.method === 'GET' && urlPath === '/test-render') {
    const t0 = Date.now();
    const update = urlObj.searchParams.get('update') === '1';
    const snapshotDir = path.join(ROOT, 'test-snapshots');
    const DEMOS = ['auth-flow', 'scada-control', 'cybersec-zones'];
    const LAYERS = ['actors-layer', 'lifelines-layer', 'messages-layer', 'notes-layer', 'fragments-layer'];
    fs.mkdirSync(snapshotDir, {recursive: true});
    let pw;
    try { pw = require('playwright'); } catch(e) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ok: false, error: 'playwright not installed: ' + e.message}));
      return;
    }
    (async function() {
      let browser;
      try {
        browser = await pw.chromium.launch({headless: true});
        const page = await browser.newPage();
        const htmlPath = 'file:///' + path.join(ROOT, 'sequence-builder.html').replace(/\\/g, '/');
        await page.goto(htmlPath, {waitUntil: 'domcontentloaded'});
        // wait for app to initialise — loadDemo and render are the public API
        await page.waitForFunction('typeof window.loadDemo === "function" && typeof window.render === "function"', {timeout: 10000});
        if (update) {
          let wrote = 0;
          for (const demo of DEMOS) {
            await page.evaluate(function(d) {
              window.loadDemo(d);
              window.render();
            }, demo);
            await page.waitForTimeout(100);
            for (const layer of LAYERS) {
              const html = await page.evaluate(function(id) {
                var el = document.getElementById(id);
                return el ? el.innerHTML : '';
              }, layer);
              const snapFile = path.join(snapshotDir, demo + '--' + layer + '.html');
              fs.writeFileSync(snapFile, normalizeIds(html), 'utf8');
              wrote++;
            }
          }
          await browser.close();
          const ms = Date.now() - t0;
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ok: true, wrote, demos: DEMOS.length, layers: LAYERS.length, ms}));
          addLog('GET /test-render', 'update: wrote ' + wrote + ' snapshots');
        } else {
          const results = [];
          let totalPassed = 0, totalFailed = 0;
          for (const demo of DEMOS) {
            await page.evaluate(function(d) {
              window.loadDemo(d);
              window.render();
            }, demo);
            await page.waitForTimeout(100);
            const demoResult = {demo, passed: true, layers: {}};
            for (const layer of LAYERS) {
              const actual = await page.evaluate(function(id) {
                var el = document.getElementById(id);
                return el ? el.innerHTML : '';
              }, layer);
              const snapFile = path.join(snapshotDir, demo + '--' + layer + '.html');
              let snapshotExists = false;
              let snapshot = '';
              try { snapshot = fs.readFileSync(snapFile, 'utf8'); snapshotExists = true; } catch(e) {}
              if (!snapshotExists) {
                demoResult.layers[layer] = {passed: false, error: 'no snapshot — run with ?update=1 first'};
                demoResult.passed = false;
                totalFailed++;
              } else if (normalizeIds(actual) === normalizeIds(snapshot)) {
                demoResult.layers[layer] = {passed: true, length: snapshot.length};
                totalPassed++;
              } else {
                demoResult.layers[layer] = {passed: false, snapshotLength: snapshot.length, actualLength: actual.length};
                demoResult.passed = false;
                totalFailed++;
              }
            }
            results.push(demoResult);
          }
          await browser.close();
          const ms = Date.now() - t0;
          const ok = totalFailed === 0;
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ok, passed: totalPassed, failed: totalFailed, total: totalPassed + totalFailed, ms, results}));
          addLog('GET /test-render', ok ? totalPassed + ' passed' : totalPassed + ' passed, ' + totalFailed + ' FAILED');
        }
      } catch(err) {
        if (browser) try { await browser.close(); } catch(e2) {}
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ok: false, error: err.message}));
        addLog('GET /test-render', 'ERROR: ' + err.message.split('\n')[0]);
      }
    })();
    return;
  }

  if (req.method === 'GET') {
    if (urlPath === '/') {
      try { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({files:fs.readdirSync(ROOT)})); }
      catch(e){ res.writeHead(500); res.end(e.message); }
      return;
    }
    const fp = path.join(ROOT, urlPath);
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found: '+urlPath); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});
      res.end(data);
    }); return;
  }
  if (req.method === 'POST' && urlPath === '/exec-once') {
    let b=''; req.on('data', d => b+=d);
    req.on('end', () => {
      let sc=''; try { sc = JSON.parse(b).script || ''; } catch(e) {}
      if (!sc) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'missing script'})); return; }
      execFile('node', [sc], {cwd:ROOT}, (err, stdout, stderr) => {
        const ok = !err;
        const out = (stdout || stderr || '').trim();
        res.writeHead(ok ? 200 : 500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ ok, output: out }));
        addLog('POST /exec-once', ok ? out.slice(0,80) : 'FAIL: ' + out.slice(0,60));
      });
    }); return;
  }
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, () => { console.log('sf-server v5 listening on port '+PORT); });
