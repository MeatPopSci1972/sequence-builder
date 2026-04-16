// sf-endpoints.js
// Single source of truth for all dev server API endpoints.
// Required by sf-server.js for both GET /api and POST /generate-readme.
// Add new endpoints here — both handlers stay in sync automatically.

'use strict';

const SF_ENDPOINTS = [
  {method:'GET', path:'/status',           desc:'Session bootstrap — version, git, demos'},
  {method:'GET', path:'/HANDOFF.md',       desc:'Session handoff doc'},
  {method:'GET', path:'/api',              desc:'Endpoint reference JSON (this)'},
  {method:'GET', path:'/usage',            desc:'AI usage guide plain text'},
  {method:'GET', path:'/log',              desc:'Server event log JSON'},
  {method:'GET', path:'/git-log',          desc:'git log --oneline JSON. Default n=20'},
  {method:'GET', path:'/test',             desc:'Run build+tests — returns HTML report'},
  {method:'GET', path:'/test-render',      desc:'Playwright render gate — 3 demos x 5 SVG layers'},
  {method:'GET', path:'/validate-readme',  desc:'Check README link+label for vX.Y.Z. Returns {ok,hasLink,hasLabel}'},
  {method:'GET', path:'/check-pages?v=X.Y.Z',   desc:'Fetch live GitHub Pages URL for vX.Y.Z. Returns {ok,status,url,ms}'},
  {method:'GET', path:'/slice',            desc:'Return named sentinel section of a file. No section = manifest'},
  {method:'POST',path:'/generate-readme',  desc:'Generate README.md from live sources — git, test suites, endpoints, version'},
  {method:'POST',path:'/build',            desc:'Run build.js — sync store.js into HTML'},
  {method:'POST',path:'/lint',             desc:'Run lint.js — button count, SVG balance, sentinels'},
  {method:'POST',path:'/patch',            desc:'Find-replace in file. Body:{file,anchor,replace}. Flex whitespace matching. Returns {ok,replaced,length}'},
  {method:'POST',path:'/git',              desc:'git add -A && commit. Body:{message}'},
  {method:'POST',path:'/git-restore',      desc:'Restore tracked file to HEAD. Body:{file}'},
  {method:'POST',path:'/tag',              desc:'Create annotated git tag. Body:{tag,message}'},
  {method:'POST',path:'/changelog',        desc:'Auto-gen CHANGELOG.md from git log since last tag. Body:{version}'},
  {method:'POST',path:'/update-handoff',   desc:'Populate live fields in HANDOFF.md from status+test+test-render'},
  {method:'POST',path:'/snapshot?v=X.Y.Z', desc:'Copy build+HANDOFF to releases/vX.Y.Z/'},
  {method:'GET', path:'/<file>',           desc:'Read any file in repo root'},
  {method:'PUT', path:'/<file>',           desc:'Write any file in repo root. ?verify=1 returns {ok,wrote,status}'},
];

module.exports = { SF_ENDPOINTS };
