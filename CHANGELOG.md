# SequenceForge Changelog

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
