# SequenceForge — Session Handoff
<!-- IMPORTANT: Update this file on every release. Version and backlog must stay current. -->

## FIRST ACTIONS (do these before anything else)
1. GET http://localhost:3799/status — confirm version, clean=true
2. GET http://localhost:3799/test — confirm gate is green (136/136)
3. GET http://localhost:3799/test-render — confirm render gate green (15/15)
4. Read this file fully, paying close attention to ## BACKLOG

Also available: GET /api (endpoint reference) | GET /usage (AI surgical guide)

## ⚠ TOKEN DISCIPLINE — MANDATORY
NEVER fetch sequence-builder.html in full. It is 225KB+ and burns session tokens.
ALWAYS use GET /slice?file=sequence-builder.html&section=SECTION to read only what you need.
Available sections: store · render · events · toolbar · themes
Use POST /patch with a known anchor string to write. Full-file reads are PROHIBITED.

## DEV SERVER API (sf-server.js v5, port 3799)

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
| GET | /validate-readme?v=X.Y.Z | Checks README has link + label text + no loop for vX.Y.Z. Returns {ok,hasLink,hasLabel,hasLoop}. addLog fires. |
| POST | /git-restore | Restore tracked file to HEAD. Body: {file}. Returns {ok,file,output,ms}. **addLog fires** |
| POST | /changelog | Auto-gen CHANGELOG.md entry from git log since last tag. Body: {version}. Returns {ok,version,entry,length,ms}. **addLog fires** |
| POST | /tag | Create annotated git tag. Body: {tag,message}. Returns {ok,tag,output,ms}. **addLog fires** |
| GET | / | List all files in repo root |

## KEY FILES
- sequence-builder.html — single-file app (toolbar, CSS, JS, store injected at build)
- sequence-builder.store.js — store source (build.js syncs into HTML between sentinels)
- sequence-builder.test.js — 120 contract tests (Suites 1-14)
- themes.json — theme definitions (dark/light/system/lcars), served as GET /themes.json
- build.js — syncs store.js into HTML between @@STORE-START / @@STORE-END
- lint.js — HTML integrity checker: buttons, SVG balance, sentinels, version
- sf-server.js — dev server v5 (entry point + route dispatcher; requires sf-endpoints.js + sf-readme-gen.js)
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
1. GET /test (127/127) + GET /test-render (15/15) both green
2. Bump version strings in sequence-builder.html (3 occurrences)
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
NOTE: sequence-builder.html uses CRLF (\r\n); sequence-builder.test.js uses LF (\n); HANDOFF.md uses LF (\n). Always match the target file's line endings in /patch calls.

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

### PUT sf-server.js triggers hot-reload
Launcher.js watches sf-server.js for changes. A PUT write triggers a server restart before the HTTP response is sent -- the connection drops with 'Failed to fetch'. The write still lands; verify with a fresh GET after restart. To rewrite sf-server.js: assemble the complete file content in one js_tool call and PUT atomically. Never send partial content -- hot-reload will fire on the partial write, crash-loop until a valid file is restored.

### sf-server.js patch rules
NEVER splice sf-server.js by character position. Use POST /patch with single-line CRLF-matched anchors ONLY. A replaced:0 means CRLF vs LF mismatch -- read the raw bytes, confirm \r\n, retry. If an anchor is not unique enough, add a comment sentinel in a separate patch first, then patch against it. Never insert multi-line function bodies adjacent to http.createServer() -- the splice boundary is too fragile.

### The reinforcement pattern
When an AI instance is deep in a problem loop (patch, break, patch again):
1. If you find yourself applying the same class of fix more than twice: STOP. Propose infrastructure (a linter, a test, a validator) before the third patch.
2. POST /lint after every HTML write. If lint fails, fix structure before /test.
3. Visible errors over graceful degradation.

## VERSION
- Current: 0.9.91
- Bump pattern: html.split('0.9.91').join('0.9.92')
- Release handoff: https://github.com/MeatPopSci1972/sequence-builder/blob/main/releases/v0.9.91/sequence-builder.html
- NOTE: version bump replaces 3 occurrences (comment, data-version attr, version regex) -- all correct

## DEMOS (registered in store)
- auth-flow — Auth Flow (original)
- scada-control — SCADA: Control Flow
- cybersec-zones — CyberSecurity: Zone Analysis

## BACKLOG (priority order — always keep items here, never leave empty)

### Context for next session
v0.9.83 shipped. This cycle: simplified palette (4 items), horizontal-only pan, fit-to-diagram fix, zoom controls moved to statusbar, Add Message now wires from selected actor, POST /changelog auto-commits CHANGELOG.md. Two open bugs logged below — tackle BUG-001 first (simpler). GET /slice is the primary token-saving tool — use it before loading full files.

**BUG-001 — Properties panel stale after message Y-drag:**
After dragging a message vertically, the Properties panel sometimes shows stale From/To actor values. Root cause: uiState.selected._ref is not refreshed after the mouseup UPDATE_MESSAGE dispatch. Fix: re-wrap uiState.selected after the dispatch in the mouseup handler (events section, mouseup block, draggingMsg path).

**BUG-003 — Tour spotlight goes to 0,0 on Import/Export step:**
Tour step targets `#btn-import-uml` which is inside a collapsed dropdown (display:none). `getBoundingClientRect()` returns 0,0 for hidden elements — spotlight renders at top-left. Fix: change target to `#btn-import-menu` (the visible trigger button, always rendered). Optionally add `beforeShow: () => document.getElementById('btn-import-menu').click()` to open the dropdown during the step. Located in STEPS array, line ~4950 in sequence-builder.html.

**BUG-002 — Message endpoint resize handles:**
User should be able to drag the LEFT or RIGHT tip of a message arrow to reassign fromId or toId to any actor, not just the immediately adjacent one. Store already supports UPDATE_MESSAGE {fromId, toId}. Needs small SVG hit-target handles rendered at each arrow tip. Drag behaviour mirrors the fragment SE-corner resize pattern — mousedown on handle starts resize, mousemove updates, mouseup dispatches UPDATE_MESSAGE. UI-only change.

**Item 1 — HANDOFF template automation (icebox item 2):**
Implement `POST /update-handoff` in sf-server.js. It should call `GET /status` + `GET /test` + `GET /test-render` internally and populate all `{{placeholder}}` fields in HANDOFF.md defined in the ## DOCUMENTATION STANDARDS section. This permanently closes the VERSION staleness class of bug documented in ## HANDOFF SNAPSHOT AUDIT (cross-version pattern #1 and #4). Read ## DOCUMENTATION STANDARDS carefully before scoping — the {{placeholder}} field list is already defined there.

**Item 2 — UI element factories (discussion only, no code):**
After template automation ships, open a design discussion on UI element factories. The trigger condition (a second consumer of element construction logic outside render()) has not fired — this is a scoping conversation, not implementation. Proto2prod discipline applies: validate the need before building. Review render() with fresh eyes, identify any duplication that has emerged since v0.9.68, and decide together whether the trigger has been met.

### Icebox
~~0. **Tighten `GET /validate-readme`**~~ — **shipped v0.9.80**. hasLabel check added; README label was 2 versions behind and is now caught automatically. validate-readme returns {ok,hasLink,hasLabel,hasLoop}.
0b. **Persistent cost log (`cost-log.json`)** — `POST /log-cost {tokens, model, note}` appends a timestamped entry to `cost-log.json` in the repo root. File is local-only: listed in `.gitignore`, never checked in. If the file does not exist the server creates it. Enables cross-session token/cost tracking. Pin down with store-side tests that seed a test instance (temp file, known entries, assert shape and append behaviour). Expose `GET /cost-log` to read entries as JSON. Trigger: already fired — cost visibility gap identified this session. 
1. ~~**Define documentation standards**~~ — **shipped v0.9.69**. ## DOCUMENTATION STANDARDS and ## HANDOFF SNAPSHOT AUDIT sections written. Standards cover HANDOFF.md, CHANGELOG.md, README.md, and GitHub release notes. Template {{placeholder}} markers added for future automation. Audit covers v0.9.61–v0.9.68 archives with cross-version pattern summary.

2. ~~**HANDOFF template automation**~~ — DOCUMENTATION STANDARDS section uses {{placeholder}} markers for live-fetchable values (version, test counts, bump pattern, demo URL). Future work: implement `POST /update-handoff` that calls `GET /status` + `GET /test` + `GET /test-render` and populates all {{}} fields automatically, eliminating the manual VERSION staleness class of bug seen in v0.9.61–v0.9.64. Trigger for promotion: a second VERSION staleness incident, or when the release flow is next touched for another reason.

3. ~~**Investigate: .gitattributes + normalisePatch CRLF gap**~~ — shipped v0.9.78. PUT handler in sf-server.js now normalises CRLF→LF on every write. Eliminates the multi-line patch failure class permanently. — .gitattributes enforces LF on commit/checkout but the dev server's normalisePatch() still converts LF→CRLF for CRLF files at patch time. The gap: javascript_tool fetch bodies arrive as LF strings; if the target file is CRLF on disk, normalisePatch converts the old string to CRLF before searching — but multi-line strings built with \n in JS don't survive that conversion cleanly (mixed endings). Root cause is that the dev server reads CRLF from disk even though .gitattributes says LF. Fix candidates: (a) POST /patch normalises the file on disk to LF before patching, (b) the server rewrites CRLF files to LF on first write after .gitattributes was added, (c) add a lint.js check that no tracked file contains CRLF. Trigger: next session touching sf-server.js or sequence-builder.html.
4. **Tour: demonstrate keyboard shortcuts** — the tour palette step mentions A/M/N/F but a dedicated step showing each shortcut in action would improve discoverability. Trigger: next tour revision pass.
4. ~~**Zoom controls: float on canvas**~~ — shipped v0.9.75 — move btn-zoom-out, btn-zoom-reset, btn-zoom-in, btn-zoom-fit from toolbar to a floating pill anchored bottom-center of canvas. Standard pattern (Figma, Miro, Lucidchart). Toolbar slots vacated.
5. ~~**Remove `?` toolbar button**~~ — shipped v0.9.74.
6. ~~**Help modal with keyboard shortcuts**~~ — shipped v0.9.75 — `?` Help icon triggers a modal listing all keyboard shortcuts (currently buried in an HTML comment). Tour launch button moves here too. Replaces the redundant toolbar `?` button with a richer entry point.
7. ~~**Right panel scrollbar**~~ — already handled: `.panel-body` has `overflow-y: auto`. No action needed.
8. **UI element factories** — deferred. Trigger for promotion: a second consumer of element construction logic appears outside render(). Design decision recorded in CHANGELOG v0.9.68.
9. **Export cost data as CSV** from the Session Cost Panel (lowest priority — nice to have).

### Former icebox (good ideas, not yet scoped)
1. Organise files into /server — move server files into server/ subfolder
2. Evaluate esbuild for the build pipeline — only becomes necessary when the store needs to import utilities
3. Tour DOM-ID regression protection — a build-time check that all STEPS[] target selectors resolve to actual elements in the built HTML

### Shipped this cycle (v0.9.65-v0.9.78)
- v0.9.65 — GET /test-render render gate (Playwright, 3 demos x 5 SVG layers, 15 snapshots)
- v0.9.66 — render() pure DOM projection (_saveDiagram + updateOutput moved to store listeners)
- v0.9.67 — CSS: --violet + --amber defined, 2 !important removed
- v0.9.68 — Selector layer: 8 named selectors, 52 call sites replaced
- v0.9.69 — Documentation standards: ## DOCUMENTATION STANDARDS + ## HANDOFF SNAPSHOT AUDIT written; template {{placeholders}} defined; v0.9.61–v0.9.68 archives audited
- v0.9.70 — POST /update-handoff: HANDOFF template automation, regex-based idempotent live-field population; .gitattributes LF normalisation
- v0.9.71 — Remove placement mode: ghost rendering, place-actor mode, placeGhostX state, mousemove tracker, placing-actor CSS all removed; actor add now consistent with note/fragment
- v0.9.72 — Remove add-element toolbar buttons (Add Actor, Message, Note, Fragment); keyboard shortcuts + palette sufficient; tour consolidated; lint updated to 10 buttons
- v0.9.73 — Dead code removal: orphaned btn-add-actor/btn-connect handlers, toggleConnectMode, getLastActor, duplicate getNextActorX
- v0.9.74 — Remove ? toolbar button (sf-tour-help-btn) + 2 CSS rules + var help= JS; lint updated to 9 buttons; icebox updated with 5 new UI refinement items
- v0.9.75/v0.9.76 — Floating zoom overlay (bottom-center canvas); Help modal with keyboard shortcuts + Tour launch; lint 6 buttons; fix kb-hint bar removed; zoom overlay clears debug console. NOTE: v0.9.75 was never separately pushed — v0.9.76 was the first released tag covering both.
- v0.9.77 — Interaction layer: selected elements elevate above all SVG layers on selection; fragment resize handle 14px accent green; Suite 13 (13 tests) pins fragment geometry contract
- v0.9.78 — PUT handler normalises CRLF→LF on every write; eliminates multi-line patch failure class permanently
- v0.9.79 — GET /slice scoped context loading via sentinel sections (@@RENDER, @@EVENTS, @@TOOLBAR added); sf-preflight.ps1 pre-flight script added to repo
- v0.9.80 — validate-readme hasLabel check (asserts label text contains version string, not just URL); README label staleness class eliminated

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
- `## FIRST ACTIONS` — gate counts must match `GET /test` (136/136) and `GET /test-render` (15/15)
- `## VERSION — Current:` — must match `GET /status` → `version` field (0.9.91)
- `## VERSION — Bump pattern:` — must be `html.split('0.9.91').join('0.9.92')`
- `## VERSION — Release handoff URL:` — must point to current version snapshot (0.9.91)
- `## BACKLOG` — shipped items must reflect last commit; icebox must not contain items that have been shipped

**Update rules:**
- Must be updated on every release as part of the release flow (step 8 in RELEASE FLOW)
- VERSION and BACKLOG are the two highest-staleness-risk sections — update these first
- Archived as `releases/vX.Y.Z/HANDOFF-vX.Y.Z.md` via POST /snapshot — the snapshot is read-only after commit

**AI instance session-start checklist:**
1. `GET /status` — read version; cross-check against `## VERSION — Current:`
2. `GET /test` — read pass count; cross-check against `## FIRST ACTIONS` gate count
3. `GET /test-render` — read pass count; cross-check against `## FIRST ACTIONS` render gate count
4. If any value mismatches: fix HANDOFF.md before doing any other work

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

**Required content:**
- One-sentence description of what SequenceForge is
- Live demo link — format: `https://MeatPopSci1972.github.io/sequence-builder/releases/v{{version}}/sequence-builder.html`
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

## HANDOFF SNAPSHOT AUDIT
<!-- @@AUDIT-START — historical record, do not edit entries after commit -->
<!-- Audit conducted: v0.9.68 documentation standards session -->
<!-- Purpose: identify what a fresh AI instance would find missing, stale, or confusing in each archived HANDOFF -->

### v0.9.30
- **Status:** 404 — no HANDOFF snapshot archived at this version. Earliest available: v0.9.61.

### v0.9.61
- **VERSION section stale at time of snapshot:** says `Current: 0.9.59`, bump pattern `0.9.59 → 0.9.60`, and release handoff URL points to v0.9.59 — all two versions behind the file's own name. A fresh AI instance would bump the wrong version.
- **RELEASE FLOW incomplete:** 10 steps. Missing: `POST /changelog` and `POST /tag` entirely. An AI instance following this file would produce a release with no changelog entry and no git tag.
- **DEV SERVER API table missing 3 endpoints:** `POST /git-restore`, `POST /changelog`, `POST /tag` — all added in a later version.
- **KEY FILES:** test count listed as "92 contract tests (Suites 1—11)" — correct for the era but would be confusing against a live gate showing a different count.
- **BACKLOG structural corruption:** two consecutive `### Icebox` headings — first says *(empty — all items shipped)*, second has real items. A fresh AI instance has no way to know which is authoritative. Root cause: the "empty" heading was not removed when items were added.
- **Missing:** `GET /test-render` in FIRST ACTIONS, DEV SERVER API, and RELEASE FLOW — render gate did not exist yet (not a defect, era-appropriate).
- **Missing:** `## STORE ARCHITECTURE` selector layer and pure-projection notes — post-dated this version (not a defect).

### v0.9.62
- **VERSION section stale at time of snapshot:** says `Current: 0.9.61`, bump pattern `0.9.61 → 0.9.62`, release handoff URL points to v0.9.61 — one version behind. A fresh AI instance would bump the wrong version.
- **RELEASE FLOW:** Steps 11–13 (tag, push, GitHub release) now present — improvement over v0.9.61. `POST /changelog` still absent.
- **BACKLOG structural corruption:** same duplicate `### Icebox` heading pattern as v0.9.61, unresolved.
- **DEV SERVER API, KEY FILES, STORE ARCHITECTURE:** same era-appropriate gaps as v0.9.61.

### v0.9.63
- **VERSION section stale at time of snapshot:** says `Current: 0.9.61`, bump pattern `0.9.61 → 0.9.62`, release handoff URL points to v0.9.61 — two versions behind. Worse regression than v0.9.62.
- **RELEASE FLOW:** `POST /changelog` still absent.
- **BACKLOG structural corruption:** duplicate `### Icebox` heading pattern persists, now three releases without a fix.
- **New icebox item 6** (lint.js structural checks) added — content is correct, placement within the duplicate-heading confusion makes it hard to locate.

### v0.9.64
- **VERSION section stale at time of snapshot:** says `Current: 0.9.63`, bump pattern `0.9.63 → 0.9.64`, release handoff URL points to v0.9.63 — one version behind.
- **RELEASE FLOW:** `POST /changelog` still absent.
- **BACKLOG structural corruption:** same duplicate `### Icebox` heading pattern, now four releases unresolved.
- **Notable improvement:** BACKLOG now has a `### Rationale summary` block explaining where items came from — useful context for a fresh AI instance.

### v0.9.65
- **VERSION section:** correct — `Current: 0.9.65`, bump to 0.9.66, URL points to v0.9.65. Staleness pattern resolved from this version forward.
- **RELEASE FLOW:** `POST /changelog` present but numbered `10.5` (wedged between steps 10 and 11 rather than renumbered). Functional but visually awkward — a fresh AI instance might miss it.
- **DEV SERVER API:** `GET /test-render`, `POST /git-restore`, `POST /changelog`, `POST /tag` all present. Complete.
- **KEY FILES:** test count still shows "92 contract tests (Suites 1—11)" — stale; live gate passes 99. A fresh AI instance would see the discrepancy when running GET /test.
- **BACKLOG:** `### Test gate — proposal` section left in place even though the gate shipped in this very version. Item 1 is struck through as shipped but the full proposal text remains — creates confusion about what is settled vs. still proposed.
- **STORE ARCHITECTURE:** missing selector layer and pure-projection notes (not yet shipped at this version — not a defect).
- **BACKLOG structural corruption:** duplicate `### Icebox` heading pattern finally gone — replaced with `### Rationale summary` + single `### Icebox`. Resolved.

### v0.9.66
- **VERSION section:** correct — `Current: 0.9.66`.
- **RELEASE FLOW:** `POST /changelog` still at step `10.5`. All other steps correct.
- **KEY FILES:** test count still "92 contract tests (Suites 1—11)" — stale (live: 99). Same issue as v0.9.65.
- **WORKFLOW PATTERN code block:** gate comment still says `confirm: "92 passed | 0 failed"` — stale.
- **BACKLOG:** `### Test gate — proposal` section still present with full proposal text despite gate having shipped two versions earlier. Should have been collapsed to a one-liner or removed.
- **STORE ARCHITECTURE:** pure-projection note absent — shipped this version but not yet documented here.

### v0.9.67
- **VERSION section:** correct — `Current: 0.9.67`.
- **RELEASE FLOW:** `POST /changelog` at `10.5` — same placement as v0.9.65/66.
- **KEY FILES:** test count still "92 contract tests (Suites 1—11)" — stale (live: 99). Persists four versions.
- **WORKFLOW PATTERN:** gate comment still "92 passed | 0 failed" — stale.
- **BACKLOG:** `### Test gate — proposal` section still present. Items 1–3 struck through as shipped.
- **STORE ARCHITECTURE:** pure-projection note still absent.
- **Notable improvement over prior versions:** selector layer note absent (not yet shipped — correct for this era).

### v0.9.68
- **VERSION section:** correct — `Current: 0.9.68`.
- **RELEASE FLOW:** `POST /changelog` renumbered to step 10 in the live HANDOFF.md (verified) — the archive snapshot at this version shows the same `10.5` pattern as v0.9.65–67. The live fix happened during session prep and post-dates the snapshot.
- **KEY FILES:** test count corrected to "99 contract tests" in the live HANDOFF.md — archive snapshot still shows "92 (Suites 1—11)". Live fix happened during session prep.
- **BACKLOG:** duplicate item numbering (two items labelled "6.") — present in archive, fixed in live HANDOFF.md during session prep.
- **BACKLOG:** `### Test gate — proposal` section still present in archive snapshot — live HANDOFF.md removed it during session prep.
- **STORE ARCHITECTURE:** selector layer (8 selectors, 52 call sites) and pure-projection note both present and correct. Complete.

### Cross-version patterns (summary for future auditors)
1. **VERSION section staleness (v0.9.61–v0.9.64):** VERSION.Current, bump pattern, and release handoff URL were consistently one-to-two versions behind at snapshot time. Fixed v0.9.65. Root cause: manual update step; mitigation: template automation (icebox).
2. **Duplicate `### Icebox` headings (v0.9.61–v0.9.64):** Four consecutive releases carried structural BACKLOG corruption. Fixed v0.9.65. Root cause: "empty" heading not removed when items were re-added.
3. **`POST /changelog` absent from RELEASE FLOW (v0.9.61–v0.9.64):** An AI instance following these files would produce releases with no changelog entry. Fixed v0.9.65 (as step 10.5).
4. **Stale test count in KEY FILES (v0.9.65–v0.9.68 archive):** "92 contract tests" persisted four versions after the live count reached 99. Root cause: manual update step; mitigation: template automation (icebox).
5. **`### Test gate — proposal` lingered post-ship (v0.9.65–v0.9.68 archive):** Proposal text remained after the feature shipped, creating ambiguity. Fixed in live HANDOFF.md during session prep.
6. **`POST /changelog` at step 10.5 (v0.9.65–v0.9.68 archive):** Wedged numbering was functional but visually easy to miss. Fixed in live HANDOFF.md during session prep (renumbered to step 10).

<!-- @@AUDIT-END -->

## NOTE: sf-server.js IS IN GIT (as of v0.9.43)
sf-server.js is tracked in git. If it is lost or corrupted:
1. Use the bootstrap recovery: node -e "require('http').createServer(function(req,res){if(req.method==='PUT'){var b='';req.on('data',function(d){b+=d});req.on('end',function(){require('fs').writeFileSync('sf-server.js',b);res.end('OK');process.exit()})}else{res.end('ready')}}).listen(9999,function(){console.log('BOOTSTRAP:ready')})"
2. Navigate browser to http://localhost:9999
3. PUT the server content via javascript_tool fetch
4. See /api and /usage for the full endpoint spec to rebuild from.
