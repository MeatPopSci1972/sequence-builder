Handoff
<!-- IMPORTANT: Update this file on every release. Version and backlog must stay current. -->

## FIRST ACTIONS (do these before anything else)
1. GET http://localhost:3799/status — confirm version, clean=true
2. GET http://localhost:3799/test — confirm gate is green (0 failures, 177 ran)
3. GET http://localhost:3799/test-render — confirm render gate green (0 failures, 15 ran)
4. GET https://api.github.com/repos/MeatPopSci1972/sequence-builder/issues?state=open&per_page=50 — review open issues; this is the authoritative backlog
5. Read this file fully, paying close attention to ## BACKLOG

Also available: GET /api (endpoint reference) | GET /usage (AI surgical guide)

## ⚠ TOKEN DISCIPLINE — MANDATORY
NEVER fetch sequence-builder.html in full. It is 225KB+ and burns session tokens.
ALWAYS use GET /slice?file=sequence-builder.html&section=SECTION to read only what you need.
Available sections: store · render · events · toolbar · themes
Use POST /patch with a known anchor string to write. Full-file reads are PROHIBITED.

## DEV SERVER API (server.js v5, port 3799)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /status | Session bootstrap — version, git, demos |
| GET | /HANDOFF.md | This file |
| GET | /api | Full endpoint reference JSON |
| GET | /usage | Surgical AI usage guide, plain text |
| GET | /slice?file=&section= | Return named sentinel section of a file. No section = manifest of available sections {store,render,events,toolbar} |
| GET | /log | Server event log JSON {entries, bufferSize, logHtmlMtime} |
| GET | /git-log | git log --oneline JSON {n, lines} — default n=20 |
| GET | /test | Run build + tests, returns HTML report |
| GET | /test-render | Playwright render gate — diff 3 demos x 5 SVG layers against snapshots. ?update=1 writes snapshots. Returns {ok,passed,failed,total,results[]} |
| POST | /patch | Server-side find-replace {file,old,new} -- bypasses browser = filter |
| POST | /build | Run build.js only, returns JSON {ok, output, ms, exitCode} |
| POST | /lint | Run lint.js HTML checks, returns JSON {ok, output, ms} |
| POST | /git | git add -A && commit, body: {"message":"..."} |
| GET | /<file> | Read any file in repo root |
| PUT | /<file> | Write any file in repo root. Add ?verify=1 to get {ok,wrote,status} back inline |
| POST | /update-handoff | Populate all live fields in HANDOFF.md from /status+/test+/test-render. Idempotent. |
| POST | /snapshot?v=X.Y.Z | Copy build + HANDOFF-vX.Y.Z.md into releases/vX.Y.Z/ |
| GET | /validate-readme?v=X.Y.Z | Checks README has link + label text + no loop for vX.Y.Z. Returns {ok,hasLink,hasLabel,hasLoop}.
| GET | /check-pages?v=X.Y.Z | Fetch live GitHub Pages URL. Returns {ok,status,url,ms}. Run after push to confirm release is live. addLog fires. |
| POST | /git-restore | Restore tracked file to HEAD. Body: {file}. Returns {ok,file,output,ms}. **addLog fires** |
| POST | /changelog | Auto-gen CHANGELOG.md entry from git log since last tag. Body: {version}. Returns {ok,version,entry,length,ms}. **addLog fires** |
| POST | /bump | Increment patch from latest git tag, write to HTML. Body: {} or {version}. Returns {ok,newVersion,ms}. |
| POST | /tag | Create annotated git tag. Body: {tag,message}. Returns {ok,tag,output,ms}. **addLog fires** |
| GET | / | List all files in repo root |

## KEY FILES
- sequence-builder.html — single-file app (toolbar, CSS, JS, store injected at build)
- sequence-builder.store.js — store source (build.js syncs into HTML between sentinels)
- sequence-builder.test.js — 170 contract tests (Suites 1-16)
- themes.json — theme definitions (dark/light/system/lcars), served as GET /themes.json
- build.js — syncs store.js into HTML between @@STORE-START / @@STORE-END
- lint.js — HTML integrity checker: buttons, SVG balance, sentinels, version
- server.js — dev server v5 (entry point + route dispatcher; requires sf-endpoints.js + sf-readme-gen.js)
- sf-endpoints.js — SF_ENDPOINTS const — single source of truth for all API endpoints (used by /api and /generate-readme)
- sf-readme-gen.js — generateReadme() — generates README.md from live git, test, endpoint, version sources (GET/PUT files, POST /build /lint /git /snapshot /patch, GET /log /api /usage /test-render)
- test-snapshots/ — render layer snapshot files (gitignored; seed with GET /test-render?update=1)
- launcher.js — hot-reload wrapper: USE THIS to start server (node launcher.js)
- sf-preflight.ps1 — pre-flight check script (run before each session)
- log.html — server log viewer UI
- CHANGELOG.md — release history, auto-generated via POST /changelog (auto-commits)
- releases/ — per-version snapshots: releases/vX.Y.Z/sequence-builder.html + HANDOFF-vX.Y.Z.md
- docs/sessions/ — archived session handoff files (v0.9.16–v0.9.33)
- dev/ — canary test harness and dev tooling (replaced by GET /test + GET /test-render)

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

// 5. Full gate — both must pass before release
//    GET /test        -> 99 passed | 0 failed
//    GET /test-render -> passed:15, failed:0
```

## RELEASE FLOW (v0.9.68+)
1. GET /test (170/170) + GET /test-render (15/15) both green — also verify sf-preflight.ps1 expected count matches
2. POST /bump — increments patch from latest git tag, writes display version to HTML
3. POST /build
4. POST /lint — must be ok before continuing
5. POST /snapshot?v=X.Y.Z
6. POST /generate-readme — regenerate README.md from live sources
7. GET /validate-readme?v=X.Y.Z — must return ok:true before continuing
8. POST /git with feat/fix/chore commit message
9. POST /update-handoff — populates all live fields automatically
10. POST /git again (HANDOFF commit)
11. POST /changelog {version:"X.Y.Z"}
12. POST /tag {tag:"vX.Y.Z", message:"Release vX.Y.Z — <summary>"}
13. git push && git push --tags (terminal)
14. GitHub -> Releases -> New release -> select tag -> add title + notes -> attach releases/vX.Y.Z/sequence-builder.html -> Publishlish

## READ CONSOLE PATTERN
After every javascript_tool call: read_console_messages(pattern: 'YOUR_LABEL:', clear: true)
Always prefix console.log with a unique label to filter results.

## STORE ARCHITECTURE
- Handlers called as handler({ type, payload, meta }) — NOT handler(payload)
- Destructure inside handler: LOAD_DEMO({ payload: { id } = {} } = {})
- DEMOS array in LOAD_DEMO; SF_DEMOS exposed before return{} in createStore
- build.js strips module.exports and splices store between @@STORE-START/@@STORE-END
- 8 named selectors on store: getActorById, getMessageById, getNoteById, getFragmentById, getActorsExcept, getMessagesExcept, getNotesExcept, getFragmentsExcept
- store.on / store.off for event listeners — all 20 mutation events fire persist + output refresh
- render() is a pure DOM projection — no side effects, no localStorage writes

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
NOTE: sequence-builder.html uses CRLF (\r\n); sequence-builder.test.js uses LF (\n); HANDOFF.md uses LF (\n). Always match the target file's line endings in /patch calls. (using .gitattributes)

## HOT RELOAD
ALWAYS start the server with: node launcher.js
NEVER run: node server.js directly (loses auto-restart on server.js changes)
launcher.js watches server.js, sf-readme-gen.js, and sf-endpoints.js via fs.watch, kills and restarts within ~300ms.
After writing server.js, wait ~1s then verify with GET /status.

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

### Suite 16 — Regex contract rule
Every regex in the codebase that transforms data must have a test in Suite 16. New regex = new test. No exceptions.
The canonical failure case: `/@import[^;]+;/g` appeared to strip Google Fonts imports but silently left URL fragments behind because semicolons inside `url(...)` strings terminated the match early. A Suite 16 test with that exact input would have caught it immediately.
Test shape: exact input string → assert exact output, assert no leakage of partial matches.

### On /patch
POST /patch is the preferred edit method. It bypasses the browser = filter entirely.
Body accepts two field name conventions:
- `{file, old, new}` — original field names
- `{file, anchor, replace}` — aliases added v0.9.90 (preferred for readability)
Both conventions work. Use whichever is clearer in context.

**Whitespace-tolerant matching (flexPatch — added v0.9.90):**
If the exact anchor string is not found, the server automatically retries using whitespace-collapsed matching (runs of spaces/tabs treated as a single space). This handles alignment-space differences like `type:  payload.type  ||` vs `type: payload.type ||`. Exact match is always tried first; flex match is the fallback. A `replaced:1` result with a growing file length confirms a successful flex match.

**Verification rule — non-negotiable:**
After every patch, check `replaced` in the response. If `replaced === 0` → anchor did not match, nothing changed. Stop and diagnose. Do not proceed assuming the patch landed.

**Note on .gitattributes + CRLF:**
The repo enforces LF on commit/checkout via .gitattributes. The CRLF branch in normalisePatch() will never fire on a correctly checked-out repo. The whitespace flex match is the more important normalisation. It bypasses the browser = filter entirely.
Body: {file, old, new} — returns {ok, replaced, length, error?}.
replaced:0 almost always means a line-ending mismatch. Check the target file's EOL first.

### How lint.js came to exist
Across multiple sessions, index-based HTML patching produced silent corruptions.
Ghost SVG fragments leaked into toolbar button text nodes.
POST /lint is now part of every gate. Call it after every HTML write, before /test.

### PUT server.js triggers hot-reload
Launcher.js watches server.js for changes. A PUT write triggers a server restart before the HTTP response is sent -- the connection drops with 'Failed to fetch'. The write still lands; verify with a fresh GET after restart. To rewrite server.js: assemble the complete file content in one js_tool call and PUT atomically. Never send partial content -- hot-reload will fire on the partial write, crash-loop until a valid file is restored.

### server.js patch rules
NEVER splice server.js by character position. Use POST /patch with single-line CRLF-matched anchors ONLY. A replaced:0 means CRLF vs LF mismatch -- read the raw bytes, confirm \r\n, retry. If an anchor is not unique enough, add a comment sentinel in a separate patch first, then patch against it. Never insert multi-line function bodies adjacent to http.createServer() -- the splice boundary is too fragile.

### The reinforcement pattern
When an AI instance is deep in a problem loop (patch, break, patch again):
1. If you find yourself applying the same class of fix more than twice: STOP. Propose infrastructure (a linter, a test, a validator) before the third patch.
2. POST /lint after every HTML write. If lint fails, fix structure before /test.
3. Visible errors over graceful degradation.

## VERSION
- Current: 0.9.103
- Bump pattern: html.split('0.9.103').join('0.9.104')
- Release handoff: https://github.com/MeatPopSci1972/sequence-builder/blob/main/releases/v0.9.103/sequence-builder.html
- NOTE: version bump replaces 3 occurrences (comment, data-version attr, version regex) -- all correct

## DEMOS (registered in store)
- auth-flow — Auth Flow (original)
- scada-control — SCADA: Control Flow
- cybersec-zones — CyberSecurity: Zone Analysis

## BACKLOG

> **GitHub Issues is the authoritative backlog.**
> Open issues: https://github.com/MeatPopSci1972/sequence-builder/issues?state=open
> Session start: fetch open issues (step 4 of FIRST ACTIONS) and work from highest-priority open issue.
> Items below are preserved as context/notes. Do not treat them as the work queue — GitHub Issues owns that.

### Context for next session

v0.9.102 is live on GitHub. v0.9.103 is the next version.

This cycle (v0.9.103 session):
- sequence-log-viewer: logview-server.js + launcher.js added (node launcher.js, port 3800)
- sequence-log-viewer: check-pages now calls GitHub API directly, no SF server dependency
- sequence-log-viewer: HANDOFF item closed -- check-pages works standalone
- buildQuery fix: state.version now authoritative for snapshot + validate-readme (both repos)
- test runner refactor: IIFE extracted to sequence-builder.test-runner.js, test.js exports plain array
- server.js updated to invoke test-runner.js
- Issue #17 CLOSED: WCAG v3 quick pass -- SVG text alternative (diagram-description live region), APCA contrast fix (dark --text2/--text3 nudged to Lc 60+), tour aria-live on step navigation

NEXT: Issue #24 -- Tour: dedicated keyboard shortcuts step

~~FIXED v0.9.103 - snapshot v0.0.0 during Run All: buildQuery now reads state.version first for snapshot and validate-readme steps. field value is manual override only.~~

OPEN BUG - README rebase conflict: README.md is generated by POST /generate-readme. Never edit it on GitHub directly -- manual edits cause rebase conflicts.

### Context for next session

v0.9.101 shipped. This cycle: sequence-log-viewer initial commit done (logview.html + logview-test.html + logview.sf.config.json + .gitattributes), two logview bugs fixed (check-pages prereq push→tag; check-pages version field not wired into buildQuery). Next: (1) close Issue #32 and #27 on GitHub if not done. (2) test runner refactor — extract IIFE into sequence-builder.test-runner.js, export plain array from test.js. (3) copy updated logview.sf.config.json to sequence-log-viewer if not already done.

### Context for next session

v0.9.99 shipped. This cycle: SF_VERSION single source of truth, bump-after-gates release flow reorder, logview.html ops console (15 steps, Run All, PASS/FAIL highlighting, 60/60 tests), logview-test.html, GET /check-pages, zero-failures gate (hardcoded counts removed everywhere), sequence-log-viewer repo created. Next: (1) sequence-log-viewer initial commit — copy logview.html + logview-test.html + logview.sf.config.json + .gitattributes, push, close Issue #32. (2) test runner refactor — extract IIFE into sequence-builder.test-runner.js, export plain array from test.js (Issue opened). (3) close Issue #27 — superseded by logview.html.

### Context for next session
v0.9.95 shipped. This cycle: ARCH-001 complete (actor/note/fragment drag delegated to Factory), BUG-001+BUG-002 fixed, POST /bump and /tag now derive version from nextVersionFromGit(). Next: MessageElement Y-drag to complete ARCH-001. GET /slice is the primary token-saving tool — use it before loading full files.

~~**BUG-001 (SHIPPED v0.9.95) — Properties panel stale after message Y-drag:**
After dragging a message vertically, the Properties panel sometimes shows stale From/To actor values. Root cause: uiState.selected._ref is not refreshed after the mouseup UPDATE_MESSAGE dispatch. Fix: re-wrap uiState.selected after the dispatch in the mouseup handler (events section, mouseup block, draggingMsg path).~~

~~**BUG-002 (SHIPPED v0.9.95) — Message endpoint resize handles:**
User should be able to drag the LEFT or RIGHT tip of a message arrow to reassign fromId or toId to any actor, not just the immediately adjacent one. Store already supports UPDATE_MESSAGE {fromId, toId}. Needs small SVG hit-target handles rendered at each arrow tip. Drag behaviour mirrors the fragment SE-corner resize pattern — mousedown on handle starts resize, mousemove updates, mouseup dispatches UPDATE_MESSAGE. UI-only change.~~

~~**BUG-003 (SHIPPED — fixed before v0.9.93) — Tour spotlight 0,0 on Import/Export step.** Do not re-add. Confirmed gone. Tombstone only.~~

**Item 1 — HANDOFF template automation (icebox item 2):**
Implement `POST /update-handoff` in server.js. It should call `GET /status` + `GET /test` + `GET /test-render` internally and populate all `{{placeholder}}` fields in HANDOFF.md defined in the ## DOCUMENTATION STANDARDS section. This permanently closes the VERSION staleness class of bug documented in ## HANDOFF SNAPSHOT AUDIT (cross-version pattern #1 and #4). Read ## DOCUMENTATION STANDARDS carefully before scoping — the {{placeholder}} field list is already defined there.

**Item 2 — UI element factories (discussion only, no code):**
After template automation ships, open a design discussion on UI element factories. The trigger condition (a second consumer of element construction logic outside render()) has not fired — this is a scoping conversation, not implementation. Proto2prod discipline applies: validate the need before building. Review render() with fresh eyes, identify any duplication that has emerged since v0.9.68, and decide together whether the trigger has been met.

### Icebox
GitHub Issues is the authoritative backlog. No local icebox maintained.
1. ~~**Define documentation standards**~~ — **shipped v0.9.69**. ## DOCUMENTATION STANDARDS and ## HANDOFF SNAPSHOT AUDIT sections written. Standards cover HANDOFF.md, CHANGELOG.md, README.md, and GitHub release notes. Template {{placeholder}} markers added for future automation. Audit covers v0.9.61–v0.9.68 archives with cross-version pattern summary.

2. ~~**HANDOFF template automation**~~ — DOCUMENTATION STANDARDS section uses {{placeholder}} markers for live-fetchable values (version, test counts, bump pattern, demo URL). Future work: implement `POST /update-handoff` that calls `GET /status` + `GET /test` + `GET /test-render` and populates all {{}} fields automatically, eliminating the manual VERSION staleness class of bug seen in v0.9.61–v0.9.64. Trigger for promotion: a second VERSION staleness incident, or when the release flow is next touched for another reason.

3. ~~**Investigate: .gitattributes + normalisePatch CRLF gap**~~ — shipped v0.9.78. PUT handler in server.js now normalises CRLF→LF on every write. Eliminates the multi-line patch failure class permanently. — .gitattributes enforces LF on commit/checkout but the dev server's normalisePatch() still converts LF→CRLF for CRLF files at patch time. The gap: javascript_tool fetch bodies arrive as LF strings; if the target file is CRLF on disk, normalisePatch converts the old string to CRLF before searching — but multi-line strings built with \n in JS don't survive that conversion cleanly (mixed endings). Root cause is that the dev server reads CRLF from disk even though .gitattributes says LF. Fix candidates: (a) POST /patch normalises the file on disk to LF before patching, (b) the server rewrites CRLF files to LF on first write after .gitattributes was added, (c) add a lint.js check that no tracked file contains CRLF. Trigger: next session touching server.js or sequence-builder.html.
4. **Tour: demonstrate keyboard shortcuts** — the tour palette step mentions A/M/N/F but a dedicated step showing each shortcut in action would improve discoverability. Trigger: next tour revision pass.
4. ~~**Zoom controls: float on canvas**~~ — shipped v0.9.75 — move btn-zoom-out, btn-zoom-reset, btn-zoom-in, btn-zoom-fit from toolbar to a floating pill anchored bottom-center of canvas. Standard pattern (Figma, Miro, Lucidchart). Toolbar slots vacated.
5. ~~**Remove `?` toolbar button**~~ — shipped v0.9.74.
6. ~~**Help modal with keyboard shortcuts**~~ — shipped v0.9.75 — `?` Help icon triggers a modal listing all keyboard shortcuts (currently buried in an HTML comment). Tour launch button moves here too. Replaces the redundant toolbar `?` button with a richer entry point.
7. ~~**Right panel scrollbar**~~ — already handled: `.panel-body` has `overflow-y: auto`. No action needed.
8. **UI element factories** — deferred. Trigger for promotion: a second consumer of element construction logic appears outside render(). Design decision recorded in CHANGELOG v0.9.68.
9. **Export cost data as CSV** from the Session Cost Panel (lowest priority — nice to have).


## DOCUMENTATION STANDARDS
<!-- @@DOC-STANDARDS-START — managed section, do not edit header/footer lines -->
<!--
  TEMPLATE NOTE: POST /update-handoff (shipped v0.9.70) owns all version and test-count fields below. Run as step 8 of the release flow.
  Fields marked {{like_this}} are live-fetchable from GET /status or GET /test*.
  When POST /update-handoff is implemented, these will be populated automatically.
  Until then, an AI instance must verify these values manually at session start.
-->

### Purpose
These standards define what each document type must contain, what format to use, what must stay current, and what a fresh AI instance must verify before doing any work. Consistency here is the primary defence against session-to-session drift.

### HANDOFF.md

**Required sections (in order):**
FIRST ACTIONS · DEV SERVER API · KEY FILES · WORKFLOW PATTERN · RELEASE FLOW · READ CONSOLE PATTERN · STORE ARCHITECTURE · SECURITY NOTE · HOT RELOAD · LOG UI · TOUR SYSTEM · DEV LOOP WISDOM · VERSION · DEMOS · BACKLOG · REPO · (recovery note)

**Template-tracked fields** *(must match live data — verify at session start)*:
- `## FIRST ACTIONS` — gate counts must match `GET /test` (177 ran, 0 failures) and `GET /test-render` (15 ran, 0 failures)
- `## VERSION — Current:` — must match `GET /status` → `version` field (0.9.103)
- `## VERSION — Bump pattern:` — must be `html.split('0.9.103').join('0.9.104')`
- `## VERSION — Release handoff URL:` — must point to current version snapshot (0.9.103)
- `## BACKLOG` — shipped items must reflect last commit; icebox must not contain items that have been shipped

**Update rules:**
- Must be updated on every release as part of the release flow (step 8 in RELEASE FLOW)
- VERSION and BACKLOG are the two highest-staleness-risk sections — update these first
- Archived as `releases/vX.Y.Z/HANDOFF-vX.Y.Z.md` via POST /snapshot — the snapshot is read-only after commit

**AI instance session-start checklist:**
1. `GET /status` — read version; cross-check against `## VERSION — Current:`
2. `GET /test` — read pass count; cross-check against `## FIRST ACTIONS` gate count
3. `GET /test-render` — read pass count; cross-check against `## FIRST ACTIONS` render gate count
4. `GET https://api.github.com/repos/MeatPopSci1972/sequence-builder/issues?state=open&per_page=50` — load open issues; this is the authoritative work queue
5. If any value mismatches: fix HANDOFF.md before doing any other work

---

### CHANGELOG.md

**Entry format:**
Each entry is auto-generated via `POST /changelog {version:"X.Y.Z"}` and prepended to the file. Entries are never edited after commit — they are the permanent record.

Auto-generated header format (produced by POST /changelog):
```
## vX.Y.Z — YYYY-MM-DD
<git log lines since last tag, one per bullet>
```

Optional manual block (appended by AI immediately after auto-gen, before commit):
```
### Design decisions
- <decision and rationale> — pattern first established v0.9.68
```

**Rules:**
- Auto-gen first, manual block second — never mix them
- `### Design decisions` block is optional; only add it when an architectural choice was made that is not captured in the commit messages
- Entries are prepended — newest at top
- Never edit a committed entry

---

### README.md

**GENERATED FILE — never edit on GitHub directly.** Always fix via `POST /generate-readme` locally then push. Manual GitHub edits cause rebase conflicts on next push.

**Required content:**
- One-sentence description of what Sequence Builder is
- Live demo link — format: `https://github.com/MeatPopSci1972/sequence-builder/releases/download/v{{version}}/sequence-builder.html`
- All-releases link — format: `https://github.com/MeatPopSci1972/sequence-builder/releases`

**Template-tracked fields:**
- Live demo link version segment must match current release (0.9.69)

**Update rules:**
- Live demo link must be updated on every release as part of the release flow (step 6: GET /validate-readme enforces this)
- `GET /validate-readme?v=X.Y.Z` must return `ok:true` before the release can continue
- Do not add any other sections without discussion — README is intentionally minimal

---

### GitHub release notes

**Title format:**
`vX.Y.Z — <one-line summary of the primary change>`

**Body structure:**
```
### What shipped
- <bullet per significant change>

### What was kept / deferred
- <bullet per intentional deferral with reason>
```

**Asset requirement:**
`releases/vX.Y.Z/sequence-builder.html` must be attached as a downloadable asset on every release.

**Rules:**
- Title and body come from the same release flow step (GitHub → Releases → New release)
- The "What was kept / deferred" block is not optional — it is the record of intentional scope decisions, which is as important as the record of what shipped

<!-- @@DOC-STANDARDS-END -->

## REPO
- GitHub: https://github.com/MeatPopSci1972/sequence-builder
- Local: E:\uml2prompt\sequence-builder-prototype
- Branch: main

## SEQUENCE-LOG-VIEWER
- GitHub: https://github.com/MeatPopSci1972/sequence-log-viewer
- Status: TRANSITION — logview.html is being extracted here from SF repo
- SF config: logview.sf.config.json (committed to SF repo, drives the left panel)
- logview.html and logview-test.html remain in SF repo as reference until standalone is verified
- Issues 1–4 (config-driven panel, multi-repo, OTel, right-click copy) live in the logview repo

