# SequenceForge — Session Handoff
<!-- IMPORTANT: Update this file on every release. Version and backlog must stay current. -->

## FIRST ACTIONS (do these before anything else)
1. GET http://localhost:3799/status
   Also available: GET /api (endpoint reference) | GET /usage (AI surgical guide) → confirms version, git state, demos list
2. GET http://localhost:3799/test → confirm gate is green (85/85)
3. Read relevant source file before touching anything

## DEV SERVER API (sf-server.js v5, port 3799)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /status | Session bootstrap -- version, git, demos |
| GET | /HANDOFF.md | This file |
| GET | /test | Run build + tests, returns HTML report |
| POST | /build | Run build.js only, returns JSON {ok, output, ms, exitCode} |
| POST | /lint | Run lint.js HTML checks, returns JSON {ok, output, ms} |
| GET  | /log   | Recent server events JSON {entries,bufferSize}. View at /log.html |
| GET  | /api   | Full endpoint reference JSON. Read when unsure what tools exist |
| GET  | /usage | Surgical AI usage guide, plain text. Read before patching files |
| POST | /git | git add -A && commit, body: {"message":"..."}, returns {ok,branch,hash} |
| GET | /<file> | Read any file in repo root |
| PUT | /<file> | Write any file in repo root |
| POST | /snapshot?v=X.Y.Z | Copy build into releases/vX.Y.Z/ |
| GET | / | List all files in repo root |

## KEY FILES
- sequence-builder.html -- single-file app (toolbar, CSS, JS, store injected at build)
- sequence-builder.store.js -- store source (build.js syncs into HTML between sentinels)
- sequence-builder.test.js -- 85 contract tests
- build.js -- syncs store.js -> HTML between @@STORE-START / @@STORE-END
- lint.js -- HTML integrity checker: buttons, SVG balance, sentinels, version
- sf-server.js -- dev server v5 (GET/PUT files, POST /build /lint /git /snapshot)
- launcher.js -- hot-reload wrapper: USE THIS to start server: node launcher.js -- auto-restarts on sf-server.js change. Never run node sf-server.js directly
- _gif_canary_inject.js -- GIF capture loop (fetch+eval in canary tab)

## WORKFLOW PATTERN
```js
// 1. Read a file
fetch('http://localhost:3799/sequence-builder.store.js')
  .then(r=>r.text()).then(t=>{ window._store=t; console.log('LEN:'+t.length) })

// 2. Patch in memory, verify
const patched = window._store.replace(OLD, NEW)
console.log('PATCH:'+(patched!==window._store?'OK':'FAIL')+' len='+patched.length)

// 3. Write back
fetch('http://localhost:3799/sequence-builder.store.js',
  { method:'PUT', headers:{'Content-Type':'text/plain'}, body: patched })
  .then(r=>r.text()).then(t=>console.log('WRITE:'+t))

// 4. Build (syncs store into HTML)
fetch('http://localhost:3799/build', {method:'POST'})
  .then(r=>r.json()).then(j=>console.log('BUILD:ok='+j.ok+' '+j.output.split('\n')[0]))

// 5. Gate — navigate to http://localhost:3799/test
//    confirm: document.body.innerText includes "✓ ALL PASS" and "85 passed"
```

## RELEASE FLOW
1. Gate green at /test (85/85)
2. GET /status → read version, bump to next patch
3. replaceAll old version → new version in sequence-builder.html
4. PUT sequence-builder.html
5. POST /build
6. POST /snapshot?v=X.Y.Z
7. POST /git with message
8. **Update HANDOFF.md** — version + backlog — then POST /git again

## READ CONSOLE PATTERN
After every javascript_tool call:
  read_console_messages(pattern: 'YOUR_LABEL:', clear: true, limit: 3)
Always prefix console.log with a unique label to filter results.

## STORE ARCHITECTURE
- Handlers called as handler({ type, payload, meta }) — NOT handler(payload)
- Destructure inside handler: LOAD_DEMO({ payload: { id } = {} } = {})
- DEMOS array in LOAD_DEMO; SF_DEMOS exposed before return{} in createStore
- build.js strips module.exports and splices store between @@STORE-START/@@STORE-END

## SECURITY NOTE
Browser security filter strips = and flags query-string content in javascript_tool eval.
If a replace() fails silently, split the string differently or use index-based slicing.

## DEV LOOP WISDOM
This section records hard-won patterns from real sessions. New instances should read this.

### How lint.js came to exist
Across multiple sessions, index-based HTML patching through the javascript_tool eval channel
produced silent corruptions -- ghost SVG fragments leaked into toolbar button text nodes,
rendering as visible garbage in the UI (e.g. "dth=\"1.2\"/> Fit" in the toolbar).
The corruptions were not caught by the 85 store/logic tests because those tests have no
visibility into HTML structure.

The fix came not from another patching session but from stepping back: the human observed
that a linter would address the root cause more efficiently than continued surgical repair.
That single external observation -- treat the symptom with tooling, not with more patches --
prompted the creation of lint.js and POST /lint in one focused session.

### The reinforcement pattern
When an AI instance is deep in a problem loop (patch, break, patch again), it may not
self-interrupt to propose tooling. The human asking "could we add a linter?" is doing
the systems-thinking that breaks the loop. To reinforce this behavior:
  1. When you find yourself applying the same class of fix more than twice, STOP.
     Propose infrastructure (a linter, a test, a validator) before the third patch.
  2. POST /lint is now part of the gate. Call it after every HTML write, before /test.
     If lint fails, do not proceed to /test -- fix the structural issue first.
  3. Visible errors over graceful degradation. Lint failing loudly is the goal.
     A silent pass that hides corruption is worse than a noisy fail that surfaces it.

## VERSION
- Current: 0.9.40
- Version strings in sequence-builder.html (replaceAll to bump)
- Bump pattern: html.replaceAll('0.9.40', '0.9.41')
- Release handoff: https://github.com/MeatPopSci1972/sequence-builder/blob/main/releases/v0.9.40/sequence-builder.html

## DEMOS (registered in store)
- auth-flow — Auth Flow (original)
- scada-control — SCADA: Control Flow
- cybersec-zones — CyberSecurity: Zone Analysis

## BACKLOG (priority order -- always keep items here, never leave empty)
### Ready
1. Auto fit-to-diagram on load -- user preference toggle: when enabled, viewport auto-scales after any LOAD_DEMO or LOAD_DIAGRAM dispatch so the diagram fills the canvas.
2. Canary S1 frame fix -- S1 gets dropped when recording starts mid-session. Fix: navigate fresh to canary URL, inject, start recording, THEN drive loop so all 8 frames land.

### Icebox (good ideas, not yet scoped)
3. Message label editing -- double-click a message arrow to edit its label inline on the canvas
4. Actor reorder -- drag actors left/right to reorder their columns
5. Export to PNG -- render the SVG canvas to a PNG download
6. Mermaid output format -- add Mermaid sequenceDiagram as a second output format option alongside PlantUML
7. Organise README -- rewrite README.md: overview, quick-start, dev-server API table, lint/launcher usage, backlog link
8. Organise files into /server -- move sf-server.js, launcher.js, lint.js, build.js into a server/ subfolder; update all require paths and dev server ROOT references
9. Version release links -- each release entry in releases/ gets a matching HANDOFF-vX.Y.Z.md snapshot so changelogs are browsable by version
10. Server log UI -- GET /log endpoint streams recent server events (action + result pairs); a standalone /log.html page displays them newest-first in a simple list; buffer size (default 100) settable in user preferences panel; auto-refreshes every 2s

## REPO
- GitHub: https://github.com/MeatPopSci1972/sequence-builder
- Local: E:\uml2prompt\sequence-builder-prototype
- Branch: main
