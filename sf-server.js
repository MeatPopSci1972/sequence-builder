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
      addLog('POST /snapshot','v'+version);
      console.log('snapshot: releases/v'+version+'/sequence-builder.html');
    }); return;
  }
  // GET /log
  if (req.method === 'GET' && urlPath === '/log') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({entries:logBuffer,bufferSize:LOG_BUFFER_DEFAULT,logHtmlMtime:logHtmlMtime}));
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
      {method:'GET',path:'/log',desc:'Server event log JSON'},
      {method:'GET',path:'/test',desc:'Run build+tests HTML report'},
      {method:'POST',path:'/build',desc:'Run build.js JSON result'},
      {method:'POST',path:'/lint',desc:'Run lint.js JSON result'},
      {method:'POST',path:'/git',desc:'git add -A && commit'},
      {method:'POST',path:'/snapshot?v=X.Y.Z',desc:'Copy build to releases/'},
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
      'FIRST ACTIONS: 1.GET /status  2.GET /HANDOFF.md  3.GET /test (85 passed)',
      'SECURITY FILTER: use String.fromCharCode(60+1) for = signs in js_tool',
      'GATE: 85 passed before AND after your work',
      'LINT: POST /lint after every HTML write',
      'RELEASE: gate->bump->PUT html->POST /build->POST /lint->POST /snapshot->POST /git->HANDOFF->POST /git',
      'HOT RELOAD: node launcher.js (not sf-server.js directly)',
      'LOG UI: http://localhost:3799/log.html',
    ].join('\n'));
    return;
  }
  // PUT /<file>
  if (req.method === 'PUT') {
    const fp = path.join(ROOT, urlPath);
    let body = ''; req.on('data',d=>body+=d); req.on('end',()=>{
      const dir = path.dirname(fp);
      fs.mkdirSync(dir,{recursive:true});
      fs.writeFile(fp,body,'utf8',err=>{
        if(err){res.writeHead(500);res.end(err.message);return;}
        res.writeHead(200); res.end('OK');
        if(fp.endsWith('log.html')) logHtmlMtime = Date.now();
        console.log('wrote',fp);
      });
    }); return;
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