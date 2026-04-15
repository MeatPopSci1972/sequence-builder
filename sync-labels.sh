#!/bin/bash
# sync-labels.sh — idempotent label sync for Sequence Builder
#
# Upserts every label below: creates if missing, updates if colour/description
# has changed. Safe to run multiple times. Does NOT delete labels not in this
# file — remove manually if needed (labels in use can't be force-deleted anyway).
#
# Usage:
#   GITHUB_TOKEN=ghp_yourtoken bash sync-labels.sh
#
# Token needs: repo scope (or public_repo for public repos)
# Get one at:  https://github.com/settings/tokens
#
# To add a label:    add a upsert_label line in the relevant section below
# To rename:         change the name field AND add old_name as 4th arg
# To recolour:       change the color field, rerun
# To retire:         comment out the line (manual delete on GitHub if needed)
#
# Column guide:
#   upsert_label  "name"          "rrggbb"  "description"

REPO="MeatPopSci1972/sequence-builder"
API="https://api.github.com/repos/${REPO}/labels"
AUTH="Authorization: Bearer ${GITHUB_TOKEN}"

# ── upsert_label ──────────────────────────────────────────────────────────────
# Args: name, color, description, [old_name_to_rename_from]
upsert_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  local old_name="${4:-}"

  local lookup="${old_name:-$name}"
  local encoded
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${lookup}'))")

  local existing
  existing=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "$AUTH" "${API}/${encoded}")

  local payload
  payload=$(python3 -c "
import json
print(json.dumps({'name': '$name', 'color': '$color', 'description': '$description'}))
")

  if [ "$existing" = "200" ]; then
    result=$(curl -s -X PATCH "${API}/${encoded}" \
      -H "$AUTH" -H "Content-Type: application/json" -d "$payload" \
      | python3 -c "import sys,json; r=json.load(sys.stdin); print('  updated:', r.get('name','ERR'))")
  else
    result=$(curl -s -X POST "$API" \
      -H "$AUTH" -H "Content-Type: application/json" -d "$payload" \
      | python3 -c "import sys,json; r=json.load(sys.stdin); print('  created:', r.get('name','ERR: '+str(r)))")
  fi

  echo "$result"
}

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN is not set."
  echo "Usage: GITHUB_TOKEN=ghp_yourtoken bash sync-labels.sh"
  exit 1
fi

echo "Syncing labels for ${REPO}..."

# ── ROUTING ───────────────────────────────────────────────────────────────────
# Who / what executes this issue
echo ""
echo "--- routing ---"
upsert_label "for_cowork"    "0075ca" "Autonomous execution ready — Cowork can run this"
upsert_label "for_session"   "e4e669" "Requires Claude conversation — judgment needed"
upsert_label "rfc"           "d93f0b" "Design spike — no implementation until gate condition met"

# ── TYPE ──────────────────────────────────────────────────────────────────────
# What kind of work
echo ""
echo "--- type ---"
upsert_label "fix"           "d73a4a" "Bug repair"
upsert_label "feat"          "0e8a16" "New capability"
upsert_label "chore"         "fef2c0" "Hygiene, rename, cleanup"
upsert_label "refactor"      "c5def5" "Structural change, no behaviour change"
upsert_label "accessibility" "1d76db" "WCAG / keyboard / screen reader"

# ── SCOPE ─────────────────────────────────────────────────────────────────────
# Where in the codebase
echo ""
echo "--- scope ---"
upsert_label "ui"            "bfd4f2" "Rendering, CSS, HTML structure"
upsert_label "store"         "bfe5bf" "State management"
upsert_label "server"        "f9d0c4" "sf-server.js, endpoints"
upsert_label "tour"          "e99695" "Tour system"
upsert_label "tests"         "c2e0c6" "Test suite only"

# ── PRIORITY ──────────────────────────────────────────────────────────────────
# When to pick this up
echo ""
echo "--- priority ---"
upsert_label "next-priority" "e11d48" "Owner-designated next item"
upsert_label "icebox"        "ededed" "Parked — not current cycle"
upsert_label "hotfix"        "b60205" "Drop everything"
upsert_label "regression"    "b60205" "Drop everything — broken behaviour"

echo ""
echo "Done. https://github.com/${REPO}/labels"
