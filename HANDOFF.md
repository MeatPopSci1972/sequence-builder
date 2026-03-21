# SequenceForge — Session Handoff
<!-- Machine-readable context for a fresh Claude instance with Claude in Chrome tools -->

## FIRST ACTIONS (do these before anything else)
1. GET http://localhost:3799/status → confirms version, git state, demos list
2. GET http://localhost:3799/test → confirm gate is green (85/85)
3. Then read the relevant source file before touching anything

## DEV SERVER API (sf-server.js v4, port 3799)
All file I/O goes through this server. No bash, no filesystem tools needed.

| Method | Path | Purpose |
|--------|------|---------|
| GET  | /status | Session bootstrap — version, git, demos, gate hint |
| GET  | /test | Run build.js + tests, returns HTML report |
| POST | /build | Run build.js only, returns JSON {ok, output, ms, exitCode} |
| POST | /git | git add -A && commit, body: {"message":"..."}, returns {ok,branch,hash,output,ms} |
| GET  | /<file> | Read any file in the repo root |
| PUT  | /<file> | Write any file in the repo root (body = file contents) |
| GET  | / | List all files in repo root |

## KEY FILES
- sequence-builder.html      — single-file app (toolbar, CSS, JS, store injected at build)
- sequence-builder.store.js  — store source (build.js syncs it into HTML between sentinels)
- sequence-builder.test.js   — 85 contract tests
- build.js                   — syncs store.js → HTML between @@STORE-START / @@STORE-END
- sf-server.js               — this dev server
- _gif_canary_inject.js      — GIF capture loop (inject via fetch+eval in canary tab)

## WORKFLOW PATTERN
```
// 1. Read a file
fetch('http://localhost:3799/sequence-builder.store.js').then(r=>r.text()).then(t=>{ window._store=t; console.log('LEN:'+t.length) })

// 2. Patch in memory, verify
const patched = window._store.replace(OLD, NEW)
const ok = patched !== window._store && patched.includes('expected string')
console.log('PATCH:'+(ok?'OK':'FAIL')+' len='+patched.length)

// 3. Write back
fetch('http://localhost:3799/sequence-builder.store.js', { method:'PUT', headers:{'Content-Type':'text/plain'}, body: patched }).then(r=>r.text()).then(t=>console.log('WRITE:'+t))

// 4. Build (syncs store into HTML)
fetch('http://localhost:3799/build', {method:'POST'}).then(r=>r.json()).then(j=>console.log('BUILD:ok='+j.ok+' '+j.output.split('\n')[0]))

// 5. Verify gate
// Navigate tab to http://localhost:3799/test and read document.body.innerText
```

## READ CONSOLE PATTERN
After every javascript_tool call, read results with:
read_console_messages(pattern: 'YOUR_LABEL:', clear: true, limit: 3)

Always prefix console.log output with a unique label so you can filter it.

## GATE COMMAND
POST /build → then navigate to /test → document.body.innerText.substring(0,80)
Must show: "✓ ALL PASS\n85 passed | 0 failed | 85 total"

## COMMIT PATTERN
```
fetch('http://localhost:3799/git', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ message: 'v0.9.XX — description\n\n- bullet 1\n- bullet 2' })
}).then(r=>r.json()).then(j=>console.log('GIT:'+JSON.stringify(j)))
```

## STORE ARCHITECTURE
- store source: sequence-builder.store.js (CommonJS, Node-compatible)
- build.js strips module.exports and splices store between @@STORE-START / @@STORE-END in HTML
- Handlers called as handler({ type, payload, meta }) — destructure payload inside handler
- DEMOS array in LOAD_DEMO handler; SF_DEMOS exposed at createStore init (before return {})

## VERSION
- Current: 0.9.34
- Version strings live in sequence-builder.html (2 occurrences of x.x.xx)
- Bump with: html.replaceAll('0.9.34', '0.9.35') before snapshot
- Snapshot: POST http://localhost:3799/snapshot?v=0.9.35

## BACKLOG (priority order)
1. Fit-to-diagram zoom — after render, auto-scale viewport so diagram fills canvas; expose as user preference toggle
2. SF_DEMOS init already fixed — dropdown works on first click

## REPO
- GitHub: https://github.com/MeatPopSci1972/sequence-builder
- Local: E:\uml2prompt\sequence-builder-prototype
- Branch: main
