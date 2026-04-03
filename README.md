# SequenceForge

> A single-file, zero-dependency UML sequence diagram builder.  
> Runs entirely in the browser. No build step. npm install only for Playwright render tests.

**[Live demo — v0.9.92](https://MeatPopSci1972.github.io/sequence-builder/releases/v0.9.92/sequence-builder.html)** &nbsp;|&nbsp; **[All releases](https://github.com/MeatPopSci1972/sequence-builder/releases)**

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

- **Suite 1** — REFLOW_ACTORS tests
- **Suite 2** — DELETE_ACTOR cascade
- **Suite 3** — UPDATE_MESSAGE partial patch
- **Suite 4** — meta.undoable = false
- **Suite 5** — UNDO
- **Suite 6** — REDO
- **Suite 7** — _parseUML (PlantUML + Mermaid parser)
- **Suite 8** — End-to-End scenario
- **Suite 9** — UI geometry contracts & proto2prod guard rails
- **Suite 10** — ADD_MESSAGE null contract
- **Suite 11** — Message label contract & inline edit
- **Suite 12** — autoFitOnLoad preference
- **Suite 13** — Fragment geometry contracts
- **Suite 14** — Canvas pan & arrow-key nudge contracts
- **Suite 15** — Properties bag contracts
- **Suite 16** — Regex contract tests

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
| `package.json` | |
| `sequence-builder.html` | |
| `sequence-builder.store.js` | |
| `sequence-builder.test.js` | |
| `sf-endpoints.js` | |
| `sf-preflight.ps1` | |
| `sf-readme-gen.js` | |
| `sf-server.js` | |
| `themes.json` | |

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
# Expected: 127 passed | 0 failed | 127 total
```

Or via the dev server: `GET http://localhost:3799/test`

---

## Tech stack

Vanilla JS, SVG, HTML5 Canvas. No frameworks, no bundler, no runtime dependencies.

---

## License

MIT
