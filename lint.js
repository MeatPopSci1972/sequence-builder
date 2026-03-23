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
const EXPECTED_TBTNS = 18;
const tbtns = (html.match(/class="tbtn"/g) || []).length;
if (tbtns !== EXPECTED_TBTNS) fail("expected " + EXPECTED_TBTNS + " .tbtn buttons, found " + tbtns);

// 4. Store sentinels present
if (!html.includes('@@STORE-START')) fail('missing @@STORE-START sentinel');
if (!html.includes('@@STORE-END'))   fail('missing @@STORE-END sentinel');

// 5. Balanced <svg> tags
const svgOpens  = (html.match(/<svg[\s>]/g) || []).length;
const svgCloses = (html.match(/<\/svg>/g) || []).length;
if (svgOpens !== svgCloses) fail("unbalanced <svg>: " + svgOpens + " open, " + svgCloses + " close");

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
