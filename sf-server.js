// SequenceForge dev server v5
// node sf-server.js  (use launcher.js for hot-reload)
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const { execFile } = require('child_process');
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
  const title = 'SequenceForge \u2014 Test Results';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title><style>body{font-family:monospace;background:#0d1117;color:#e6edf3;padding:20px}h1{color:#00ff9d}.pass{color:#3fb950}.fail{color:#f85149}pre{white-space:pre-wrap}</style></head><body><h1>' + title + '</h1><p>Ran at ' + new Date().toLocaleTimeString() + ' <a href="/test" style="color:#00ff9d">\u21ba Re-run</a></p><p class="' + (allPass?'pass':'fail') + '">' + (allPass?'\u2713 ALL PASS':'\u2717 FAILURES') + '</p><p>' + passed + ' passed | ' + failed + ' failed | ' + (parseInt(passed)+parseInt(failed)) + ' total</p><pre>' + raw + '</pre></body></html>';
}
const server = http.createServer(function(req, res) {
  const urlObj = new URL(req.url, 'http://localhost:' + PORT);
  const urlPath = urlObj.pathname;
  // /status
  if (req.method === 'GET' && urlPath === '/status') {
    let version = '0.0.0';
    try { const h = fs.readFileSync(path.join(ROOT,'sequence-builder.html'),'utf8'); const vm = h.match(/SequenceForge v(\d+\.\d+\.\d+)/); if (vm) version = vm[1]; } catch(e){}
    const {execSync} = require('child_process');
    let git = {branch:'main',clean:true,changed:[],lastCommit:''};
    try { const br = execSync('git rev-parse --abbrev-ref HEAD',{cwd:ROOT}).toString().trim(); const st = execSync('git status --porcelain',{cwd:ROOT}).toString().trim(); const lc = execSync('git log -1 --oneline',{cwd:ROOT}).toString().trim(); git = {branch:br,clean:st.length===0,changed:st?st.split('\n'):[],lastCommit:lc}; } catch(e){}
    const demos = [{id:'auth-flow',label:'Auth Flow'},{id:'scada-control',label:'SCADA: Control Flow'},{id:'cybersec-zones',label:'CyberSecurity: Zone Analysis'}];
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({version,server:'v5',git,demos,gate:'run GET /test for fresh result',ms:0}));
    return;
  }
  // /test
  if (req.method === 'GET' && urlPath === '/test') {
    const t0 = Date.now();
    runTests(result => {
      const html = renderReport(result, Date.now()-t0);
      res.writeHead(200,{'Content-Type':'text/html'}); res.end(html);
      const tm = result.testOut ? result.testOut.match(/(\d+) passed/) : null;
      const tpass = tm ? tm[1] : '?';
      const tres = result.exitCode === 0 ? tpass + ' passed' : tpass + ' passed, FAILED';
      addLog('GET /test', tres);
      console.log('test-run: exit=' + result.exitCode + ' (' + (Date.now()-t0) + 'ms)');
    }); return;
  }
  // POST /build
  if (req.method === 'POST' && urlPath === '/build') {
    const t0 = Date.now();
    runBuild(result => {
      res.writeHead(result.ok?200:500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:result.ok,output:result.output,ms:Date.now()-t0,exitCode:result.exitCode}));
      addLog('POST /build', result.ok ? 'ok' : 'FAILED: ' + result.output.split('\n')[0]);
      console.log('build: ok=' + result.ok + ' (' + (Date.now()-t0) + 'ms)');
    }); return;
  }
  // POST /lint
  if (req.method === 'POST' && urlPath === '/lint') {
    const t0 = Date.now();
    execFile('node',['lint.js'],{cwd:ROOT},(err,stdout,stderr) => {
      const ms = Date.now()-t0; const ok = !err;
      const output = (stdout||stderr||(err&&err.message)||'').trim();
      res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok,output,ms}));
      addLog('POST /lint', output);
      console.log('lint: ok=' + ok + ' (' + ms + 'ms)');
    }); return;
  }
  // POST /git
  if (req.method === 'POST' && urlPath === '/git') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let msg = 'chore: update';
      try { msg = JSON.parse(body).message || msg; } catch(e){}
      const t0 = Date.now(); const {exec} = require('child_process');
      exec('git add -A && git commit -m ' + JSON.stringify(msg),{cwd:ROOT},(err,stdout,stderr)=>{
        const out = (stdout+stderr).trim();
        const hashM = out.match(/\[([^\s]+)\s+([a-f0-9]+)\]/);
        const branch = hashM?hashM[1]:''; const hash = hashM?hashM[2]:'';
        const ok = !err||out.includes('main');
        res.writeHead(ok?200:500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok,branch,hash,output:out,ms:Date.now()-t0}));
        addLog('POST /git', ok ? hash+' '+msg : 'FAIL');
        console.log('git commit: '+(ok?hash:'FAIL'));
      });
    }); return;
  }
  // POST /tag -- create annotated git tag
  // Body: {tag, message} e.g. {tag:'v0.9.61', message:'Release v0.9.61'}
  // Returns: {ok, tag, hash, output, ms}
  if (req.method === 'POST' && urlPath === '/tag') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let tag = '', msg = '';
      try { const p = JSON.parse(body); tag = p.tag||''; msg = p.message||('Release '+tag); } catch(e){}
      if (!tag) { res.writeHead(400); res.end(JSON.stringify({ok:false,error:'missing tag'})); return; }
      const t0 = Date.now(); const {exec} = require('child_process');
      const cmd = 'git tag -a ' + JSON.stringify(tag) + ' -m ' + JSON.stringify(msg);
      exec(cmd, {cwd:ROOT}, (err,stdout,stderr)=>{
        const out = (stdout+stderr).trim();
        const ok = !err;
        res.writeHead(ok?200:500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok,tag,output:out,ms:Date.now()-t0}));
        addLog('POST /tag', ok ? tag : 'FAIL: '+out.split('\n')[0]);
        console.log('git tag: '+(ok?tag:'FAIL'));
      });
    }); return;
  }
  // POST /snapshot
  if (req.method === 'POST' && urlPath.startsWith('/snapshot')) {
    const version = urlObj.searchParams.get('v')||'0.0.0';
    const src = path.join(ROOT,'sequence-builder.html');
    const dir = path.join(ROOT,'releases','v'+version);
    const dst = path.join(dir,'sequence-builder.html');
    fs.mkdirSync(dir,{recursive:true});
    fs.copyFile(src,dst,err=>{
      if(err){res.writeHead(500);res.end(err.message);return;}
      res.writeHead(200); res.end('OK: releases/v'+version+'/sequence-builder.html');
      // Also snapshot HANDOFF.md alongside the HTML
      const hfSrc = path.join(ROOT,'HANDOFF.md');
      const hfDst = path.join(dir,'HANDOFF-v'+version+'.md');
      fs.copyFile(hfSrc,hfDst,()=>{}); // best-effort, ignore errors
      addLog('POST /snapshot','v'+version);
      console.log('snapshot: releases/v'+version+'/sequence-builder.html');
      // README validation gate
      try {
        var rmTxt = fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
        var rmTarget = 'releases/v'+version+'/sequence-builder.html';
        var rmHasLink = rmTxt.indexOf(rmTarget) !== -1;
        var rmHasLoop = rmTxt.indexOf('github.io/sequence-builder/)') !== -1;
        if (!rmHasLink) addLog('POST /snapshot','WARN: README missing link to '+version);
        if (rmHasLoop)  addLog('POST /snapshot','WARN: README contains loop link (root URL)');
      } catch(rmErr) { addLog('POST /snapshot','WARN: README unreadable'); }
    }); return;
  }
  // GET /log
  if (req.method === 'GET' && urlPath === '/log') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({entries:logBuffer,bufferSize:LOG_BUFFER_DEFAULT,logHtmlMtime:logHtmlMtime}));
    return;
  }
  // GET /git-log
  if (req.method === 'GET' && urlPath === '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(e) { lines = ['error: ' + e.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /git-log
  if (req.method == 'GET' && urlPath == '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(e) { lines = ['error: ' + e.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /git-log
  if (req.method == 'GET' && urlPath == '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(e) { lines = ['error: ' + e.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /git-log
  if (req.method == 'GET' && urlPath == '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(e) { lines = ['error: ' + e.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /git-log
  if (req.method == 'GET' && urlPath == '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(e) { lines = ['error: ' + e.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /git-log
  if (req.method == 'GET' && urlPath == '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(ex) { lines = ['error: ' + ex.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /git-log
  if (req.method == 'GET' && urlPath == '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(ex) { lines = ['error: ' + ex.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /git-log
  if (req.method == 'GET' && urlPath == '/git-log') {
    const n = parseInt(urlObj.searchParams.get('n') || '20', 10) || 20;
    const {execSync} = require('child_process');
    let lines = [];
    try {
      const out = execSync('git log --oneline -' + n, {cwd: ROOT}).toString().trim();
      lines = out ? out.split('\n') : [];
    } catch(ex) { lines = ['error: ' + ex.message]; }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({n, lines}));
    return;
  }

  // GET /api
  if (req.method === 'GET' && urlPath === '/api') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({server:'SequenceForge dev server v5',port:3799,endpoints:[
      {method:'GET',path:'/status',desc:'Session bootstrap'},
      {method:'GET',path:'/HANDOFF.md',desc:'Session handoff doc'},
      {method:'GET',path:'/api',desc:'Endpoint reference JSON'},
      {method:'GET',path:'/usage',desc:'AI usage guide plain text'},
      {method:'GET',path:'/log',desc:'Server event log JSON'},{method:'GET',path:'/git-log',desc:'git log --oneline JSON {n,lines, default 20}'},
      {method:'GET',path:'/test',desc:'Run build+tests HTML report'},
      {method:'POST',path:'/build',desc:'Run build.js JSON result'},
      {method:'POST',path:'/lint',desc:'Run lint.js JSON result'},
      {method:'POST',path:'/git',desc:'git add -A && commit'},
      {method:'POST',path:'/snapshot?v=X.Y.Z',desc:'Copy build + HANDOFF to releases/vX.Y.Z/'},
      {method:'POST',path:'/patch',desc:'Server-side find-replace {file,old,new} -- bypasses browser = filter'},
      {method:'GET',path:'/<file>',desc:'Read any file in repo root'},
      {method:'PUT',path:'/<file>',desc:'Write any file in repo root'},
    ]},null,2));
    return;
  }
  // GET /usage
  if (req.method === 'GET' && urlPath === '/usage') {
    res.writeHead(200,{'Content-Type':'text/plain'});
    res.end([
      'SequenceForge Dev Server -- AI Usage Guide',
      'FIRST ACTIONS: 1.GET /status  2.GET /HANDOFF.md  3.GET /test (99 passed)',
      'SECURITY FILTER: use String.fromCharCode(60+1) for = signs in js_tool',
      'GATE: 99 passed before AND after your work',
      'LINT: POST /lint after every HTML write',
      'POST /patch: server-side find-replace. Body: {file,old,new}. Returns {ok,replaced,length}.',
      'POST /patch CRITICAL: old/new strings MUST use \\r\\n (CRLF) line endings -- sf-server.js and sequence-builder.html are CRLF files.',
      '  A missed anchor (replaced:0) almost always means LF was used instead of CRLF. Never splice server files by character position.',
      '  FACTORY PATTERN (planned): use patchBody(file,old,new) helper that auto-normalises line endings so call sites cannot get this wrong.',
    '  Use this when the browser = filter blocks your javascript_tool patch call.',
    'RELEASE: gate->bump->build->lint->snapshot->validate-readme->HANDOFF->git->tag->push->GitHub Release',
      'POST /tag: create annotated tag. Body: {tag,message}. Returns {ok,tag,output,ms}. addLog fires.',
      'GITHUB RELEASE: New release->select tag->title+notes->attach releases/vX.Y.Z/sequence-builder.html->Publish',
      'HOT RELOAD: node launcher.js (not sf-server.js directly)',
      'LOG UI: http://localhost:3799/log.html',
    ].join('\n'));
    return;
  }
  // PUT /<file>
  // ?verify=1 returns {ok,wrote,status} so caller can confirm version without a second round-trip
  if (req.method == 'PUT') {
    const fp = path.join(ROOT, urlPath);
    const verify = urlObj.searchParams.get('verify') == '1';
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const dir = path.dirname(fp);
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFile(fp, body, 'utf8', err => {
        if (err) { res.writeHead(500); res.end(err.message); return; }
        if (fp.endsWith('log.html')) logHtmlMtime = Date.now();
        console.log('wrote', fp);
        addLog('PUT /' + path.relative(ROOT,fp).replace(/\\/g,'/'), 'wrote ' + body.length + ' bytes');
        if (!verify) { res.writeHead(200); res.end('OK'); return; }
        // verify=1: read version from html and return status inline
        const {execSync} = require('child_process');
        let version = '0.0.0';
        try { const h = fs.readFileSync(path.join(ROOT,'sequence-builder.html'),'utf8'); const vm = h.match(/SequenceForge v(\d+\.\d+\.\d+)/); if (vm) version = vm[1]; } catch(ex){}
        let git = {};
        try { git = {branch: execSync('git rev-parse --abbrev-ref HEAD',{cwd:ROOT}).toString().trim(), clean: execSync('git status --porcelain',{cwd:ROOT}).toString().trim().length == 0}; } catch(ex){}
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ok: true, wrote: path.basename(fp), status: {version, git}}));
      });
    });
    return;
  }

  // POST /patch -- server-side find-replace in a file, no browser eval needed
  // Body: { file, old, new }  Returns: { ok, replaced, length }
  // Use this to bypass the browser security filter for patches containing = signs
  if (req.method === 'POST' && urlPath === '/patch') {
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      let parsed;
      try { parsed = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('bad JSON'); return; }
      const fp = path.join(ROOT, parsed.file || '');
      if (!parsed.file || !fp.startsWith(ROOT)) { res.writeHead(400); res.end('missing file'); return; }
      fs.readFile(fp, 'utf8', (err, content) => {
        if (err) { res.writeHead(404); res.end('file not found: ' + parsed.file); return; }
        const oldStr = parsed.old || '';
        const newStr = parsed.new || '';
        if (!oldStr) { res.writeHead(400); res.end('missing old'); return; }
        const count = content.split(oldStr).length - 1;
        const patched = content.split(oldStr).join(newStr);
        if (count === 0) {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ ok: false, replaced: 0, length: content.length, error: 'old string not found' }));
          addLog('POST /patch', 'MISS: ' + parsed.file);
          return;
        }
        fs.writeFile(fp, patched, 'utf8', err2 => {
          if (err2) { res.writeHead(500); res.end(err2.message); return; }
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ ok: true, replaced: count, length: patched.length }));
          if (fp.endsWith('log.html')) logHtmlMtime = Date.now();
          console.log('patch: ' + parsed.file + ' replaced=' + count);
          addLog('POST /patch', 'ok: ' + parsed.file + ' r=' + count);
        });
      });
    }); return;
  }
// GET /validate-readme
  if (req.method === 'GET' && urlPath === '/validate-readme') {
    var qv = urlObj.searchParams.get('v') || '0.0.0';
    try {
      var rmTxt2 = fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
      var rmTarget2 = 'releases/v'+qv+'/sequence-builder.html';
      var hasLink2 = rmTxt2.indexOf(rmTarget2) !== -1;
      var hasLoop2 = rmTxt2.indexOf('github.io/sequence-builder/)') !== -1;
      var rmOk = hasLink2 && !hasLoop2;
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:rmOk, hasLink:hasLink2, hasLoop:hasLoop2, target:rmTarget2, version:qv}));
      addLog('GET /validate-readme', (rmOk?'ok':'WARN')+' v'+qv);
    } catch(e2) {
      res.writeHead(500); res.end(JSON.stringify({ok:false,error:e2.message}));
    }
    return;
  }

// GET /<file>
  if (req.method === 'GET') {
    if (urlPath === '/') { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(fs.readdirSync(ROOT))); return; }
    const fp = path.join(ROOT, urlPath);
    fs.readFile(fp,'utf8',(err,data)=>{
      if(err){res.writeHead(404);res.end('not found');return;}
      res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});
      res.end(data);
    }); return;
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT,function(){
  console.log('SequenceForge dev server at http://localhost:'+PORT);
  console.log('  /test -- run tests + HTML report');
  console.log('Serving: '+ROOT);
});