
'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname);

// ── 1. Patch sequence-builder.html ───────────────────────────────────────────
let html = fs.readFileSync(path.join(ROOT, 'sequence-builder.html'), 'utf8');

// 1a. Replace Demo button with dropdown wrapper
const OLD_BTN = [
  '      <button class="tbtn" id="btn-load-demo" title="Load demo diagram">',
  '        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">',
  '          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>',
  '          <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  '        </svg>',
  '        Demo',
  '      </button>',
].join('\n');

const NEW_BTN = [
  '      <div class="tbtn-demo-wrap" id="demo-dropdown-wrap">',
  '        <button class="tbtn tbtn-demo-trigger" id="btn-load-demo" title="Load a demo diagram" aria-haspopup="true" aria-expanded="false">',
  '          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">',
  '            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>',
  '            <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  '          </svg>',
  '          Demo',
  '          <svg class="tbtn-chevron" width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">',
  '            <path d="M1.5 2.5L4 5l2.5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  '          </svg>',
  '        </button>',
  '        <ul class="tbtn-demo-menu" id="demo-menu" role="menu" aria-labelledby="btn-load-demo"></ul>',
  '      </div>',
].join('\n');

if (!html.includes(OLD_BTN)) { console.error('PATCH_ERR: OLD_BTN not found'); process.exit(1); }
html = html.replace(OLD_BTN, NEW_BTN);
console.log('  1a. toolbar dropdown: OK');

// 1b. Replace loadDemo function + wire
const OLD_LOADDEMO_FN = 'function loadDemo() {\n  store.dispatch({ type: \'LOAD_DEMO\', meta: { undoable: false } });\n}';
const NEW_LOADDEMO_FN = [
  'function loadDemo(id) {',
  '  store.dispatch({ type: \'LOAD_DEMO\', payload: { id }, meta: { undoable: false } });',
  '}',
  '',
  'function _buildDemoMenu() {',
  '  const menu = document.getElementById(\'demo-menu\');',
  '  if (!menu) return;',
  '  const demos = window.SF_DEMOS || [];',
  '  menu.innerHTML = demos.map(d =>',
  '    `<li class="tbtn-demo-item" role="menuitem" data-demo-id="${d.id}">${d.label}</li>`',
  '  ).join(\'\');',
  '  menu.querySelectorAll(\'.tbtn-demo-item\').forEach(li => {',
  '    li.addEventListener(\'click\', () => {',
  '      loadDemo(li.dataset.demoId);',
  '      _closeDemoMenu();',
  '    });',
  '  });',
  '}',
  '',
  'function _toggleDemoMenu() {',
  '  const wrap = document.getElementById(\'demo-dropdown-wrap\');',
  '  const btn  = document.getElementById(\'btn-load-demo\');',
  '  const open = wrap.classList.toggle(\'open\');',
  '  btn.setAttribute(\'aria-expanded\', open);',
  '  if (open) { _buildDemoMenu(); }',
  '}',
  '',
  'function _closeDemoMenu() {',
  '  const wrap = document.getElementById(\'demo-dropdown-wrap\');',
  '  const btn  = document.getElementById(\'btn-load-demo\');',
  '  if (!wrap) return;',
  '  wrap.classList.remove(\'open\');',
  '  btn.setAttribute(\'aria-expanded\', \'false\');',
  '}',
].join('\n');

if (!html.includes(OLD_LOADDEMO_FN)) { console.error('PATCH_ERR: OLD_LOADDEMO_FN not found'); process.exit(1); }
html = html.replace(OLD_LOADDEMO_FN, NEW_LOADDEMO_FN);
console.log('  1b. loadDemo fn + menu helpers: OK');

// 1c. Replace btn-load-demo click wire
const OLD_WIRE = "document.getElementById('btn-load-demo')?.addEventListener('click', loadDemo);";
const NEW_WIRE = [
  "document.getElementById('btn-load-demo')?.addEventListener('click', _toggleDemoMenu);",
  "document.addEventListener('click', e => { if (!e.target.closest('#demo-dropdown-wrap')) _closeDemoMenu(); });",
  "document.addEventListener('keydown', e => { if (e.key === 'Escape') _closeDemoMenu(); });",
  "// Initialise SF_DEMOS after first store event so window.SF_DEMOS is populated",
  "store.on('diagram:loaded', () => { if (window.SF_DEMOS) _buildDemoMenu(); });",
].join('\n');

if (!html.includes(OLD_WIRE)) { console.error('PATCH_ERR: OLD_WIRE not found'); process.exit(1); }
html = html.replace(OLD_WIRE, NEW_WIRE);
console.log('  1c. event wires: OK');

// 1d. Inject dropdown CSS — append before </style> in the first <style> block
const CSS_INJECT = [
  '/* ── Demo dropdown ──────────────────────────────────────── */',
  '.tbtn-demo-wrap { position: relative; display: inline-block; }',
  '.tbtn-chevron   { margin-left: 2px; transition: transform .15s; vertical-align: middle; }',
  '.tbtn-demo-wrap.open .tbtn-chevron { transform: rotate(180deg); }',
  '.tbtn-demo-menu {',
  '  display: none; position: absolute; top: calc(100% + 4px); left: 0;',
  '  min-width: 200px; background: var(--sf-bg-panel, #1a1d23);',
  '  border: 1px solid var(--sf-border, #2e3138); border-radius: 6px;',
  '  padding: 4px 0; margin: 0; list-style: none;',
  '  box-shadow: 0 6px 18px rgba(0,0,0,.45); z-index: 9999;',
  '}',
  '.tbtn-demo-wrap.open .tbtn-demo-menu { display: block; }',
  '.tbtn-demo-item {',
  '  padding: 7px 14px; cursor: pointer; font-size: 12px;',
  '  color: var(--sf-text-secondary, #a0a8b8); white-space: nowrap;',
  '  transition: background .1s, color .1s;',
  '}',
  '.tbtn-demo-item:hover {',
  '  background: var(--sf-accent-dim, rgba(99,179,237,.12));',
  '  color: var(--sf-text, #e2e8f0);',
  '}',
].join('\n');

// Find the toolbar style block — insert before last </style> before <body>
const styleEnd = html.indexOf('</style>');
if (styleEnd === -1) { console.error('PATCH_ERR: </style> not found'); process.exit(1); }
html = html.slice(0, styleEnd) + CSS_INJECT + '\n' + html.slice(styleEnd);
console.log('  1d. dropdown CSS: OK');

fs.writeFileSync(path.join(ROOT, 'sequence-builder.html'), html, 'utf8');
console.log('  sequence-builder.html written.');

// ── 2. Patch _gif_canary_inject.js — S2 random demo pick ─────────────────────
let canary = fs.readFileSync(path.join(ROOT, '_gif_canary_inject.js'), 'utf8');

const OLD_S2 = [
  '    async function S2() {',
  "      setActive('S2: Load demo');",
  "      clickEl('#btn-load-demo'); await sleep(300);",
].join('\n');

const NEW_S2 = [
  '    async function S2() {',
  "      // Pick a random demo from the registered list",
  "      var _demos = window.SF_DEMOS || [{ id: 'auth-flow', label: 'Auth Flow' }];",
  "      var _pick  = _demos[Math.floor(Math.random() * _demos.length)];",
  "      setActive('S2: Load demo — ' + _pick.label);",
  "      store.dispatch({ type: 'LOAD_DEMO', payload: { id: _pick.id }, meta: { undoable: false } });",
  "      await sleep(300);",
].join('\n');

if (!canary.includes(OLD_S2)) { console.error('PATCH_ERR: OLD_S2 not found in canary'); process.exit(1); }
canary = canary.replace(OLD_S2, NEW_S2);
fs.writeFileSync(path.join(ROOT, '_gif_canary_inject.js'), canary, 'utf8');
console.log('  _gif_canary_inject.js written.');

console.log('\nAll patches applied. Run node build.js to sync store into HTML.');
