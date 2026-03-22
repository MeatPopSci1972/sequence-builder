// _gif_canary_inject.js
// SequenceForge GIF capture injector.
//
// PURPOSE
// -------
// Inject this into sequence-builder.html?canary=1 to run all 8 canary
// scenarios with title-based frame signals for GIF capture.
//
// USAGE (Claude in Chrome -- start of GIF session)
// ------------------------------------------------
// 1. Navigate tab to: http://localhost:3799/sequence-builder.html?canary=1
// 2. Wait 2s for app to load
// 3. javascript_tool: inject via fetch + eval --
//
//    fetch('//_gif_canary_inject.js').then(r=>r.text()).then(src=>eval(src))  // local alias
//    OR shorter:
//    fetch('http://localhost:3799/_gif_canary_inject.js').then(r=>r.text()).then(eval)
//
// 4. Wait for title 'FRAME:ready'  <-- pre-signal: page is live, no scenario has run yet
// 5. gif_creator start_recording
// 6. Release the ready frame: window._frameReady=false; window._frameResume(); document.title='SF';
// 7. For each frame label [S1..S8, complete]:
//      a. computer screenshot  (save_to_disk:false)
//      b. javascript_tool release:
//         window._frameReady=false; window._frameResume(); document.title='SF';
//      c. computer wait 1s (next scenario runs automatically)
// 8. gif_creator stop_recording
// 9. gif_creator export download:true filename:sequenceforge-canary-vX.Y.Z.gif
//
// EXPONENTIAL BACKOFF (if screenshot times out)
// Wait delay ms, double (cap 3000ms), retry. Sequence: 200->400->800->1600->3000.
// Total budget: 8000ms. On success: reset delay to 200ms, release, advance.
//
// FRAME RELEASE SNIPPET (copy-paste for javascript_tool)
//   window._frameReady=false; window._frameResume(); document.title='SF';
//
// NOTES
// - Guard: window.__gifCanaryRunning prevents double-injection
// - Tour suppressed via localStorage before S1 runs
// - S8 sleeps 300ms after Escape so tour fully clears before summary frame
// - Zero dependencies. No build step.

(async function gifCanary() {
  if (window.__gifCanaryRunning) { console.warn('_gif_canary_inject: already running'); return; }
  window.__gifCanaryRunning = true;

  await new Promise(r => setTimeout(r, 400));

  // ── Overlay ───────────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#_gif-overlay{position:fixed;top:0;left:0;width:280px;max-height:100vh;overflow-y:auto',
    ';background:rgba(10,14,20,.92);color:#0f0;font:13px/1.5 monospace;padding:10px 12px',
    ';z-index:999999;border-right:1px solid rgba(0,255,0,.15);pointer-events:none}',
    '#_gif-overlay .row{padding:1px 0}',
    '#_gif-overlay .pass{color:#0f0}',
    '#_gif-overlay .fail{color:#f44}',
    '#_gif-overlay .active{color:#ff0}',
    '#_gif-overlay #_gif-summary{margin-top:8px;font-weight:bold;padding:4px 0',
    ';border-top:1px solid rgba(0,255,0,.25)}',
    '#_gif-overlay #_gif-summary.all-pass{color:#0f0}',
    '#_gif-overlay #_gif-summary.has-fail{color:#f44}',
    '#_gif-overlay #_gif-title{color:#0ff;margin-bottom:6px;font-size:11px}'
  ].join('');
  document.head.appendChild(styleEl);

  var ov = document.createElement('div');
  ov.id = '_gif-overlay';
  ov.innerHTML = '<div id="_gif-title">&#x2B21; SequenceForge Canary</div>' +
                 '<div id="_gif-log"></div><div id="_gif-summary"></div>';
  document.body.appendChild(ov);

  // ── Helpers ───────────────────────────────────────────────────────────────
  var logEl = document.getElementById('_gif-log');
  var summaryEl = document.getElementById('_gif-summary');
  var results = [], ar = null;

  function setActive(n) {
    if (ar) ar.remove();
    ar = document.createElement('div');
    ar.className = 'row active';
    ar.textContent = '\u25b6 ' + n;
    logEl.appendChild(ar); logEl.scrollTop = logEl.scrollHeight;
  }
  function log(n, p, d) {
    if (ar) { ar.remove(); ar = null; }
    results.push({name:n, pass:p, detail:d||''});
    var r = document.createElement('div');
    r.className = 'row ' + (p ? 'pass' : 'fail');
    r.textContent = (p ? '\u2713 ' : '\u2717 ') + n + (d ? ' -- ' + d : '');
    logEl.appendChild(r); logEl.scrollTop = logEl.scrollHeight;
  }
  function assert(n, c, d) { log(n, !!c, d); if (!c) throw new Error('FAIL: ' + n); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function pauseForFrame(label) {
    return new Promise(resolve => {
      window._frameReady = label || true;
      window._frameResume = resolve;
      document.title = 'FRAME:' + (label || 'ready');
    });
  }
  var q = sel => document.querySelector(sel);
  function actorsLayer()   { return q('#actors-layer'); }
  function messagesLayer() { return q('#messages-layer'); }
  function propsContent()  { return q('#props-content'); }
  function clickEl(sel) { var el=q(sel); if(!el) throw new Error('Not found: '+sel); el.click(); return el; }

  localStorage.setItem('sf-tour-done', '1');

  // ── Scenarios ─────────────────────────────────────────────────────────────
  var scenarios = [
    async function S1() {
      setActive('S1: Page loads');
      assert('S1: canvas present',         !!q('#canvas'));
      assert('S1: sidebar present',        !!q('#sidebar'));
      assert('S1: actors-layer present',   !!actorsLayer());
      assert('S1: messages-layer present', !!messagesLayer());
      await pauseForFrame('S1 complete');
    },
    async function S2() {
      var _demos = window.SF_DEMOS || [{id:'auth-flow',label:'Auth Flow'}];
      var _pick  = _demos[Math.floor(Math.random() * _demos.length)];
      setActive('S2: Load demo — ' + _pick.label);
      store.dispatch({ type: 'LOAD_DEMO', payload: { id: _pick.id }, meta: { undoable: false } });
      await sleep(300);
      var a=actorsLayer().querySelectorAll('g[data-type="actor"]');
      var m=messagesLayer().querySelectorAll('g[data-type="message"]');
      assert('S2: demo actors in SVG',   a.length>=3, 'found '+a.length);
      assert('S2: demo messages in SVG', m.length>=3, 'found '+m.length);
      assert('S2: statusbar actors',     parseInt(q('#stat-actors').textContent)>=3);
      assert('S2: statusbar messages',   parseInt(q('#stat-msgs').textContent)>=3);
      await pauseForFrame('S2 complete');
    },
    async function S3() {
      setActive('S3: Click actor -> Props');
      var fa=actorsLayer().querySelector('g[data-type="actor"]');
      assert('S3: actor exists', !!fa);
      var inner=fa.querySelector('rect')||fa;
      ['mousedown','mouseup','click'].forEach(t=>inner.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true})));
      await sleep(250);
      var c=propsContent().textContent.trim();
      assert('S3: props populated', c.length>0, '"'+c.slice(0,40)+'"');
      q('#canvas').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      await sleep(100);
      await pauseForFrame('S3 complete');
    },
    async function S4() {
      setActive('S4: Add actor via toolbar');
      var before=actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      clickEl('#btn-add-actor'); await sleep(300);
      var mid=actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      if (mid<=before) { q('#canvas').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:500,clientY:300})); await sleep(300); }
      var after=actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      assert('S4: actor count increased', after>before, before+'->'+after);
      assert('S4: statusbar updated',     parseInt(q('#stat-actors').textContent)===after);
      await pauseForFrame('S4 complete');
    },
    async function S5() {
      setActive('S5: Undo removes actor');
      var before=actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      clickEl('#btn-undo'); await sleep(200);
      var after=actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      assert('S5: undo removed actor', after<before, before+'->'+after);
      await pauseForFrame('S5 complete');
    },
    async function S6() {
      setActive('S6: Sidebar collapse');
      var sb=q('#sidebar'); clickEl('#sidebar-toggle-btn'); await sleep(200);
      assert('S6: left state-full', !sb.classList.contains('state-full'), sb.className);
      clickEl('#sidebar-toggle-btn'); await sleep(150);
      await pauseForFrame('S6 complete');
    },
    async function S7() {
      setActive('S7: PlantUML output');
      clickEl('#tab-output'); await sleep(150);
      var code=q('#output-code');
      assert('S7: output-code present', !!code);
      assert('S7: output non-empty',    code.textContent.trim().length>0);
      assert('S7: contains @startuml',  code.textContent.includes('@startuml')||code.textContent.includes('sequenceDiagram'));
      await pauseForFrame('S7 complete');
    },
    async function S8() {
      setActive('S8: Tour launches');
      localStorage.removeItem('sf-tour-done');
      clickEl('#sf-tour-help-btn'); await sleep(400);
      var to=q('.sf-tour-overlay,.tour-overlay,[class*="tour"]');
      var tc=q('.sf-tour-card,[class*="tour-card"]');
      assert('S8: tour overlay/card appears', !!(to||tc), 'overlay='+!!to+' card='+!!tc);
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      await sleep(300);
      await pauseForFrame('S8 complete');
    },
  ];

  // ── Runner ────────────────────────────────────────────────────────────────
  var passed=0, failed=0;
  await pauseForFrame('ready'); // operator starts recording here -- before any scenario runs
  for (var s of scenarios) {
    try { await s(); passed++; } catch(e) { failed++; }
    await sleep(200);
  }
  if (ar) { ar.remove(); ar=null; }

  await pauseForFrame('complete');

  summaryEl.className = failed===0 ? 'all-pass' : 'has-fail';
  summaryEl.textContent = failed===0
    ? '\u2713 ALL PASS '+passed+' passed | 0 failed | '+(passed+failed)+' total'
    : passed+' passed | '+failed+' failed | '+(passed+failed)+' total';

  window.gifCanaryResults = results;
}());