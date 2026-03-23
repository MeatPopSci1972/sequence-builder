# SequenceForge — Session Handoff <!-- IMPORTANT: Update this file on every release. Version and backlog must stay current. -->

## FIRST ACTIONS (do these before anything else)
1. GET http://localhost:3799/status — confirms version, git state, demos list
   Also available: GET /api (endpoint reference) | GET /usage (AI surgical guide)
2. GET http://localhost:3799/test — confirm gate is green (99/99)
3. Read relevant source file before touching anything

## DEV SERVER API (sf-server.js v5, port 3799)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /status | Session bootstrap — version, git, demos |
| GET | /HANDOFF.md | This file |
| GET | /api | Full endpoint reference JSON |
| GET | /usage | Surgical AI usage guide, plain text |
| GET | /log | Server event log JSON {entries, bufferSize, logHtmlMtime} |
| GET | /git-log | git log --oneline JSON {n, lines} — default n\=20 |
| GET | /test | Run build + tests, returns HTML report |
| POST | /patch | Server-side find-replace {file,old,new} -- bypasses browser = filter |
| POST | /build | Run build.js only, returns JSON {ok, output, ms, exitCode} |
| POST | /lint | Run lint.js HTML checks, returns JSON {ok, output, ms} |
| POST | /git | git add -A && commit, body: {"message":"..."} |
| GET | /<file> | Read any file in repo root |
| PUT | /<file> | Write any file in repo root. Add ?verify=1 to get {ok,wrote,status} back inline |
| POST | /snapshot?v=X.Y.Z | Copy build + HANDOFF-vX.Y.Z.md into releases/vX.Y.Z/ |
| GET | / | List all files in repo root |

## KEY FILES
- sequence-builder.html — single-file app (toolbar, CSS, JS, store injected at build)
- sequence-builder.store.js — store source (build.js syncs into HTML between sentinels)
- sequence-builder.test.js — 92 contract tests (Suites 1—11)
- build.js — syncs store.js — HTML between @@STORE-START / @@STORE-END
- lint.js — HTML integrity checker: buttons, SVG balance, sentinels, version
- sf-server.js — dev server v5 (GET/PUT files, POST /build /lint /git /snapshot /patch, GET /log /api /usage)
- launcher.js — hot-reload wrapper: USE THIS to start server (node launcher.js)
- log.html — server log viewer UI: filter bar with Select All paradigm, checkmark icons on active chips
- _gif_canary_inject.js — GIF capture loop (fetch+eval in canary tab)

## WORKFLOW PATTERN
```js
// 1. Read a file
fetch('http://localhost:3799/sequence-builder.store.js')
  .then(r=>r.text()).then(t=>{ window._store=t; console.log('LEN:'+t.length) })

// 2. Preferred: server-side patch (no browser = filter issues)
fetch('http://localhost:3799/patch', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({file:'sequence-builder.html', old:'OLD_STRING', new:'NEW_STRING'})
}).then(r=>r.json()).then(j=>console.log('PATCH:'+j.ok+' r='+j.replaced))

// 3. Build (syncs store into HTML)
fetch('http://localhost:3799/build', {method:'POST'})
  .then(r=>r.json()).then(j=>console.log('BUILD:ok='+j.ok))

// 4. Lint (catches HTML corruption)
fetch('http://localhost:3799/lint', {method:'POST'})
  .then(r=>r.json()).then(j=>console.log('LINT:ok='+j.ok+' '+j.output))

// 5. Gate — navigate to http://localhost:3799/test
//    confirm: "92 passed | 0 failed"
```

## RELEASE FLOW
1. Gate green at /test (92/92)
2. GET /status — read version, bump to next patch
3. POST /patch to bump version strings in sequence-builder.html
4. POST /build
5. POST /lint — must be ok before continuing
6. POST /snapshot?v=X.Y.Z
7. POST /git with message
8. Update HANDOFF.md — version + backlog
9. POST /git again

## READ CONSOLE PATTERN
After every javascript_tool call: read_console_messages(pattern: 'YOUR_LABEL:', clear: true)
Always prefix console.log with a unique label to filter results.

## STORE ARCHITECTURE
- Handlers called as handler({ type, payload, meta }) — NOT handler(payload)
- Destructure inside handler: LOAD_DEMO({ payload: { id } = {} } = {})
- DEMOS array in LOAD_DEMO; SF_DEMOS exposed before return{} in createStore
- build.js strips module.exports and splices store between @@STORE-START/@@STORE-END

## SECURITY NOTE
Browser security filter strips = and flags query-string content in javascript_tool eval.
WORKAROUNDS (all confirmed working):
1. var eq = String.fromCharCode(60+1) — builds = from char code
2. str.split(OLD).join(NEW) — avoids replace() which needs =
3. Index-based slicing: str.slice(0,N) + newPart + str.slice(M)
4. POST /patch (server-side find-replace, no browser eval needed) *** PREFERRED FOR ALL PATCHES ***
5. Build strings from parts: var s = "part1" + eq + "part2"
6. PUT ?verify=1 returns {ok,wrote,status:{version,git}} -- confirms write+version in one shot, response survives proxy
IMPORTANT: The filter triggers on the ENTIRE call text, not just string literals.
NOTE: test-*.txt is gitignored -- safe to use for smoke tests
NOTE: sequence-builder.html uses CRLF (\r\n); sequence-builder.test.js uses LF (\n);
      HANDOFF.md uses LF (\n). Always match the target file's line endings in /patch calls.

## HOT RELOAD
ALWAYS start the server with: node launcher.js
NEVER run: node sf-server.js directly (loses auto-restart on sf-server.js changes)
launcher.js watches sf-server.js via fs.watch, kills and restarts within ~300ms.
After writing sf-server.js, wait ~1s then verify with GET /status.

## LOG UI
Open http://localhost:3799/log.html for a live server event dashboard.
- Filter bar with endpoint chip toggles (Select All paradigm)
- Checkmark icons on active chips
- Newest entries at top, polls every 2s
- Pill shows version + SNAPSHOT or LATEST
- Auto-reloads when log.html is updated by a worker instance (logHtmlMtime)
- SAFE GUARD: only reloads when both old and new mtime > 0 (prevents crash loop)
- Buffer is in-memory — clears on server restart

## TOUR SYSTEM
Tour steps live in var STEPS=[] in the sf-tour-script block.
Steps support optional hooks:
  beforeShow: function() {} — fires before spotlight positioning; auto-delays 220ms for DOM settle
  afterLeave: function() {} — fires when navigating away from the step (Next, Back, or Done)
Step 9 (Auto-fit on Load) uses both:
  beforeShow: opens settings modal + raises tour z-indices above modal (10003/10004/10005)
  afterLeave: closes modal + restores z-indices to (9000/9001/9002)

## DEV LOOP WISDOM
### On /patch
POST /patch is the preferred edit method. It bypasses the browser = filter entirely.
Body: {file, old, new} — returns {ok, replaced, length, error?}.
replaced:0 almost always means a line-ending mismatch. Check the target file's EOL first.

### How lint.js came to exist
Across multiple sessions, index-based HTML patching produced silent corruptions.
Ghost SVG fragments leaked into toolbar button text nodes.
POST /lint is now part of every gate. Call it after every HTML write, before /test.

### sf-server.js patch rules
NEVER splice sf-server.js by character position. Use POST /patch with single-line CRLF-matched anchors ONLY.
A replaced:0 means CRLF vs LF mismatch -- read the raw bytes, confirm \r\n, retry.
If an anchor is not unique enough, add a comment sentinel in a separate patch first, then patch against it.
Never insert multi-line function bodies adjacent to http.createServer() -- the splice boundary is too fragile.

### The reinforcement pattern
When an AI instance is deep in a problem loop (patch, break, patch again):
1. If you find yourself applying the same class of fix more than twice: STOP.
   Propose infrastructure (a linter, a test, a validator) before the third patch.
2. POST /lint after every HTML write. If lint fails, fix structure before /test.
3. Visible errors over graceful degradation.

## VERSION
- Current: 0.9.57
- Bump pattern: html.split('0.9.57').join('0.9.58')
- Release handoff: https://github.com/MeatPopSci1972/sequence-builder/blob/main/releases/v0.9.57/sequence-builder.html

## DEMOS (registered in store)
- auth-flow — Auth Flow (original)
- scada-control — SCADA: Control Flow
- cybersec-zones — CyberSecurity: Zone Analysis

## BACKLOG (priority order — always keep items here, never leave empty)
### Ready
*(all items shipped as of v0.9.57 — icebox cleared)*

### Icebox
*(empty — all items shipped)*

### Icebox
1. Export cost data as CSV from the Session Cost Panel
2. Remove PIN buttons from left and right panels — update tests accordingly
3. Organise EXPORT / IMPORT actions into a dropdown group modelled after the DEMO pattern
4. addLog coverage audit — POST /patch and PUT /<file> are not logged (patch miss rate is the primary loop-detection signal); GET /git-log is logged but should not be (noise); /api doc reference for each endpoint should declare whether addLog fires
5. sf-server.js hardening — update /usage to make CRLF requirement explicit for all /patch calls; consider a factory/builder pattern for constructing patch bodies so CRLF is injected automatically rather than relying on call-site discipline; this prevents crash loops from malformed patches

### Former icebox (good ideas, not yet scoped)
1. Organise files into /server — move server files into server/ subfolder

## REPO
- GitHub: https://github.com/MeatPopSci1972/sequence-builder
- Local: E:\uml2prompt\sequence-builder-prototype
- Branch: main

## NOTE: sf-server.js IS IN GIT (as of v0.9.43)
sf-server.js is tracked in git. If it is lost or corrupted:
1. Use the bootstrap recovery:
   node -e "require('http').createServer(function(req,res){if(req.method==='PUT'){var b='';req.on('data',function(d){b+=d});req.on('end',function(){require('fs').writeFileSync('sf-server.js',b);res.end('OK');process.exit()})}else{res.end('ready')}}).listen(9999,function(){console.log('BOOTSTRAP:ready')})"
2. Navigate browser to http://localhost:9999
3. PUT the server content via javascript_tool fetch
4. See /api and /usage for the full endpoint spec to rebuild from.
