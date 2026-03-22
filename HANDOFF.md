# SequenceForge — Session Handoff
<!-- IMPORTANT: Update this file on every release. Version and backlog must stay current. -->

## FIRST ACTIONS (do these before anything else)
1. GET http://localhost:3799/status → confirms version, git state, demos list
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
- launcher.js -- hot-reload wrapper: node launcher.js auto-restarts server on sf-server.js change
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

## VERSION
- Current: 0.9.38
- Version strings in sequence-builder.html (replaceAll to bump)
- Bump pattern: html.replaceAll('0.9.38', '0.9.39')
- Release handoff: https://github.com/MeatPopSci1972/sequence-builder/blob/main/releases/v0.9.38/sequence-builder.html

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

## REPO
- GitHub: https://github.com/MeatPopSci1972/sequence-builder
- Local: E:\uml2prompt\sequence-builder-prototype
- Branch: main
