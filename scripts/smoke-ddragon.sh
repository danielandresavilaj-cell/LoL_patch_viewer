#!/usr/bin/env sh
# Smoke check against public Data Dragon (no auth).
set -eu
BASE="${DDRAGON_BASE:-https://ddragon.leagueoflegends.com}"
echo "GET $BASE/api/versions.json"
curl -sS -f "$BASE/api/versions.json" | head -c 120
echo
VERSION="$(curl -sS -f "$BASE/api/versions.json" | sed -n 's/.*"\([^"]*\)".*/\1/p' | head -1)"
# Prefer first element via node if available
VERSION="$(node -e "fetch('$BASE/api/versions.json').then(r=>r.json()).then(v=>{console.log(v[0])})")"
echo "Latest version: $VERSION"
echo "GET champion.json"
curl -sS -f -o /dev/null -w "HTTP %{http_code}\n" \
  "$BASE/cdn/$VERSION/data/en_US/champion.json"
echo "OK"
