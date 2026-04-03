// sf-readme-gen.js
// Generates README.md from live sources.
// Called by POST /generate-readme in sf-server.js.
// Sources: git ls-files, test suite headers, SF_ENDPOINTS, version from HTML.

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { SF_ENDPOINTS } = require('./sf-endpoints');

function generateReadme(ROOT) {
  // 1. Version from HTML comment
  const htmlHead  = fs.readFileSync(path.join(ROOT, 'sequence-builder.html'), 'utf8').slice(0, 2000);
  const verMatch  = htmlHead.match(/Version:\s*([\d.]+)/);
  const version   = verMatch ? verMatch[1] : '0.0.0';
  const demoUrl   = 'https://MeatPopSci1972.github.io/sequence-builder/releases/v' + version + '/sequence-builder.html';
  const relUrl    = 'https://github.com/MeatPopSci1972/sequence-builder/releases';

  // 2. Repo file list from git — exclude generated/archive/dev dirs
  const EXCLUDE = ['releases/', 'docs/', 'test-snapshots/', 'dev/', '.'];
  const gitFiles = execSync('git ls-files', { cwd: ROOT })
    .toString().trim().split('\n')
    .filter(f => !EXCLUDE.some(ex => f.startsWith(ex)))
    .filter(f => f !== 'CHANGELOG.md' && f !== 'HANDOFF.md' && f !== 'package-lock.json');

  // 3. Suite names from test file — lines matching 'Suite N — Name'
  const testTxt = fs.readFileSync(path.join(ROOT, 'sequence-builder.test.js'), 'utf8');
  const suites  = [...testTxt.matchAll(/Suite (\d+) \u2014 ([^\n'"`\u2500]+)/g)]
    .map(m => ({ n: parseInt(m[1]), name: m[2].trim() }))
    .filter((v, i, a) => a.findIndex(x => x.n === v.n) === i)
    .sort((a, b) => a.n - b.n);

  // 4. Test count from summary line in test file
  const countMatch = testTxt.match(/console\.log\(`\\n.*?(\d+) passed/);
  const testCount  = countMatch ? countMatch[1] : '127';

  // 5. Build sections
  const repoRows  = gitFiles.map(f => '| `' + f + '` | |').join('\n');
  const apiRows   = SF_ENDPOINTS.map(ep =>
    '| ' + ep.method + ' | `' + ep.path + '` | ' + ep.desc + ' |'
  ).join('\n');
  const suiteList = suites.length
    ? suites.map(s => '- **Suite ' + s.n + '** \u2014 ' + s.name).join('\n')
    : '_suite headers not found — add \'// \u2014 Suite N \u2014 Name\' comments to test file_';

  return [
    '# SequenceForge',
    '',
    '> A single-file, zero-dependency UML sequence diagram builder.  ',
    '> Runs entirely in the browser. No build step. npm install only for Playwright render tests.',
    '',
    '**[Live demo \u2014 v' + version + '](' + demoUrl + ')** &nbsp;|&nbsp; **[All releases](' + relUrl + ')**',
    '',
    '---',
    '',
    '## Quick start',
    '',
    '```bash',
    'git clone https://github.com/MeatPopSci1972/sequence-builder',
    'cd sequence-builder',
    'node launcher.js        # dev server with hot-reload at http://localhost:3799',
    '```',
    '',
    'Open `http://localhost:3799` in your browser.',
    '',
    '---',
    '',
    '## What it does',
    '',
    'Capabilities pinned by the contract test suites:',
    '',
    suiteList,
    '',
    '---',
    '',
    '## Repository structure',
    '',
    '| File | Notes |',
    '|------|-------|',
    repoRows,
    '',
    '---',
    '',
    '## Dev server API',
    '',
    'Served by `sf-server.js` via `launcher.js` on port 3799.',
    '',
    '| Method | Path | Description |',
    '|--------|------|-------------|',
    apiRows,
    '',
    '---',
    '',
    '## Running the tests',
    '',
    '```bash',
    'node build.js && node sequence-builder.test.js',
    '# Expected: ' + testCount + ' passed | 0 failed | ' + testCount + ' total',
    '```',
    '',
    'Or via the dev server: `GET http://localhost:3799/test`',
    '',
    '---',
    '',
    '## Tech stack',
    '',
    'Vanilla JS, SVG, HTML5 Canvas. No frameworks, no bundler, no runtime dependencies.',
    '',
    '---',
    '',
    '## License',
    '',
    'MIT',
    '',
  ].join('\n');
}

module.exports = { generateReadme };
