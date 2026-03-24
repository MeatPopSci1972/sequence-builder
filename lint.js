// lint.js -- SequenceForge HTML integrity checker
// Run: node lint.js
// POST /lint via sf-server.js

const fs   = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'sequence-builder.html');
const html = fs.readFileSync(HTML_FILE, 'utf8');

const failures = [];
const warnings = [];
function fail(msg) { failures.push('FAIL: ' + msg); }
function warn(msg) { warnings.push('WARN: ' + msg); }

// 1. No stray SVG fragments in toolbar button text
// Match each tbtn button block
const btnRe = /<button[^>]*class\="[^"]*tbtn[^"]*"[^>]*>([\s\S]*?)<\/button>/g;
let m;
while ((m = btnRe.exec(html)) !== null) {
  const inner = m[1];
  const textOnly = inner.replace(/<svg[\s\S]*?<\/svg>/g, '');
  const label = textOnly.replace(/<[^>]*>/g, '').trim();
  if (label.indexOf("/>") > -1) {
    fail("toolbar button has stray self-close in text: " + JSON.stringify(label.slice(0,60)));
  }
}

// 2. No double </button> sequences
var dblBtn = html.split("</button></button>").length - 1;
if (dblBtn > 0) fail("found " + dblBtn + " double </button></button> sequence(s)");

// 3. Toolbar button count stable
const EXPECTED_TBTNS = 14; // Export/Import are now dropdowns (tbtn-demo-trigger); 4 flat buttons replaced by menu items
const tbtns = (html.match(/class="tbtn"/g) || []).length;
if (tbtns !== EXPECTED_TBTNS) fail("expected " + EXPECTED_TBTNS + " .tbtn buttons, found " + tbtns);

// 4. Store sentinels present
if (!html.includes('@@STORE-START')) fail('missing @@STORE-START sentinel');
if (!html.includes('@@STORE-END'))   fail('missing @@STORE-END sentinel');

// 5. Balanced <svg> tags
const svgOpens  = (html.match(/<svg[\s>]/g) || []).length;
const svgCloses = (html.match(/<\/svg>/g) || []).length;
if (svgOpens !== svgCloses) fail("unbalanced <svg>: " + svgOpens + " open, " + svgCloses + " close");

// 6. Dropdown DOM containment -- each wrap must contain its menu ul
// Catches orphaned fragment bugs where a short patch anchor leaves <button class behind
var dropdowns = [
  {wrap:'tbtn-demo-wrap', menu:'tbtn-demo-menu', id:'demo-dropdown-wrap'},
  {wrap:'tbtn-io-wrap',   menu:'tbtn-io-menu',   id:'export-dropdown-wrap'},
  {wrap:'tbtn-io-wrap',   menu:'tbtn-io-menu',   id:'import-dropdown-wrap'},
];
dropdowns.forEach(function(d) {
  // Find the wrap div
  var wrapRe = new RegExp('id="' + d.id + '"[\\s\\S]*?(?=<div\\s|<button\\s|<\\!--|$)', '');
  var wrapIdx = html.indexOf('id="' + d.id + '"');
  if (wrapIdx === -1) { warn('dropdown wrap not found: #' + d.id); return; }
  // Find closing tag of the wrap -- scan forward for the menu ul
  var searchArea = html.substring(wrapIdx, wrapIdx + 2000);
  if (searchArea.indexOf('class="' + d.menu + '"') === -1) {
    fail('dropdown menu .' + d.menu + ' not found inside #' + d.id + ' -- possible orphaned fragment');
  }
});

// 7. .tbtn-io-menu must have position:absolute in CSS
// Catches the missing-property bug that caused menus to render in document flow
if (html.indexOf('tbtn-io-menu{display:none;position:absolute') === -1 &&
    html.indexOf('.tbtn-io-menu{display:none;position:absolute') === -1) {
  fail('.tbtn-io-menu CSS missing position:absolute -- dropdown items will render in document flow not float below button');
}

// Report
const all = failures.concat(warnings);
if (all.length) all.forEach(function(l){ console.log(l); });
if (failures.length) {
  console.log("lint: " + failures.length + " failure(s), " + warnings.length + " warning(s)");
  process.exit(1);
} else {
  console.log("lint: OK -- " + tbtns + " buttons, SVG balanced, sentinels present");
  process.exit(0);
}
