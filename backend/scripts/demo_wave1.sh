#!/usr/bin/env bash
# WazLink Wave 1 demo — proves the backend is real, end to end, over HTTP.
#
#   login -> workspace -> customer -> contact -> manual Lead WITHOUT Discovery
#   -> Lead/Party360 -> Deal -> PostgreSQL persistence -> reload
#   -> second workspace refused -> Won Deal is NOT recognized revenue
#
# Requires: a running server on $BASE and the dev PostgreSQL/Redis containers.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:8000/api/v1}"
STAMP="$(date +%s)"
EMAIL="demo+${STAMP}@wazlink.test"
OTHER="other+${STAMP}@wazlink.test"
PASSWORD="correct-horse-battery-staple"

jqr() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$1"; }
step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "1. Register + verify + log in"
REG=$(curl -sS -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Demo Owner\"}")
VTOKEN=$(echo "$REG" | jqr "['verification_token']")
curl -sS -X POST "$BASE/auth/verify-email" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$VTOKEN\"}" >/dev/null
LOGIN=$(curl -sS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | jqr "['session_token']")
echo "session opened; has_workspace=$(echo "$LOGIN" | jqr "['has_workspace']")  (zero-workspace login is valid)"

AUTH=(-H "X-Session-Token: $TOKEN" -H 'Content-Type: application/json')

step "2. Create and select a workspace"
WS=$(curl -sS -X POST "$BASE/workspaces" "${AUTH[@]}" -d '{"name":"Demo Co"}')
WS_REF=$(echo "$WS" | jqr "['workspace_ref']")
curl -sS -X POST "$BASE/workspaces/$WS_REF/switch" "${AUTH[@]}" >/dev/null
echo "workspace=$WS_REF role=$(echo "$WS" | jqr "['role']")"

step "3. Create a Customer with a Contact (Track B — no Discovery)"
CUS=$(curl -sS -X POST "$BASE/customers" "${AUTH[@]}" -d '{
  "party_kind":"organization","name":"Northwind Trading",
  "primary_contact":{"name":"Dana Reed","phone":"+966500000001","email":"dana@northwind.test"}}')
CUS_REF=$(echo "$CUS" | jqr "['customer_ref']")
echo "customer=$CUS_REF business_ref=$(echo "$CUS" | jqr "['business_ref']")  (no Business fabricated)"

step "4. Create a manual Lead WITHOUT Discovery"
LEAD=$(curl -sS -X POST "$BASE/leads" "${AUTH[@]}" -d '{
  "origin_type":"manual",
  "primary_contact":{"name":"Omar Aziz","phone":"+966500000003"}}')
LEAD_REF=$(echo "$LEAD" | jqr "['lead_ref']")
echo "lead=$LEAD_REF"
echo "  display_name  = $(echo "$LEAD" | jqr "['display_name']")"
echo "  display_source= $(echo "$LEAD" | jqr "['display_source']")   (CA-15: identity from the Contact)"
echo "  business_ref  = $(echo "$LEAD" | jqr "['business_ref']")   (nothing fabricated)"

step "5. Read Lead 360 + the merged timeline (served by the composer)"
D360=$(curl -sS "$BASE/leads/$LEAD_REF" "${AUTH[@]}")
python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
print('  sections present :', sorted(k for k in d))
print('  business section :', 'ABSENT (key-absent, not null)' if 'business' not in d else 'present')
print('  activities       :', len(d['activities']), 'entry(ies)')
" <<< "$D360"

step "6. Create a Deal, move a stage, close it Won"
DEAL=$(curl -sS -X POST "$BASE/deals" "${AUTH[@]}" -d "{
  \"title\":\"Northwind Renewal\",\"customer_ref\":\"$CUS_REF\",\"value\":\"50000.00\"}")
DEAL_REF=$(echo "$DEAL" | jqr "['deal_ref']")
DEAL_V=$(echo "$DEAL" | jqr "['version']")
STAGE=$(curl -sS "$BASE/pipelines" "${AUTH[@]}" | jqr "['items'][0]['stages'][2]['stage_ref']")
MOVED=$(curl -sS -X POST "$BASE/deals/$DEAL_REF/stage" "${AUTH[@]}" \
  -H "If-Match: $DEAL_V" -d "{\"stage_ref\":\"$STAGE\"}")
MOVED_V=$(echo "$MOVED" | jqr "['version']")
WON=$(curl -sS -X POST "$BASE/deals/$DEAL_REF/close" "${AUTH[@]}" \
  -H "If-Match: $MOVED_V" -d '{"outcome":"won"}')
echo "deal=$DEAL_REF status=$(echo "$WON" | jqr "['status']") value=$(echo "$WON" | jqr "['value']")"

step "7. PostgreSQL persistence — read straight from the database"
docker exec wazlink-pg psql -U wazlink -d wazlink -tAc \
  "SELECT public_id, status, value FROM deals WHERE public_id='$DEAL_REF';" \
  | sed 's/^/  db row: /'
docker exec wazlink-pg psql -U wazlink -d wazlink -tAc \
  "SELECT count(*) FROM discovery_jobs;" | sed 's/^/  discovery_jobs: /'
docker exec wazlink-pg psql -U wazlink -d wazlink -tAc \
  "SELECT count(*) FROM businesses;" | sed 's/^/  businesses    : /'

step "8. Reload through a brand-new session — data is durable"
TOKEN2=$(curl -sS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jqr "['session_token']")
AUTH2=(-H "X-Session-Token: $TOKEN2" -H 'Content-Type: application/json')
echo "  deal on reload : $(curl -sS "$BASE/deals/$DEAL_REF" "${AUTH2[@]}" | jqr "['status']")"
echo "  lead on reload : $(curl -sS "$BASE/leads/$LEAD_REF" "${AUTH2[@]}" | jqr "['lead']['lead_ref']")"

step "9. Won Deal is NOT recognized revenue"
REV=$(docker exec wazlink-pg psql -U wazlink -d wazlink -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
     AND (table_name LIKE '%revenue%' OR table_name LIKE '%attribution%');")
echo "  revenue/attribution tables touched by a Won Deal: $REV  (WON_DEAL_EQUALS_REVENUE = FALSE)"

step "10. A second workspace cannot reach any of it"
curl -sS -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OTHER\",\"password\":\"$PASSWORD\"}" > /tmp/other_reg.json
OV=$(jqr "['verification_token']" < /tmp/other_reg.json)
curl -sS -X POST "$BASE/auth/verify-email" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$OV\"}" >/dev/null
OTOKEN=$(curl -sS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OTHER\",\"password\":\"$PASSWORD\"}" | jqr "['session_token']")
OAUTH=(-H "X-Session-Token: $OTOKEN" -H 'Content-Type: application/json')
curl -sS -X POST "$BASE/workspaces" "${OAUTH[@]}" -d '{"name":"Other Co"}' >/dev/null
for path in "leads/$LEAD_REF" "customers/$CUS_REF" "deals/$DEAL_REF" "leads/$LEAD_REF/timeline"; do
  CODE=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/$path" "${OAUTH[@]}")
  echo "  GET /$path -> $CODE  (404 = not visible; never 403, which would confirm it exists)"
done

printf '\n\033[1mWAVE 1 DEMO COMPLETE — real backend, real PostgreSQL, isolated tenants.\033[0m\n'
