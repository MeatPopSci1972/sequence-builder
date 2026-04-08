# SequenceForge

> A single-file, zero-dependency UML sequence diagram builder.  
> Runs entirely in the browser. No build step. npm install only for Playwright render tests.

**[Live demo — v0.9.96](https://MeatPopSci1972.github.io/sequence-builder/releases/v0.9.96/sequence-builder.html)** &nbsp;|&nbsp; **[All releases](https://github.com/MeatPopSci1972/sequence-builder/releases)**

---

## Quick start

```bash
git clone https://github.com/MeatPopSci1972/sequence-builder
cd sequence-builder
node launcher.js        # dev server with hot-reload at http://localhost:3799
```

Open `http://localhost:3799` in your browser.

---

## What it does

Capabilities pinned by the contract test suites:

- ADD_ACTOR
- DELETE_ACTOR cascade
- UPDATE_MESSAGE
- meta.undoable
- UNDO
- REDO
- _parseUML
- end-to-end
- bounding boxes + selection
- message label + inline edit
- canvas pan + nudge
- schema + properties
- regex contracts
- ULID ID contract
- ActorElement contract
- MessageElement contract
- NoteElement contract
- FragmentElement contract

---

## Repository structure

| File | Notes |
|------|-------|
| `LICENSE` | |
| `README.md` | |
| `build.js` | |
| `launcher.js` | |
| `lint.js` | |
| `log.html` | |
| `sequence-builder.html` | |
| `sequence-builder.store.js` | |
| `sequence-builder.test.js` | |
| `sf-endpoints.js` | |
| `sf-readme-gen.js` | |
| `sf-server.js` | |
| `src/elements/ActorElement.js` | |
| `src/elements/ElementFactory.js` | |
| `src/elements/FragmentElement.js` | |
| `src/elements/MessageElement.js` | |
| `src/elements/NoteElement.js` | |
| `src/elements/SequenceElement.js` | |

---

## Dev server API

Served by `sf-server.js` via `launcher.js` on port 3799.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Session bootstrap — version, git, demos |
| GET | `/HANDOFF.md` | Session handoff doc |
| GET | `/api` | Endpoint reference JSON (this) |
| GET | `/usage` | AI usage guide plain text |
| GET | `/log` | Server event log JSON |
| GET | `/git-log` | git log --oneline JSON. Default n=20 |
| GET | `/test` | Run build+tests — returns HTML report |
| GET | `/test-render` | Playwright render gate — 3 demos x 5 SVG layers |
| GET | `/validate-readme` | Check README link+label for vX.Y.Z. Returns {ok,hasLink,hasLabel} |
| GET | `/slice` | Return named sentinel section of a file. No section = manifest |
| POST | `/generate-readme` | Generate README.md from live sources — git, test suites, endpoints, version |
| POST | `/build` | Run build.js — sync store.js into HTML |
| POST | `/lint` | Run lint.js — button count, SVG balance, sentinels |
| POST | `/patch` | Find-replace in file. Body:{file,anchor,replace}. Flex whitespace matching. Returns {ok,replaced,length} |
| POST | `/git` | git add -A && commit. Body:{message} |
| POST | `/git-restore` | Restore tracked file to HEAD. Body:{file} |
| POST | `/tag` | Create annotated git tag. Body:{tag,message} |
| POST | `/changelog` | Auto-gen CHANGELOG.md from git log since last tag. Body:{version} |
| POST | `/update-handoff` | Populate live fields in HANDOFF.md from status+test+test-render |
| POST | `/snapshot?v=X.Y.Z` | Copy build+HANDOFF to releases/vX.Y.Z/ |
| GET | `/<file>` | Read any file in repo root |
| PUT | `/<file>` | Write any file in repo root. ?verify=1 returns {ok,wrote,status} |

---

## Running the tests

```bash
node build.js && node sequence-builder.test.js
# Expected: 170 passed | 0 failed | 170 total
```

Or via the dev server: `GET http://localhost:3799/test`

---

## Tech stack

Vanilla JS, SVG, HTML5 Canvas. No frameworks, no bundler, no runtime dependencies.

---

## License

MIT
