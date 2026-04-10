# SequenceForge Changelog

## v0.9.101 — v0.9.101
_2026-04-10_

### Features
- v0.9.101

### Fixes
- check-pages prereq 'push'→'tag' — terminal-only steps never reach done, tag is the correct gate

### Chores
- HANDOFF

---

## v0.9.100 — v0.9.100
_2026-04-10_

### Features
- v0.9.100
- GET /check-pages — verify GitHub Pages live after push; step 15 in logview runner; HANDOFF + endpoints updated

### Fixes
- update-handoff reads SF_VERSION constant — last remaining SequenceForge v pattern removed

### Chores
- HANDOFF
- logview.sf.config.json — correct step order (build→lint→bump), add check-pages step 15
- HANDOFF v0.9.99 — context for next session
- zero-failures gate — remove hardcoded test counts from preflight, logview, HANDOFF, sf-server update-handoff; add Suite 16 server scan tests
- snapshot v0.9.99 — releases/v0.9.99/ written with correct SF_VERSION

---

## v0.9.99 — v0.9.99
_2026-04-09_

### Features
- v0.9.99

### Fixes
- revert README/sf-readme-gen/HANDOFF to github.io URL — releases/download forced download, github.io is correct and works once pushed
- README live demo link — github.io → releases/download URL (was 404); fix sf-readme-gen.js + HANDOFF template

### Chores
- HANDOFF

---

## v0.9.98 — v0.9.98
_2026-04-09_

### Features
- v0.9.98
- logview.html — PASS/FAIL log highlighting, Run All sequential runner
- logview.html — split-pane ops console, release runner + live log feed

### Fixes
- logview — logHighlight fail-first, :false catch, syntaxHL no pre-escape; logview-test 60/60 green
- logview.html — always refresh version fields from state after bump, not only when empty
- logview.html — parse HTML response from GET /test, show actual pass count

### Chores
- fix .gitignore — scope json/txt ignores to scratch/temp patterns; track logview.sf.config.json
- renormalize all files to LF per updates to .getattributes
- remove sequence-log-viewer.gitattributes — copied to new repo, no longer needed here
- improve .gitattributes (LF, binaries, export-ignore, diff drivers); add sequence-log-viewer.gitattributes for new repo
- transition — logview.sf.config.json, logview.html note, HANDOFF ref to sequence-log-viewer
- CHANGELOG
- HANDOFF
- add BUG-003 tombstone to HANDOFF.md — prevent resurrection
- remove stale BUG-003 from HANDOFF.md (fixed long ago)
- HANDOFF.md — update to v0.9.97, drop local icebox (GitHub Issues is authoritative), fix hot-reload note and test count

---

## v0.9.97 — logview.html — PASS/FAIL log highlighting, Run All sequential runner
_2026-04-09_

### Features
- logview.html — PASS/FAIL log highlighting, Run All sequential runner
- logview.html — split-pane ops console, release runner + live log feed

### Fixes
- logview.html — parse HTML response from GET /test, show actual pass count

### Chores
- HANDOFF
- add BUG-003 tombstone to HANDOFF.md — prevent resurrection
- remove stale BUG-003 from HANDOFF.md (fixed long ago)
- HANDOFF.md — update to v0.9.97, drop local icebox (GitHub Issues is authoritative), fix hot-reload note and test count

---

## v0.9.97 — release v0.9.97 — bump guard, slice normalizeWS, launcher watch coverage
_2026-04-08_

### Features
- release v0.9.97 — bump guard, slice normalizeWS, launcher watch coverage

### Fixes
- launcher.js watches sf-readme-gen.js + sf-endpoints.js for hot-reload (closes #26)
- wire normalizeWS() into /slice sentinel search — whitespace-tolerant section lookup (closes #20)
- POST /bump idempotency guard — alreadyBumped:true if HTML already at target version (closes #21)
- GET /status version regex — match "Version: X.Y.Z" comment in HTML
- clean repo — gitignore scratch files, remove extension filter, clean README (#25)
- README gen — setGroup() feature groups, filter scratch files, live test count (#25)
- update sf-preflight.ps1 expected test count 156→170

### Chores
- removed tracked scratch files, issue #11
- HANDOFF note sf-preflight count must match on release

---

## v0.9.96 — MessageElement Y-drag — complete ARCH-001 (#19)
_2026-04-07_

### Features
- MessageElement Y-drag — complete ARCH-001 (#19)

### Fixes
- version always derived from git tags — nextVersionFromGit() replaces readVersionFromHTML()

### Chores
- wire GitHub Issues as authoritative backlog in HANDOFF
- HANDOFF — v0.9.95 backlog updated, BUG-001/002 shipped, new icebox items, /bump in API table
- CHANGELOG

---

## v0.9.95 — BUG-002 — message endpoint drag handles, reassign fromId/toId by dragging arrow tip (170/170, 15/15)
_2026-04-07_

### Features
- BUG-002 — message endpoint drag handles, reassign fromId/toId by dragging arrow tip (170/170, 15/15)
- ARCH-001 complete — actor, note, fragment drag delegated to Factory (170/170, 15/15)
- ARCH-001 canvas dispatcher live — actor drag delegated to ActorElement via ElementFactory (170/170, 15/15)
- ARCH-001 actor drag delegated to ActorElement, InteractionContext injected (170 passing)
- ARCH-001 MessageElement, NoteElement, FragmentElement stubs + 14 contract tests (170 passing)
- ULID element IDs, ARCH-001 factory scaffold, two-phase test runner

### Fixes
- endpoint handles visible on message click — render() after setSelected (170/170, 15/15)
- BUG-001 — uiState.selected refreshed after message Y-drag (170/170, 15/15)
- v0.9.94 — message drag ghost uses direct y-attr updates; ghost stays snapped to lifelines during drag

### Chores
- update HANDOFF
- bump version to v0.9.95 (170/170, 15/15)
- CHANGELOG
- fix group boundaries — bounding boxes, schema, regex contracts in correct groups
- spec-language test descriptions — all groups, clean grouped output
- spec-language test descriptions — ADD_ACTOR group (proof of concept)
- clean test output — remove Suite N headers, add named group labels
- suites-data group field, drop Suite N: prefixes from desc
- update preflight expected test count 137 -> 156
- CHANGELOG
- HANDOFF v0.9.94 — message ghost fix, 137/15

---

## v0.0.0 — ARCH-001 actor drag delegated to ActorElement, InteractionContext injected (170 passing)
_2026-04-06_

### Features
- ARCH-001 actor drag delegated to ActorElement, InteractionContext injected (170 passing)
- ARCH-001 MessageElement, NoteElement, FragmentElement stubs + 14 contract tests (170 passing)
- ULID element IDs, ARCH-001 factory scaffold, two-phase test runner

### Fixes
- v0.9.94 — message drag ghost uses direct y-attr updates; ghost stays snapped to lifelines during drag

### Chores
- fix group boundaries — bounding boxes, schema, regex contracts in correct groups
- spec-language test descriptions — all groups, clean grouped output
- spec-language test descriptions — ADD_ACTOR group (proof of concept)
- clean test output — remove Suite N headers, add named group labels
- suites-data group field, drop Suite N: prefixes from desc
- update preflight expected test count 137 -> 156
- CHANGELOG
- HANDOFF v0.9.94 — message ghost fix, 137/15

---

## v0.9.94 — Release v0.9.94
_2026-04-04_

### Fixes
- v0.9.94 — message drag ghost uses direct y-attr updates; ghost stays snapped to lifelines during drag

### Chores
- HANDOFF v0.9.94 — message ghost fix, 137/15

---

## v0.9.93 — v0.9.93 — actor mousedown selects directly; actor-move overlay owns drag; fitToZoom removed from render(); single-click actor interaction restored
_2026-04-04_

### Features
- v0.9.93 — actor mousedown selects directly; actor-move overlay owns drag; fitToZoom removed from render(); single-click actor interaction restored

### Chores
- HANDOFF v0.9.93 — interaction model, 137/15

---

## v0.9.92 — v0.9.92 — SVG edit-layer replaces HTML edit button (pan/zoom invariant); pan+zoom reset on clear and last-actor-delete; _renderEditBtn eliminates _positionEditBtn coordinate conversion; test name updated
_2026-04-03_

### Features
- v0.9.92 — SVG edit-layer replaces HTML edit button (pan/zoom invariant); pan+zoom reset on clear and last-actor-delete; _renderEditBtn eliminates _positionEditBtn coordinate conversion; test name updated

### Fixes
- PNG double-download — remove duplicate btn-export-png onclick= assignment; Suite 16 regression test pins single binding; preflight 137

### Chores
- HANDOFF v0.9.92 — edit-layer, pan reset, 137/15
- CHANGELOG
- HANDOFF v0.9.91 — 137/15, double-download regression note, QA gate added to release flow

---

## v0.9.91 — Release v0.9.91
_2026-04-03_

### Fixes
- PNG double-download — remove duplicate btn-export-png onclick= assignment; Suite 16 regression test pins single binding; preflight 137

### Chores
- HANDOFF v0.9.91 — 137/15, double-download regression note, QA gate added to release flow

---

## v0.9.91 — POST /generate-readme — live README from git+tests+endpoints+version; extract SF_ENDPOINTS to sf-endpoints.js; readme gen logic to sf-readme-gen.js; suite 9+13 headers; HANDOFF release flow updated
_2026-04-03_

### Features
- POST /generate-readme — live README from git+tests+endpoints+version; extract SF_ENDPOINTS to sf-endpoints.js; readme gen logic to sf-readme-gen.js; suite 9+13 headers; HANDOFF release flow updated

### Fixes
- v0.9.91 — PNG export tainted canvas fixed; renderNote rewritten SVG text+tspan (no foreignObject); Suite 16 regex contract tests (9 tests); preflight 136
- inline SVG favicon — resolves 404, zero external file dependency

### Chores
- HANDOFF v0.9.91 — live fields, Suite 16 regex rule added to DEV LOOP WISDOM

---

## v0.9.90 — v0.9.90 — schema/properties bag on actor+message, dynamic Properties panel, Add Field UI, password strip on export, flexPatch whitespace-tolerant matching in POST /patch, anchor/replace field aliases, suite renumber 1-15
_2026-04-03_

### Features
- v0.9.90 — schema/properties bag on actor+message, dynamic Properties panel, Add Field UI, password strip on export, flexPatch whitespace-tolerant matching in POST /patch, anchor/replace field aliases, suite renumber 1-15

### Chores
- update HANDOFF — v0.9.90 live fields, flexPatch docs, anchor/replace aliases, .gitattributes CRLF note
- HANDOFF — TOKEN DISCIPLINE rule added to FIRST ACTIONS, prohibit full HTML reads, enforce GET /slice

---

## v0.9.89 — centre-on-add — smooth pan to new element on every add — v0.9.89\n\n- _centreOnElement(svgCentreX) pans canvas horizontally with 0.3s ease transition\n- Wired into all addFromPalette branches: actor, message, note, fragment\n- Message centres on fromActor.x (parent anchor) not midpoint\n- state_settings.centreOnAdd (default true) — persists to localStorage\n- Settings modal toggle: "Centre view on add"\n- Graceful: transition removed after 350ms so drag stays instant
_2026-04-01_

### Features
- centre-on-add — smooth pan to new element on every add — v0.9.89\n\n- _centreOnElement(svgCentreX) pans canvas horizontally with 0.3s ease transition\n- Wired into all addFromPalette branches: actor, message, note, fragment\n- Message centres on fromActor.x (parent anchor) not midpoint\n- state_settings.centreOnAdd (default true) — persists to localStorage\n- Settings modal toggle: "Centre view on add"\n- Graceful: transition removed after 350ms so drag stays instant

### Chores
- HANDOFF updated for

---

## v0.9.88 — Help modal README link — v0.9.88\n\n- "README ↗" link added to Help modal footer between Launch Tour and Close\n- Opens GitHub README in new tab (target=_blank, rel=noopener)\n- Styled with var(--text3) and subtle underline — theme-aware
_2026-03-31_

### Features
- Help modal README link — v0.9.88\n\n- "README ↗" link added to Help modal footer between Launch Tour and Close\n- Opens GitHub README in new tab (target=_blank, rel=noopener)\n- Styled with var(--text3) and subtle underline — theme-aware

### Chores
- HANDOFF updated for

---

## v0.9.87 — themes injected at build — window._SF_THEMES, standalone/GitHub Pages safe — v0.9.87\n\n- Root cause: fetch(./themes.json) fails on GitHub Pages (only HTML deployed)\n- Fix: build.js now injects themes.json as window._SF_THEMES between @@THEMES-START/END\n- applyTheme() reads window._SF_THEMES — no fetch, works in any static context\n- themes.json remains source of truth; edit themes → POST /build to update\n- System theme kept: shows "System (Dark)" or "System (Light)" via matchMedia API\n- Graceful fallback: if _SF_THEMES undefined, built-in CSS vars remain active
_2026-03-31_

### Features
- themes injected at build — window._SF_THEMES, standalone/GitHub Pages safe — v0.9.87\n\n- Root cause: fetch(./themes.json) fails on GitHub Pages (only HTML deployed)\n- Fix: build.js now injects themes.json as window._SF_THEMES between @@THEMES-START/END\n- applyTheme() reads window._SF_THEMES — no fetch, works in any static context\n- themes.json remains source of truth; edit themes → POST /build to update\n- System theme kept: shows "System (Dark)" or "System (Light)" via matchMedia API\n- Graceful fallback: if _SF_THEMES undefined, built-in CSS vars remain active

### Chores
- HANDOFF updated for v0.9.87 — themes build injection documented
- HANDOFF KEY FILES updated — test count 120, themes.json, docs/sessions/, dev/ documented, stale canary ref removed
- repo cleanup — session handoffs → docs/sessions/, canary tools → dev/, remove leftover diagram JSON

---

## v0.9.86 — Release v0.9.86
_2026-03-31_

### Fixes
- BUG-003 tour spotlight — retarget Import/Export step to visible #btn-import-menu — v0.9.86\n\n- #btn-import-uml is inside collapsed dropdown (getBoundingClientRect 0,0)\n- Now targets #btn-import-menu — always visible in toolbar\n- Title updated to "Import

### Chores
- HANDOFF updated for
- HANDOFF — BUG-003 tour spotlight 0,0 on Import/Export step logged

---

## v0.9.85 — theme engine — Dark, Light, System, LCARS — v0.9.85\n\n- themes.json: 4 themes with full CSS var sets incl --c-panel, --c-border, --kbd-*, --red, --amber\n- applyTheme() fetches themes.json on boot, applies CSS vars to :root, graceful fallback\n- state_settings.theme persisted to localStorage via existing _saveSettings pattern\n- Settings modal: Theme select row with 4 options\n- Pill CSS: hardcoded dark backgrounds replaced with var(--surface2) + CSS vars\n- Help modal: --bg2 → --surface (transparency fix)\n- Tour: all hardcoded GitHub dark palette replaced with CSS vars\n- Notes: .note-box/.note-text and JS render use var(--accent2) and var(--surface2)\n- Debug console: background var(--bg); inline edit box uses --accent/--surface/--text\n- Global kbd CSS rule using --kbd-bg/border/text vars\n- Light theme WCAG fix: accent #0d9e7a → #0a8f6e (surface2 pair 2.97→3.2)
_2026-03-31_

### Features
- theme engine — Dark, Light, System, LCARS — v0.9.85\n\n- themes.json: 4 themes with full CSS var sets incl --c-panel, --c-border, --kbd-*, --red, --amber\n- applyTheme() fetches themes.json on boot, applies CSS vars to :root, graceful fallback\n- state_settings.theme persisted to localStorage via existing _saveSettings pattern\n- Settings modal: Theme select row with 4 options\n- Pill CSS: hardcoded dark backgrounds replaced with var(--surface2) + CSS vars\n- Help modal: --bg2 → --surface (transparency fix)\n- Tour: all hardcoded GitHub dark palette replaced with CSS vars\n- Notes: .note-box/.note-text and JS render use var(--accent2) and var(--surface2)\n- Debug console: background var(--bg); inline edit box uses --accent/--surface/--text\n- Global kbd CSS rule using --kbd-bg/border/text vars\n- Light theme WCAG fix: accent #0d9e7a → #0a8f6e (surface2 pair 2.97→3.2)

### Chores
- HANDOFF updated for v0.9.85 — theme engine documented

---

## v0.9.84 — Release v0.9.84
_2026-03-31_

### Fixes
- BUG-001 Properties panel refreshes after message Y-drag — v0.9.84\n\n- uiState.selected re-wrapped with _wrapSelected after UPDATE_MESSAGE dispatch in mouseup\n- Properties panel now shows correct From/To after drag-reassign\n- POST /changelog auto-commits CHANGELOG.md (sf-server.js fix)\n- HANDOFF context refreshed with BUG-001 and BUG-002 descriptions
- POST /changelog auto-commits CHANGELOG.md — eliminates dirty-tree after release

### Chores
- HANDOFF updated for
- HANDOFF context refreshed for v0.9.83 — BUG-001 and BUG-002 logged
- CHANGELOG
- CHANGELOG + tag

---

## v0.9.83 — Release v0.9.83
_2026-03-30_

### Chores
- CHANGELOG + tag

---

## v0.9.83 — Release v0.9.83
_2026-03-30_

### Fixes
- Add Message wires from selected actor, next actor as toId — v0.9.83\n\n- addFromPalette msg-sync/async/return now uses selected actor as fromId\n- toId set to next actor by x position after fromId\n- Falls back to leftmost actor when nothing selected\n- Self-message when only one actor exists

### Chores
- HANDOFF updated for v0.9.83 — Add Message actor-context wiring documented
- sf-preflight.ps1 expected store test count 112 → 120
- CHANGELOG + tag

---

## v0.9.82 — simplified palette, horizontal-only pan, fit-to-diagram — v0.9.82\n\n- Palette reduced to 4 flat items: Add Actor, Add Message, Add Conditional, Add Note\n- Add Conditional adds frag-alt; type changed via Properties kind select\n- Zoom controls moved to statusbar — always visible, no layout fight\n- Fit button removed — clicking zoom label fits diagram to canvas\n- fitToZoom: top-anchor, horizontal centre, uses getBoundingClientRect for correct visible height\n- Horizontal-only pan — panY always 0; sequence diagrams scroll vertically\n- canvas-wrap overflow-y:auto — native vertical scroll enabled\n- Arrow Left/Right pan; Up/Down fall through to native scroll\n- UPDATE_ACTOR accepts x in partial patch (store fix)\n- Suite 14: 8 pin-down tests for pan/nudge store contracts
_2026-03-30_

### Features
- simplified palette, horizontal-only pan, fit-to-diagram — v0.9.82\n\n- Palette reduced to 4 flat items: Add Actor, Add Message, Add Conditional, Add Note\n- Add Conditional adds frag-alt; type changed via Properties kind select\n- Zoom controls moved to statusbar — always visible, no layout fight\n- Fit button removed — clicking zoom label fits diagram to canvas\n- fitToZoom: top-anchor, horizontal centre, uses getBoundingClientRect for correct visible height\n- Horizontal-only pan — panY always 0; sequence diagrams scroll vertically\n- canvas-wrap overflow-y:auto — native vertical scroll enabled\n- Arrow Left/Right pan; Up/Down fall through to native scroll\n- UPDATE_ACTOR accepts x in partial patch (store fix)\n- Suite 14: 8 pin-down tests for pan/nudge store contracts

### Chores
- HANDOFF updated for v0.9.82 — simplified palette, horizontal pan, fit-to-diagram documented

---

## v0.9.81 — canvas pan (drag + arrow keys) — v0.9.81\n\n- Left-click drag on empty canvas pans the viewport\n- Arrow keys pan canvas when nothing selected\n- Arrow keys nudge selected element (actor X-only, note/fragment X+Y)\n- UPDATE_ACTOR now accepts x in partial patch\n- Suite 14: 8 pin-down tests for pan/nudge store contracts\n- grab/grabbing cursor CSS on empty canvas
_2026-03-30_

### Features
- canvas pan (drag + arrow keys) — v0.9.81\n\n- Left-click drag on empty canvas pans the viewport\n- Arrow keys pan canvas when nothing selected\n- Arrow keys nudge selected element (actor X-only, note/fragment X+Y)\n- UPDATE_ACTOR now accepts x in partial patch\n- Suite 14: 8 pin-down tests for pan/nudge store contracts\n- grab/grabbing cursor CSS on empty canvas

### Chores
- HANDOFF updated for v0.9.81 — Suite 14, pan feature, UPDATE_ACTOR x documented
- HANDOFF updated for v0.9.80 — icebox 0 closed, /slice documented, context refreshed
- CHANGELOG + HANDOFF

---

## v0.9.80 — validate-readme hasLabel check + README link and label updated
_2026-03-30_

### Features
- validate-readme hasLabel check + README link and label updated

### Fixes
- README label and link updated to v0.9.80; validate-readme now checks label text
- validate-readme now asserts label text contains version string (icebox 0)

### Chores
- CHANGELOG + HANDOFF

---

## v0.9.79 — GET /slice scoped context loading + sentinel sections + preflight script
_2026-03-27_

### Features
- GET /slice scoped context loading + sentinel sections + preflight script
- GET /slice endpoint + sentinel comments for scoped context loading

### Fixes
- README live demo label v0.9.70 ->

### Chores
- remove duplicate /slice handler and /scan temp endpoint
- sync store version banner removal into HTML
- remove stale version banner from store file
- icebox — cost-log persistent tracking item added
- handoff — README label fix, validate-readme icebox, fresh clone notes
- documentation review — HANDOFF version/count/icebox/shipped corrections; test NYT note added
- CHANGELOG

---

## v0.9.78 — Release v0.9.78
_2026-03-26_

### Fixes
- PUT handler normalises CRLF→LF on write — eliminates multi-line patch failure class

### Chores
- HANDOFF —
- CHANGELOG

---

## v0.9.77 — interaction layer — selected elements elevate above all others; fragment resize handle 14px accent; Suite 13 pin-down tests
_2026-03-26_

### Features
- interaction layer — selected elements elevate above all others; fragment resize handle 14px accent; Suite 13 pin-down tests

### Chores
- HANDOFF —
- HANDOFF note v0.9.75 never separately released
- CHANGELOG

---

## v0.9.76 — Release v0.9.76
_2026-03-25_

### Fixes
- remove kb-hint bar + CSS, zoom overlay clears debug console

### Chores
- HANDOFF —
- CHANGELOG

---

## v0.9.75 — floating zoom overlay + Help modal with keyboard shortcuts
_2026-03-25_

### Features
- floating zoom overlay + Help modal with keyboard shortcuts

### Chores
- HANDOFF —
- CHANGELOG

---

## v0.9.74 — Release v0.9.74
_2026-03-25_

### Chores
- HANDOFF —
- remove ? toolbar button + CSS + var help; lint 9 buttons
- CHANGELOG

---

## v0.9.73 — Release v0.9.73
_2026-03-25_

### Chores
- HANDOFF —
- dead code removal — btn handlers, toggleConnectMode, getLastActor, duplicate getNextActorX
- CHANGELOG

---

## v0.9.72 — remove add-element toolbar buttons — keyboard shortcuts + palette sufficient
_2026-03-25_

### Features
- remove add-element toolbar buttons — keyboard shortcuts + palette sufficient

### Chores
- HANDOFF —
- CHANGELOG

---

## v0.9.71 — remove placement mode — actor add-and-drag consistent with note/fragment
_2026-03-25_

### Features
- remove placement mode — actor add-and-drag consistent with note/fragment

### Chores
- HANDOFF —
- add .gitattributes — normalise all text files to LF
- CHANGELOG

---

## v0.9.70 — POST /update-handoff — idempotent HANDOFF.md live-field automation
_2026-03-25_

### Features
- POST /update-handoff — idempotent HANDOFF.md live-field automation

### Chores
- HANDOFF —
- HANDOFF — prepare next session brief, remove stale context block

---

## v0.9.69 — Release v0.9.69
_2026-03-24_

### Chores
- HANDOFF update
- HANDOFF — prepare documentation standards session, fix known stale content
- changelog — add UI factories design decision note

---

## v0.9.68 — selector layer — 8 named selectors on store, 52 call sites replaced
_2026-03-24_

### Features
- selector layer — 8 named selectors on store, 52 call sites replaced

### Design decisions
- **UI element factories (icebox — no action):** Evaluated whether to encapsulate SVG/DOM element creation into factory functions (e.g. makeActorEl, makeMessageEl). Conclusion: deferred. The render gate (GET /test-render, 15 snapshots) already catches regressions at the output level without caring how elements are built. Factory functions would be the right move if element construction logic needed reuse outside render() — e.g. canvas export, thumbnail preview — but that need has not yet arrived. proto2prod rule: add infrastructure only when the cost of not having it is felt. Revisit if a second consumer of element construction appears.

---

## v0.9.67 — Release v0.9.67
_2026-03-24_

### Fixes
- CSS — add --violet + --amber to :root, remove 2 !important overrides

---

## v0.9.66 — render() pure DOM projection — _saveDiagram + updateOutput moved to store listeners
_2026-03-24_

### Features
- render() pure DOM projection — _saveDiagram + updateOutput moved to store listeners

---

## v0.9.65 — GET /test-render — Playwright render gate, 3 demos × 5 SVG layers, 15 snapshots
_2026-03-24_

### Features
- GET /test-render — Playwright render gate, 3 demos × 5 SVG layers, 15 snapshots
- extend CRLF_FILES whitelist to include HANDOFF.md; add render test coverage to icebox #1 (inspired by Mermaid.js visual regression suite, v0.9.64 arch review)
- lint.js structural checks (dropdown DOM containment + .tbtn-io-menu CSS), HANDOFF session wisdom, icebox pruned to 2 items
- CRLF factory (normalisePatch) in POST /patch, clean rewrite of sf-server.js — zero duplicate handlers, all 18 endpoints, addLog flags
- POST /git-restore endpoint + HANDOFF API table updated with addLog flags for git-restore, changelog, tag
- POST /changelog auto-generates CHANGELOG.md from git log since last tag; icebox POST /git-restore + doc standards

### Chores
- dedup sf-server.js -- remove 7 duplicate GET /git-log handlers and usage duplicates; 1 of each remains
- prune icebox — remove 3 shipped items (PIN removal, Export/Import dropdowns, addLog audit), 4 active items remain
- reorder icebox — Export CSV demoted to #8, stale items preserved, POST /git-restore added

---

## v0.9.64 — Release v0.9.64
_2026-03-24_

### Fixes
- dropdown menus position:absolute — Export/Import items now float below button not in flow

---

## v0.9.26 — current working state
_Unreleased — pending commit_

All changes listed under v0.9.25 below are included in this release.

---

## v0.9.25 — Interaction model cleanup, annotation Edit button fix

### Interaction model
- **Any element can be added at any time** — no precondition guards
  - Removed "need ≥2 actors" and "need ≥1 actor" guards on message add
  - Messages now add with `fromId: null, toId: null` — wired via Properties panel
- **Removed arm-and-fire association mechanic** (`pendingActorId`, `associateOnSelect`)
  - Actors no longer "arm" when clicked; no implicit message-from assignment on click
  - Association is explicit: use the From/To dropdowns in Properties
- **Removed settings** that are now superseded or removed:
  - `associateOnClick` — implicit association removed entirely
  - `clickFocusTab` — superseded by the Edit button
- `setSelected()` signature simplified — `associateOnSelect` param removed

### Edit button fixes
- **Annotations (notes, fragments)** — Edit button now appears correctly after deselect + reclick
  - Root cause: `mouseup` called `render()` synchronously on every click, even zero-movement ones, destroying the SVG element before the click event fired
  - Fix: `MOVE_NOTE` / `MOVE_FRAGMENT` only dispatch when position actually changed; `render()` deferred via `setTimeout(0)` so click lands on live element
- **Wrong Properties pane on element switch** — fixed `_selectedKey` being set prematurely in `setSelected` before `renderProperties()` guard check, causing message Properties to persist when clicking a different element type

### Bug fixes
- `MOVE_NOTE` / `MOVE_FRAGMENT` no longer dispatch or render on zero-movement clicks
- `isPending` reference removed from `renderActor` (was causing `ReferenceError` on actor click after association mechanic removal)

### Tests
- 81 total (was 70)
- Suite 9 additions: no-guard policy verification, `isPending` removal check, `MOVE_NOTE`/`MOVE_FRAGMENT` zero-movement guard, deselect-reselect cycle, note canvas click path

---

## v0.9.24 — Two-state panels, floating Edit button

### Panel system
- **Left panel (Palette)**: `icons` (60px) | `full` (200px)
  - Toggle button, `[` / `{` keyboard shortcut, drag resize with snap
  - Pin button prevents state changes
- **Right panel (Inspector)**: `icons` (60px) | `full` (340px)
  - Toggle button, `]` / `}` keyboard shortcut, drag resize with snap
  - Pin button prevents state changes
- CSS custom properties (`--sidebar-w`, `--panel-w`) drive grid column widths
- 0.18s transition on width changes (respects `prefers-reduced-motion`)
- Settings modal: scrollable, **Reset UI to defaults** button clears `sf-settings` from localStorage

### Edit button
- Floating accent badge at top-right of selected element bounding box
- Appears on all four element types: actor, message, note, fragment
- Click expands Inspector from icons to full if needed, switches to Properties tab, focuses first interactive field
- Hides on deselect; repositions after every render
- Root causes fixed:
  - `_canvasWrapW = 0` at boot clamped button to `x: -60px` (off-screen) — fixed by reading `offsetWidth` directly with lazy fallback
  - Actors with 2+ actors: mouseup REFLOW path called `render()` unconditionally, destroying actor element before click event — fixed by deferring render only when positions changed
  - `_selectedKey` guard in `renderProperties` was set before the comparison, causing guard to always match on element switch — fixed by setting key after the check

### Other fixes
- Export: `<a>` element appended to `document.body` before `.click()` — fixes blank page in Electron
- Message direction cycle removed from dblclick (now Properties-only)
- `renderProperties` `_selectedKey` guard: preserves input focus and cursor position when re-selecting the same element

### Tests
- 70 total (was 60)
- Suite 9: edit button bounding box for all element types, deselect-reselect cycle

---

## v0.9.23 — Suite 8: E2E lifecycle tests

- 17 new tests covering full diagram lifecycle:
  - `LOAD_DEMO` → modify (add actor, update message, move message, add note)
  - JSON snapshot round-trip
  - `CLEAR_DIAGRAM` → `LOAD_DIAGRAM`
  - PlantUML serialization validation of imported/modified state
- Total: **60 tests**

---

## v0.9.22 — Targeted SVG redraws during drag

- **Zero-render dragging** for actors, notes, fragments, and messages
  - During drag: directly mutate live store object + `setAttribute('transform', translate)` on ghost element — no `dispatch`, no `render()`
  - On mouseup: single undoable commit + one `render()`
- Eliminates jank and prevents render loop during drag
- Notes and fragments now get undoable `MOVE_NOTE` / `MOVE_FRAGMENT` on drop

---

## v0.9.21 — Arrowhead/lifeline overlap fix (final)

- Background `<rect fill>` added to each forward marker before the arrowhead shape
- Occludes lifeline dashes at arrow endpoint cleanly
- Lines remain center-to-center; no inset needed

---

## v0.9.20 — Arrowhead overlap fix (attempt)

- Adjusted marker `refX` values to anchor arrowhead tip at endpoint
- Partially addressed lifeline/arrowhead overlap

---

## v0.9.19 — UML import button fix

- Import button now blocks only on `hint`-bearing warnings (fixable errors)
- Informational warnings (skipped directives) allow import to proceed
- Fixes case where valid diagrams with `skinparam` or `autonumber` were blocked

---

## v0.9.17–v0.9.18 — UML Text Import

- `_parseUML(text)` pure parser — no DOM or store dependency, Node-runnable
- Supports PlantUML (`@startuml`) and Mermaid (`sequenceDiagram`)
- Arrow regex handles: `->`, `-->`, `->>`, `<->`, `<-->`, labelless arrows, no-space Mermaid style
- Two warning classes:
  - **Hint warnings** — fixable (e.g. `actor Label` without `as`), block import
  - **Informational** — skipped directives, allow import
- Import modal: per-line warnings with line numbers and fix hints
- Parse button shows warnings; Import button disabled until clean
- Suite 7: 10 tests

---

## v0.9.16 — Baseline (last check-in)

- Undo/redo with branching history
- localStorage persistence (diagram + settings)
- Actor, message, note, fragment CRUD
- Connect mode for message creation
- Properties panel with live field updates
- PlantUML and Mermaid serialization
- Zoom controls
- Debug console with verbose toggle
- Suites 1–6: 50 tests covering store operations, undo/redo, message helpers
