# SequenceForge — Proto2Prod Handoff
**Version:** 0.9.16  
**Date:** 2026-03-17  
**Audience:** Human + fresh AI instance  
**Repo:** https://github.com/MeatPopSci1972/sequence-builder
**Local:** E:\uml2prompt\sequence-builder-prototype

---

## What This Is

Single-file, zero-dependency static HTML application for building UML sequence diagrams visually. Outputs PlantUML or Mermaid syntax. Runs entirely in the browser — no server, no build step, no npm. Drop `sequence-builder.html` onto GitHub Pages, Netlify, S3, or open it directly in a browser.

**Deployment:** `git push` → done. No CI required for static hosting.

---

## File Layout

```
sequence-builder.html        ~3717 lines — full application, single deployable
sequence-builder.store.js      ~514 lines — store module, pure JS, no DOM, node-runnable
sequence-builder.test.js       ~560 lines — contract tests, node-runnable, no browser needed
build.js                        ~110 lines — syncs store.js → HTML between sentinel comments
```

**Run tests:** `node sequence-builder.test.js`  
**Sync store → HTML:** `node build.js`  
**Syntax check:** `sed -n '/<script>/,/<\/script>/p' sequence-builder.html | sed '1s/<script>//' | sed '$s/<\/script>//' > sf-script.js && node --check sf-script.js`  
**Full gate:** `node build.js && sed -n '/<script>/,/<\/script>/p' sequence-builder.html | sed '1s/<script>//' | sed '$s/<\/script>//' > sf-script.js && node --check sf-script.js && node sequence-builder.test.js`

**Current test suite (33 tests, 6 suites — Phase 1 complete):**

| Suite | Action / Feature | Tests |
|-------|-----------------|-------|
| 1 | ADD_ACTOR + REFLOW_ACTORS | 9 |
| 2 | DELETE_ACTOR cascade | 4 |
| 3 | UPDATE_MESSAGE partial patch | 3 |
| 4 | meta.undoable = false | 4 |
| 5 | UNDO | 6 |
| 6 | REDO — branching history, canRedo, state:restored direction | 7 |

`sequence-builder.html` internal structure:

```
<style>          ~590 lines — all CSS, CSS custom properties, reduced-motion block
<body>           ~456 lines — HTML structure, modals, SVG canvas scaffold
<script>        ~2250 lines — store IIFE + application logic
  ├── Debug console
  ├── DiagramStore IIFE       (inlined from sequence-builder.store.js)
  ├── store instantiation + uiState
  ├── requestRender()         (rAF-batched render for drag path)
  ├── store.on() listeners
  ├── Adapter pattern         (PlantUML + Mermaid serializers)
  ├── Mock Ollama API         (called directly from sendToAPI, no fetch patch)
  ├── Rendering pipeline      (ends with _saveDiagram() call)
  ├── Interaction layer       (drag, click, keyboard — zoom-corrected coordinates)
  ├── Property Visitors       (replaces 4× type switch)
  ├── Toolbar + modal wiring  (Undo + Redo buttons, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
  ├── Export / Import         (JSON file download + file input)
  ├── Settings                (_loadSettings IIFE + _saveSettings)
  ├── Diagram Persistence     (_loadDiagram IIFE + _saveDiagram + _exportDiagram + _importDiagram)
  ├── Zoom system             (WCAG 1.4.4)
  └── INIT                   (boot sequence documented inline)
```

No external dependencies. Google Fonts loaded from CDN (JetBrains Mono, Syne) — gracefully degrades to monospace/sans-serif if offline.

---

## Architecture

### The Core Separation (v0.6.0, unchanged)

The central design decision is the explicit split between diagram data and UI state.

```
store.state   — diagram data only: actors, messages, notes, fragments, nextId
               Serializable. Persistable. Never touches DOM.

uiState       — UI-only, never persisted:
               selected, mode, connectFrom, pendingActorId, format
               Resets on reload by definition.
```

The persistence test: if it should survive a browser refresh, it belongs in `store.state`. If it resets on reload, it belongs in `uiState`. That rule resolves every future boundary question without debate.

### One-Way Dependency

```
User event
    │
    ▼
store.dispatch(action)
    │
    ├── logs action to store.log
    ├── pushSnapshot() if undoable
    ├── mutates store.state          ← try/catch: pops log entry on handler throw
    └── emit(event, payload)
              │
              ▼
        store.on() listeners
              │
              ├── update uiState (selected, mode, etc.)
              ├── call setSelected() for selection side-effects
              │     └── pushes announcement to #select-announce live region
              └── call render() or requestRender()
                      │
                      ├── render()        — low-frequency mutations (add, delete, undo)
                      └── requestRender() — high-frequency drag (rAF-batched, deduped)
                              │
                              ▼
                          SVG + DOM
                          (viewport <g> applies _zoom transform)
```

**The invariant:** `store` never reads `uiState`. `store` never calls `render()`. Dependency flows one direction only.

### Data Model

```js
// store.state — the narrow record
{
  actors: [
    { id, x, label, type, emoji? }
  ],
  messages: [
    { id, fromId, toId, label, kind, direction, y,
      protocol?, port?, auth?, dataClass? }
  ],
  notes: [
    { id, x, y, text }
  ],
  fragments: [
    { id, x, y, w, h, kind, cond }
  ],
  nextId: Number   // monotonic counter, never reset mid-session
}

// uiState — never persisted
{
  selected:       null | { ...obj, _type, _ref, _preview? }
  mode:           'select' | 'connect'
  connectFrom:    null | actorId
  pendingActorId: null | actorId
  format:         'plantuml' | 'mermaid'
}
```

### Property Visitor Pattern (v0.7.0)

`renderProperties()` and `applyPropertyChange()` previously contained a 4× `if/else if` type switch. Both are now driven by a single `propertyVisitors` object keyed by `_type`:

```js
propertyVisitors = {
  actor:    { html(s), apply(s), announce(s) },
  message:  { html(s), apply(s), announce(s), afterRender(s) },
  note:     { html(s), apply(s), announce(s) },
  fragment: { html(s), apply(s), announce(s) },
}
```

- **`html(s)`** — returns the properties panel HTML string for that type.
- **`apply(s)`** — reads the panel inputs and dispatches the appropriate `UPDATE_*` action.
- **`announce(s)`** — returns the screen-reader selection string (e.g. `"Message: POST /login from User to API Gateway"`). Fed directly into `#select-announce` by `setSelected()`.
- **`afterRender(s)`** — optional post-innerHTML hook. Used by the message visitor to set `<select>` values after innerHTML assignment (a DOM sequencing requirement, not a design choice).

**To add a new element type:** register one entry in `propertyVisitors`. No changes to `renderProperties`, `applyPropertyChange`, or `setSelected`.

### Zoom System (v0.7.0)

All SVG layers are wrapped in `<g id="viewport">`. `applyZoom(z)` sets a CSS `scale(z)` transform on that group and updates the `_zoom` state variable.

```js
let _zoom = 1.0;  // range: 0.25–3.0, step 0.1

function applyZoom(z) {
  _zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  _viewport.setAttribute('transform', `scale(${_zoom})`);
  // updates zoom-label, disables out/in buttons at limits
}
```

**Drag coordinate correction:** all `mousedown` and `mousemove` coordinate calculations divide by `_zoom` before computing diagram-space positions. Without this, drag targets drift at non-100% zoom.

```js
// mousedown
dragOffX = (e.clientX - canvasRect.left) / _zoom - obj.x;

// mousemove
const newX = (e.clientX - canvasRect.left) / _zoom - dragOffX;
```

Zoom is triggered by: toolbar Zoom+/Zoom− buttons, the 100% reset button, Ctrl+wheel on the canvas, and Ctrl++/−/0 keyboard shortcuts.

### rAF Render Batching (v0.7.0)

```js
let _rafPending = false;
function requestRender() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; render(); });
}
```

`*:moved` store events use `requestRender()`. All other events call `render()` directly. The split is intentional: low-frequency mutations (add, delete, undo, update) get immediate DOM feedback; high-frequency drag events are capped at one render per animation frame (~60fps). The two paths must not be collapsed — direct `render()` on mutations is correct behavior, not a performance oversight.

---

## Known Issues and Architecture Notes

### FIXED in v0.7.0

**[dispatch()] No error boundary** — now has try/catch. On handler throw, the log entry is popped before the error surfaces. The snapshot (if any) remains on the stack — undo stays consistent, log stays clean.

**[LOAD_DEMO] tempId collision** — `tempId` now initializes to `state.nextId` instead of hardcoded `1`. Only observable if actors were added before clicking Load Demo in the same session.

**[window.fetch] Global monkey-patch** — removed. `sendToAPI()` checks `url.includes('11434')` directly and calls `mockOllamaHandler()` without touching `window.fetch`.

**[renderFragment] Missing tabindex** — fragments now receive `tabindex="0"` in the render pipeline, completing keyboard parity with actors, messages, and notes.

**[setMode()] Duplicate definition** — the dead duplicate of `setMode` (hoisted and shadowed by the live definition) was removed.

### INFO — Architecture notes, not defects

**[showPalettePreview / addFromPaletteBtn] Second mutation pathway**  
`showPalettePreview()` sets `uiState.selected._ref` to a synthetic `_preview` object. When the `+` button fires, `addFromPaletteBtn()` harvests values from the DOM form and passes them to `dispatch()` — not directly to `_ref`. This is correct. The preview object is a staging area, not a store object. Document this explicitly if the palette logic is ever refactored.

**[uiState.selected._ref] Live pointer into store.state**  
`_ref` points directly into `store.state` array objects. Reading it is safe. Writing to it directly (`s._ref.label = 'x'`) bypasses the log, the snapshot, and undo. The visitor pattern's `apply(s)` methods all go through `dispatch(UPDATE_*)` correctly — but this remains the most dangerous pattern in the codebase. Consider `Object.freeze()` on `_ref` or replacing it with an O(n) find via `store.state.actors.find(a => a.id === s.id)`.

**[render() pipeline] Full SVG rebuild on every call**  
`render()` destroys and rebuilds all SVG layers on every call. `requestRender()` caps drag renders at 60fps, which addresses the batching problem. The underlying cost per render is still O(n) DOM writes for all elements. For diagrams beyond ~30 actors, the next optimization is targeted redraws: update only the moved element's `transform` attribute rather than rebuilding the layer. Web Workers are not the right tool here — render() is almost entirely DOM writes, which workers cannot perform. Threading only becomes relevant if layout math (y-position assignment, geometry calculations) becomes the bottleneck, not the DOM writes.

---

## WCAG 2.2 AA Status (v0.7.0)

The following criteria are addressed:

| Criterion | Status | Implementation |
|-----------|--------|----------------|
| 1.3.1 Info and Relationships | ✓ | `role="tab/tabpanel/tablist"`, `aria-labelledby`, `role="complementary"` on sidebars |
| 1.4.1 Use of Color | ✓ | `aria-pressed` on connect mode button — mode state no longer communicated by color alone |
| 1.4.3 Contrast (Minimum) | ✓ | `--text3` token raised to ~4.7:1 in v0.6.0 |
| 1.4.4 Resize Text | ✓ | Zoom system: 25%–300% range, toolbar buttons, Ctrl+wheel, Ctrl++/−/0 |
| 2.1.1 Keyboard | ✓ | All canvas elements tab-focusable; arrow keys move selected element; Delete removes; Escape deselects |
| 2.3.3 Animation from Interactions | ✓ | `@media (prefers-reduced-motion: reduce)` zeroes all transitions and animations |
| 2.4.1 Bypass Blocks | ✓ | Skip link to `#canvas-wrap` |
| 2.4.3 Focus Order | ✓ | Logical DOM order; modal focus trap with Shift+Tab wrap |
| 2.4.7 Focus Visible | ✓ | `--focus-ring` applied to all interactive elements via `:focus-visible` |
| 3.3.4 Error Prevention | ✓ | Confirm modal before destructive clear; `requestAnimationFrame` focus on modal open |
| 4.1.2 Name, Role, Value | ✓ | `role="application"` + `aria-roledescription="diagram"` on canvas SVG; all interactive SVG elements have `role="button"`, `aria-label`, `tabindex="0"`; `aria-selected` on tabs; `aria-live` regions for selection, connect-mode, and toast |

**Known remaining gap:** `aria-label` on the canvas SVG updates on every `render()` call ("Sequence diagram — 4 actors, 6 messages, 1 fragment") but uses `aria-live="off"` (no live attribute). This is intentional — announcing on every render would be noisy. Selection announcements go through `#select-announce` (`aria-live="polite"`). If a screen reader user needs a diagram summary, focus on the canvas element itself reads the current label.

---

## Critical Architecture Review

### What is genuinely good

**The narrow store boundary is the right call.** `store.state` maps directly to what you would put in a JSON export file. `localStorage` persistence remains a one-liner: `localStorage.setItem('sf-diagram', JSON.stringify(store.state))`.

**The action log is more powerful than a snapshot stack.** The log captures intent, not just state. This enables undo/redo, diagram export as a replay-able sequence, debugging by reading the log, and eventually collaborative editing (action logs are how CRDTs work). `meta.undoable: false` for drag operations is exactly the right filter.

**The visitor pattern closed the open/closed violation.** The old `renderProperties` / `applyPropertyChange` type switch was the most likely place for a future developer to introduce a bug by updating one switch and forgetting the other. A single `propertyVisitors` registration is now the only change required to support a new element type end-to-end — including the screen-reader announcement string.

**Test-first contract was the right forcing function.** The five test suites define the store API. This pattern should be followed for every subsequent feature that has pure logic (localStorage serialization, redo stack).

**The pure helpers pattern is underrated.** `nextMessageKind()` and `nextMessageDirection()` are tested, named, and exportable. They can't silently diverge between the click handler and any future keyboard shortcut.

### What is load-bearing and fragile

**`uiState.selected._ref` is the most dangerous pointer in the codebase.** See INFO note above. The visitor pattern's `apply(s)` methods are all correct — but one future developer writing `s._ref.label = ...` instead of `dispatch(UPDATE_ACTOR, ...)` will introduce a silent undo bug with no visible error.

**`dispatch()` error boundary covers log integrity, not state integrity.** The try/catch added in v0.7.0 ensures a failed handler doesn't leave a phantom log entry. It does not roll back a partial state mutation — if a handler mutates `state.actors` and then throws, the mutation stands. This is acceptable at current scale. A transactional handler (snapshot → mutate → on throw: restore snapshot) would be the correct fix if handlers become complex enough to fail mid-mutation.

**The single-file constraint is a deployment strength and a development liability.** The file is now 3270 lines. The `sequence-builder.store.js` extraction showed the right model: pure logic developed and tested outside the HTML, inlined for deployment. The property visitors are the next candidate for extraction — they are pure functions with no DOM dependency except the `document.getElementById` calls inside `apply()`.

### What the architecture cannot easily support (honest assessment)

**Collaborative editing.** The action log is the right foundation but the store is a single shared mutable object. The log shape would need `{ ...action, originId, vectorClock }` to become CRDT-ready. Not a near-term concern.

**Undo across sessions.** The snapshot stack and action log are in-memory only. `localStorage` persistence will save `store.state` at rest but not the undo history. This is expected behavior and should be documented in the UI when persistence is implemented.

**Typed schema validation.** `dispatch({ type: 'ADD_ACTOR', payload: { label: 123 } })` silently stores a number as a label. At current scale this is fine. At team scale, Zod schema validation on the payload inside `dispatch()` would catch this class of error immediately.

**Responsive layout at large font sizes.** Resolved in v0.9.1. Topbar uses `flex-wrap: wrap` with `tbtn-group` divs as wrap units. The `#app` grid row is `auto` so the workspace tracks topbar height.

---

## What's Not Done (Next Session Candidates)

| Item | Priority | Notes |
|------|----------|-------|
| ~~localStorage save/load~~ | ~~High~~ | **Done v0.8.0.** `_saveDiagram()` called at end of every `render()`. `_loadDiagram()` IIFE restores on boot. Export JSON + Import JSON buttons wired. Undo history intentionally not persisted — documented in INIT comment. |
| ~~`_ref` read-only enforcement~~ | ~~High~~ | **Done v0.8.1.** `Object.freeze()` applied conditionally in `_wrapSelected`: frozen for live store objects, unfrozen for `_preview: true` scratch objects (palette form harvests values from them before dispatch). Direct assignment call site in `showPalettePreview` consolidated into `_wrapSelected`. Verified: write to frozen `_ref` throws; preview writes succeed; store state unchanged after attempted bypass. |
| ~~Redo stack~~ | ~~Med~~ | **Done v0.9.0.** `_redoStack` in store. `UNDO` pushes to redo stack before restoring. `REDO` pushes to undo stack (making redo itself undoable) then restores. `pushSnapshot()` clears redo stack on any new mutation (branching history). `LOAD_DIAGRAM` / `LOAD_DEMO` clear both stacks. `canRedo` getter live. Redo toolbar button + `Ctrl+Y` / `Ctrl+Shift+Z` shortcuts. `state:restored` event carries `direction: 'undo'|'redo'`. 24 contract tests green. |
| ~~Responsive topbar~~ | ~~Med~~ | **Done v0.9.1.** `#topbar` gets `flex-wrap: wrap; min-height: 48px`. `#app` grid row changes from `48px` to `auto` so the workspace tracks topbar height. Buttons wrapped into 6 `tbtn-group` divs (Brand / Create / History / Actions / Settings+API / Zoom) — each group wraps as a unit, separated by `border-left`. Old `top-sep` elements hidden via CSS (`display:none`); group borders replace them. Full-width `spacer` div forces a row break between Create and History groups on narrow viewports, pushes them apart on wide ones. All 16 button IDs verified present exactly once. |
| ~~Build script (`build.js`)~~ | ~~High~~ | **Done v0.9.2.** Reads `sequence-builder.store.js`, strips `module.exports` block, applies rename pass (`ACTOR_W`→`STORE_ACTOR_W`, `ACTOR_GAP`→`STORE_ACTOR_GAP`, `UNDO_LIMIT`→`STORE_UNDO_LIMIT`) to avoid collisions with app-level constants, splices into HTML between `// @@STORE-START` / `// @@STORE-END` sentinels. The three constants previously declared above the sentinel in the HTML (`STORE_ACTOR_W`, `STORE_ACTOR_GAP`, `STORE_UNDO_LIMIT`) were removed — the injected store block is now the sole declaration. Gate: `node build.js && node --check sf-script.js && node sequence-builder.test.js`. |
| ~~Suite 6 — REDO contract tests~~ | ~~High~~ | **Done v0.9.9.** 7 tests: REDO after UNDO restores state; empty-stack no-throw; new mutation clears redo stack (branching history); UNDO after REDO works (redo is undoable); `canRedo` getter; multiple REDO steps walk forward; `state:restored` carries `direction` field. 29/29 green. |
| ~~Debug console cleanup~~ | ~~Med~~ | **Done v0.9.10.** `let DEBUG_VERBOSE = false` declared adjacent to boot message (before store sentinel). Three high-frequency calls gated: `msg:updated` (fires per render), `msg-dblclick` (fires per dblclick dispatch), `save` (fires per render). All other `dbg()` calls remain unconditional — they are low-frequency (one per user gesture). `assoc-fallback` untouched per design decision. **Verbose toggle button** added to debug toolbar — clicking flips `DEBUG_VERBOSE` at runtime, applies `.active` CSS class (accent border/color), and logs the state change. `const` → `let` to allow mutation from the handler. |
| ~~`message:updated` render deferral side-effects audit~~ | ~~Med~~ | **Done v0.9.11.** Root cause found via verbose log: single-click on a message dispatched `UPDATE_MESSAGE` twice — once for kind-cycle in the 220ms debounce timer, then again inside `setSelected(..., true)` via the `associateOnClick` fallback (which re-assigned `fromId` if `lastActor.id !== currentMsg.fromId`, always true for messages not already associated). Fix: pass `false` for `associateOnSelect` in the kind-cycle timer's `setSelected` call. Kind-cycle is not a connect-mode action and must not trigger actor association. Double `msg:updated` → double deferred `render()` → double `_saveDiagram()` all resolved by the single-character argument change. |
| ~~Fragment resize~~ | ~~Med~~ | **Done v0.9.14.** SE-corner resize handle rendered on selected fragments (`data-type="frag-resize"`). Mousedown on handle sets `dragging._resizeHandle = 'se'`; mousemove dispatches non-undoable `RESIZE_FRAGMENT` (min 60×40); mouseup commits one undoable `RESIZE_FRAGMENT`. `fragment:resized` listener wired → `requestRender()`. `_resizeHandle` cleared to `null` on normal move-drag start to prevent state bleed. Handle is 8×8px, accent-colored, `cursor: se-resize`. |
| ~~Actor drag reflow~~ | ~~Med~~ | **Done v0.9.16.** On actor drag-drop, all actors are re-sorted by final X and assigned clean evenly-spaced positions (`40 + i * (ACTOR_W + ACTOR_GAP)`). Committed as a single `REFLOW_ACTORS` dispatch — one snapshot, one Ctrl+Z undoes all moves. Only dispatches if at least one actor actually changed position. `actors:reflowed` listener → `render()`. Two new tests: reflow repositions correctly; single UNDO restores all (33 total). |
| ~~Place-actor mode~~ | ~~Med~~ | **Done v0.9.15.** `btn-add-actor` and `A` key now toggle `place-actor` mode (same toggle pattern as `connect` mode). In place-actor mode: canvas shows crosshair cursor; translucent ghost actor tracks the mouse via `uiState.placeGhostX` + `requestRender()`; click anywhere on the canvas dispatches `ADD_ACTOR` at cursor X and exits mode; `mouseleave` hides ghost; Escape exits. `ADD_ACTOR` store handler updated: `x: payload.x ?? getNextActorX()` — honours caller-supplied X, falls back to sequential placement when absent. Two new tests cover the `payload.x` path (31 total). `setMode` extended to manage `btn-add-actor` active/aria-pressed state and `placing-actor` CSS class. |
| Import UML | Med | Parse PlantUML or Mermaid text input and hydrate store state. Entry point: a text area in the Import/Export panel or a dedicated modal. Parser scope TBD — at minimum actor/message extraction; notes and fragments are stretch. |
| Targeted SVG redraws | Med | For diagrams >30 actors. Update only the moved element's `transform` on drag rather than rebuilding the layer. Natural successor to rAF batching. |
| Export to PNG/SVG file | Low | `XMLSerializer` for SVG export; `canvas.toBlob()` for PNG. |
| Notes/fragments actor association | Low | `setSelected` has the hook. Visual behavior TBD. |
| Touch/mobile drag | Low | Current drag uses mouse events only. |

---

## Design Decisions Log

Preserves settled decisions. Do not relitigate without updating this section.

**Narrow store vs. wide store:** Chose narrow. `store.state` is the diagram record only. `uiState` is a separate explicit object. The normalization boundary is: "does this survive a browser refresh?" If yes → store. If no → uiState.

**Imperative dispatch vs. event/action dispatch:** Chose action dispatch. The action log is free once you have dispatch, and the log enables undo, redo, persistence, export, and eventual replay — all from the same mechanism.

**`meta.undoable: false` for non-undoable actions:** Log everything, filter on undo scan. The full log has debug value. Mid-drag dispatches are non-undoable — the whole drag gesture is one undo step, not a thousand pixel moves.

**Operation-level commands, not field-level:** `UPDATE_MESSAGE` carries all changed fields in one dispatch. The caller computes the next value. This keeps the action log readable and prevents the undo stack from recording every keystroke.

**Synchronous dispatch:** No async in the dispatch path. The only async is the custom actor modal (user input) and the Ollama API call (network). Both are out-of-band. Synchronous dispatch means DOM is always consistent with store state immediately after `dispatch()` returns.

**`requestRender()` for drag, `render()` for mutations:** The two render paths are intentionally distinct. Low-frequency mutations get immediate DOM feedback via direct `render()`. High-frequency drag events are capped at one render per animation frame via `requestRender()`. They must not be collapsed.

**Visitor pattern for property panel:** Chose `propertyVisitors` object over type switch. A type switch duplicated across `renderProperties` and `applyPropertyChange` is an open/closed violation — updating one and forgetting the other is a latent bug. The visitor is a single registration point that feeds `html`, `apply`, `announce`, and `afterRender` from one place.

**Zoom via `<g id="viewport">` transform:** Chose SVG group transform over CSS `transform: scale()` on the canvas element. The group transform keeps SVG coordinate space intact — drag math divides by `_zoom` once and is correct. CSS scaling on the element would require compensating for `getBoundingClientRect()` returning scaled values, which is more error-prone.

**`tbtn-group` divs as the wrap unit, not individual buttons:** Chose wrapping groups rather than individual buttons so related controls always stay together on one row. A "Create" group that splits Actor/Message from Note/Fragment at a narrow viewport would be confusing. Each group wraps as an atomic unit via `flex-wrap: nowrap` on the group with `flex-wrap: wrap` on the topbar. `border-left` on `.tbtn-group + .tbtn-group` replaces the `top-sep` divs — a CSS rule rather than markup for visual separation, which is cleaner when groups reflow to new rows.

**Full-width spacer as a row-break:** The old `flex: 1` spacer pushed Create left and everything else right on wide viewports. With `flex-wrap`, a `flex: 1 1 100%; height: 0` spacer takes the full row width (invisible, zero height), forcing subsequent groups onto a new row on narrow viewports, while on wide viewports it just stretches to fill the gap as before. Same element, two behaviors — no media queries needed.

**Redo stack as a captured-snapshot stack, not a log replay:** Chose snapshot capture over log replay. Log replay would require re-executing every action forward from a branch point, which is correct for CRDTs but fragile for a single-user editor — any handler with side effects would fire again. Snapshot capture is O(1) per redo step, deterministic, and consistent with how undo already works.

**Redo pushes to the undo stack before restoring:** A redo that cannot itself be undone would be a footgun — you could redo into a state you can't escape. `REDO` snapshots current state onto `_snapshots` before restoring, so the redo step appears in the undo stack and `Ctrl+Z` after `Ctrl+Y` always works.

**`pushSnapshot()` as the single redo-invalidation point:** Any new undoable mutation calls `pushSnapshot()`. Clearing `_redoStack` there means every mutation path — ADD_ACTOR, UPDATE_MESSAGE, CLEAR_DIAGRAM, drag-end, etc. — invalidates the redo stack without any call site needing to know about it. The rule "new action kills forward history" is enforced once, not scattered.

**`state:restored` carries `direction` field:** The event payload now includes `direction: 'undo' | 'redo'`. Listeners can branch on it for toast wording or future animation. The field is additive — existing listeners that ignore the payload are unaffected.

**Conditional `Object.freeze()` on `_ref`, not unconditional:** Freeze is applied only when `obj._preview` is falsy — i.e. only on live store objects. Preview scratch objects (`_preview: true`) must stay writable because the palette form harvests edited values back from them before calling `dispatch`. Unconditional freeze would silently break the palette preview → add workflow. The `_preview` flag is already the correct discriminant; the freeze simply follows it. The direct `uiState.selected` assignment in `showPalettePreview` was also consolidated into `_wrapSelected` so there is now a single code path that enforces the freeze rule.

**`canUndo` / `canRedo` as store getters, not log scans:** Chose getters over `log.filter(...)` at call sites. The getter reads `_snapshots.length` directly — the actual source of truth for undo availability. Log scans count all-time undoable actions, which diverges from stack depth after the limit (50) is hit. `canRedo` is reserved as a false-returning getter so redo work has a clean hook without touching call sites.

**`_source` as a payload convention, not a store field:** `LOAD_DIAGRAM` accepts `payload._source` as a caller hint (`'localStorage' | 'import'`), forwards it in the `diagram:loaded` event payload, but never writes it to `store.state`. The state record stays clean — `_source` is routing metadata for the UI layer, not diagram data. `LOAD_DEMO` hardcodes `source: 'demo'` in the emit. Listeners branch on `p?.source` to pick the right toast message (or stay silent on boot restore).

**`_saveDiagram()` called at the end of `render()`:** Save-on-render rather than save-on-dispatch. `render()` is already the single convergence point for all state mutations. This guarantees persistence without wiring individual dispatch handlers. The cost is one `JSON.stringify` per render — acceptable at current diagram sizes. If profiling ever shows it as a bottleneck, replace with a debounced save-on-dispatch, but do not pre-optimize.

**Undo history intentionally not persisted:** `localStorage` saves `store.state` only. The snapshot stack is in-memory by design — `LOAD_DIAGRAM` clears it as a new baseline. This is documented in the INIT boot sequence comment and is expected behavior.

**IIFE inlining for single-file deployment:** `sequence-builder.store.js` is the canonical source. The content between `// @@STORE-START` and `// @@STORE-END` in `sequence-builder.html` is generated — do not edit it directly. Always edit `sequence-builder.store.js`, run `node sequence-builder.test.js`, then run `node build.js` to sync. `build.js` applies a rename pass on inject: `ACTOR_W`→`STORE_ACTOR_W`, `ACTOR_GAP`→`STORE_ACTOR_GAP`, `UNDO_LIMIT`→`STORE_UNDO_LIMIT` — these avoid collisions with app-level rendering constants declared outside the sentinel region. If store.js gains new module-level constants that collide, add them to the `RENAMES` array in `build.js`.

**`message:updated` listener uses `setTimeout(render, 0)`, others use `render()` directly:** Deferral was added to fix a dblclick double-fire. Root cause: `setSelected(..., 'message', true)` with `associateOnClick` enabled dispatches `UPDATE_MESSAGE` → fires `message:updated` → `render()` synchronously → rebuilds the DOM while the `dblclick` event was still propagating → new element's listener fired for the same event. `setTimeout(render, 0)` defers the rebuild until after the current event finishes. Other `*:updated` listeners remain synchronous — they don't have the same in-flight-event problem. Do not "normalize" them all to deferred without first checking whether any UI path depends on synchronous DOM updates after dispatch.

**`_msgClickTimer` at module scope, not per-closure:** Single-click kind-cycle uses a 220ms debounce timer. Originally declared `let _clickTimer = null` inside `renderMessage` — each `render()` call created a new element with a fresh closure and a fresh `null` timer. The dblclick handler was clearing its own closure's timer, never the one set by the preceding click events. Fixed by hoisting to `_msgClickTimer` at module scope between `render()` and `renderActor()`. One shared reference across all render cycles. Pattern: any debounce timer that must be cancellable across render cycles belongs at module scope.

**Canvas handler skips messages:** `svg.addEventListener('click')` originally selected messages and called `render()` synchronously on every click — including message clicks that had already been handled by the message's own handler. Messages now have an early-return guard in the canvas handler (`if (type === 'message') return`). Messages self-manage selection, kind-cycle, and direction-cycle. The canvas handler owns actors, notes, and fragments only. Canvas handler `render()` is also deferred via `setTimeout(render, 0)` for the same in-flight-event reason.

**Debug log pre-captures mutable values:** `ref.direction` read after `store.dispatch()` was logging the post-mutation value, making the `was=` field in `msg-dblclick` appear wrong. Fixed by capturing `const wasDir = ref.direction` before dispatch. Rule: any debug log that records "before" state must capture it before the mutation, not after. Store objects are mutated in place — reading a property after dispatch gives you the new value.

---

## For a Fresh AI Instance

**One-sentence summary:** SequenceForge is a single-file HTML app (~3410 lines, no build) that lets users visually build UML sequence diagrams and export PlantUML or Mermaid syntax — with a narrow DiagramStore, synchronous action dispatch, rAF-batched drag rendering, localStorage persistence (save-on-render, JSON export/import), a full undo/redo stack (50 steps each, branching-history invalidation), a SVG viewport zoom system, a visitor-pattern property panel, and a node-runnable test suite targeting WCAG 2.2 AA.

**The four things most likely to confuse you:**

1. **`const state = _store.state` is a read-only alias.** The render and serialize code uses `state.actors`, `state.messages` etc. throughout — that's fine, it's a live reference. Mutations must go through `_store.dispatch()`. Writing directly to `state.actors.push(...)` bypasses the log and undo will not see it.

2. **`uiState.selected._ref` points into a live store object — read it, don't write it.** Mutations go through `dispatch(UPDATE_*)`. The `_preview: true` flag means the object is not in any store array — the `+` button harvests preview values and passes them to `dispatch()`.

3. **`render()` and `requestRender()` are both correct depending on context.** `render()` is for mutations (immediate). `requestRender()` is for drag (rAF-batched). Do not replace all `render()` calls with `requestRender()` — that would introduce a one-frame lag on every add/delete/undo. `_saveDiagram()` is called at the end of `render()` — it will not fire on drag frames, only on committed mutations.

4. **Never edit the `// @@STORE-START` … `// @@STORE-END` block in the HTML directly.** That region is generated by `build.js` from `sequence-builder.store.js`. Edit the `.js` file, run tests, then `node build.js`. The build applies a rename pass for constants that would collide with app-level names (`ACTOR_W`→`STORE_ACTOR_W`, etc.) — those renames live in the `RENAMES` array in `build.js`.

5. **`_wrapSelected` must freeze a copy, not the live store object:** `Object.freeze(obj)` was called directly on the store object passed to `_wrapSelected`. In a classic HTML `<script>` tag, `'use strict'` inside a nested block does not promote the whole script to strict mode — frozen property assignment silently no-ops rather than throwing. Result: any message selected by the user became permanently immutable in the store; subsequent `UPDATE_MESSAGE` dispatches found the object, attempted the field assignment, silently did nothing, and emitted the unchanged (still-frozen) object. Fix: `Object.freeze({ ...obj })` — freeze a shallow copy for `_ref`, leave the original live store object writable. The copy enforces the UI layer's read-only contract on `_ref` without poisoning the store object that `dispatch` must still mutate. Note: if store objects ever gain nested mutable sub-objects, a deep-freeze-copy would be required; shallow copy is correct for the current flat schema.

**`REFLOW_ACTORS` for single-snapshot batch move:** Dragging an actor between two others requires moving multiple actors in one undoable step. Dispatching N individual `MOVE_ACTOR` actions would push N snapshots — one Ctrl+Z per actor. `REFLOW_ACTORS` accepts `payload.positions: [{id, x}]`, calls `pushSnapshot()` once, then mutates all actors in a loop. All mid-drag `MOVE_ACTOR` dispatches remain `undoable: false` as before — only the final drop commit is undoable. The reflow sort key is the actors' current X positions at drop time (the dragged actor is already at its drop position from the last non-undoable move). Clean spacing is `40 + i * (ACTOR_W + ACTOR_GAP)` — same formula as `getNextActorX()`. The `changed` check prevents a no-op dispatch when the actor is dropped in its original slot.

**`place-actor` mode follows the `connect` mode pattern:** Both are modal canvas states toggled by a toolbar button and a keyboard shortcut, managed by `setMode()`, visualised by a CSS class on `#canvas-wrap`, and exited by Escape or task completion. The ghost actor is driven by `uiState.placeGhostX` (not store state — it doesn't survive a render cycle reset, which is correct; it's purely transient UI). Ghost is rendered at the end of the actors layer so it sits above all other actors visually. `ADD_ACTOR` accepts `payload.x` with `??` fallback to `getNextActorX()` — this is additive and backward-compatible; all existing call sites omit `x` and get the old sequential placement. The mode exits to `select` after one placement; staying in place-mode for batch placement is a valid future enhancement.

**Fragment resize via SE handle, `_resizeHandle` on `dragging` object:** Resize state is carried on the existing `dragging` object as `dragging._resizeHandle = 'se'` rather than a third module-scope drag variable. Mousemove branches on `dragging._resizeHandle` before the move dispatch block — when set, it computes new `w/h` from the SE corner position and dispatches non-undoable `RESIZE_FRAGMENT`. Mouseup commits one undoable `RESIZE_FRAGMENT` using the final `dragging.w / dragging.h` (which the store has kept current via in-place mutation). `_resizeHandle` is explicitly cleared to `null` on normal move-drag start so a prior resize session can't bleed into a subsequent move. Min size 60×40 enforced in mousemove math. The handle element uses `data-type="frag-resize"` (not `"fragment"`) so the mousedown guard identifies it separately before the actor/note/fragment move guard. SE corner only — sufficient for the use case; adding NW/NE/SW handles would require tracking the anchored corner and adjusting both position and size simultaneously.

**Click-to-cycle-kind removed from messages (Option A):** Single-click on a message now selects it and opens the Properties panel. Direction is still cycled by double-click. Kind is changed via the Properties panel `Kind` dropdown only. Rationale: the 220ms debounce timer existed entirely to disambiguate click from dblclick — it was the root cause of every message interaction bug across v0.9.10–0.9.12. Removing click-to-cycle-kind eliminated: `_msgClickTimer`, `_msgDblclickPending`, the `setTimeout(render, 0)` deferral on `message:updated`, the `associateOnSelect=false` workaround, and all the click/dblclick race conditions. `message:updated` listener now calls `render()` directly like all other `*:updated` listeners — the deferral was only needed to prevent the in-flight click event from hitting a freshly rebuilt DOM element. Net: −19 lines, zero timing dependencies, no race conditions possible between click and dblclick.

**`_msgDblclickPending` flag (superseded by v0.9.13 Option A):** Was module-scope flag set by dblclick handler before `clearTimeout` to bail the kind-cycle timer even if it had already fired. Documented here for history — the entire mechanism was deleted in v0.9.13 when click-to-cycle-kind was removed.

**`associateOnSelect=false` for kind-cycle click (superseded by v0.9.13 Option A):** Was a fix for double-dispatch caused by kind-cycle click calling `setSelected(..., true)`. Documented here for history — the kind-cycle click was deleted in v0.9.13.

**`DEBUG_VERBOSE` flag for high-frequency diagnostics:** Three `dbg()` calls fire on every render cycle or every save tick — `msg:updated`, `save`, and `msg-dblclick`. Unconditional, they flood the debug console during normal use, obscuring genuinely useful lower-frequency signals. Gated behind `const DEBUG_VERBOSE = false` declared in the debug console block. All other `dbg()` calls remain unconditional because they are one-per-gesture (actor-click, canvas-click, undo, redo, etc.) and have ambient diagnostic value without noise. `assoc-fallback` is explicitly kept unconditional — it fires only when the association heuristic takes the fallback path, which is a meaningful signal worth always seeing. Rule: gate calls that fire faster than user gesture rate; leave calls that fire at gesture rate or slower.

**`message:updated` defers render; other listeners do not — this is intentional.** `_store.on('message:updated', () => { setTimeout(render, 0) })` while all other `*:updated` listeners call `render()` synchronously. Do not normalize them. The asymmetry exists because message click/dblclick handlers dispatch mid-event and synchronous DOM rebuild caused the new element to receive the same in-flight event. See Design Decisions Log for full context.

**Syntax check gate:** always run `node --check` on the extracted `<script>` block before opening in a browser. The extraction command is in the File Layout section above. String replacement passes are the most common source of syntax errors — a missing brace or mismatched template literal is invisible until runtime.
