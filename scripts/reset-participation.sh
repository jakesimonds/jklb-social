#!/bin/bash
# Reset participation trophy for jakesimonds.com
# Deletes: PDS records + KV member record + adjusts counter + cleans members index
#
# Usage: ./scripts/reset-participation.sh
# Requires: wrangler CLI authenticated (for OAuth token), and a Bluesky app password
#
# NOTE: wrangler kv CLI (v4.60) has a bug where list/get return empty.
# This script uses the Cloudflare REST API directly instead.

set -euo pipefail

DID="did:plc:aurnkk6uy6axy66uqaq6dqy6"
HANDLE="jakesimonds.com"
COLLECTION="social.jklb.participationTrophy"
KV_NAMESPACE="028ad3d73d0c4b869ced62e4d83db8c5"
CF_ACCOUNT="ea726a9742c4be46f89d0a052057140b"
PDS="https://bsky.social"

# Get Cloudflare OAuth token from wrangler config
CF_TOKEN=$(python3 -c "
import tomllib, os
path = os.path.expanduser('~/Library/Preferences/.wrangler/config/default.toml')
with open(path, 'rb') as f:
    print(tomllib.load(f)['oauth_token'])
" 2>/dev/null)

if [ -z "$CF_TOKEN" ]; then
    echo "ERROR: Could not read wrangler OAuth token. Run 'npx wrangler login' first."
    exit 1
fi

CF_KV_BASE="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/storage/kv/namespaces/$KV_NAMESPACE"
CF_AUTH="Authorization: Bearer $CF_TOKEN"

echo "=== Resetting participation trophy for $HANDLE ($DID) ==="

# ─── 1. Delete PDS records ───────────────────────────────────────────────────
echo ""
echo "--- PDS: Listing $COLLECTION records ---"

RECORDS=$(curl -s "$PDS/xrpc/com.atproto.repo.listRecords?repo=$DID&collection=$COLLECTION&limit=50")
RKEYS=$(echo "$RECORDS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data.get('records', []):
    print(r['uri'].split('/')[-1])
" 2>/dev/null || true)

if [ -z "$RKEYS" ]; then
    echo "No PDS records found. Skipping."
else
    COUNT=$(echo "$RKEYS" | wc -l | tr -d ' ')
    echo "Found $COUNT PDS record(s) to delete. Need Bluesky credentials."
    read -rp "Bluesky handle (e.g. jakesimonds.com): " BS_HANDLE
    read -rsp "App password: " BS_PASSWORD
    echo ""

    echo "Creating session..."
    SESSION=$(curl -s -X POST "$PDS/xrpc/com.atproto.server.createSession" \
        -H "Content-Type: application/json" \
        -d "{\"identifier\": \"$BS_HANDLE\", \"password\": \"$BS_PASSWORD\"}")

    ACCESS_TOKEN=$(echo "$SESSION" | python3 -c "import json,sys; print(json.load(sys.stdin)['accessJwt'])" 2>/dev/null)

    if [ -z "$ACCESS_TOKEN" ]; then
        echo "ERROR: Failed to authenticate. Check credentials."
        echo "Response: $SESSION"
        exit 1
    fi
    echo "Authenticated."

    for RKEY in $RKEYS; do
        echo "Deleting PDS record: $RKEY"
        curl -s -X POST "$PDS/xrpc/com.atproto.repo.deleteRecord" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -d "{\"repo\": \"$DID\", \"collection\": \"$COLLECTION\", \"rkey\": \"$RKEY\"}"
        echo " done"
    done
fi

# ─── 2. Delete KV member record ──────────────────────────────────────────────
echo ""
echo "--- KV: Deleting member record ---"
RESP=$(curl -s -X DELETE "$CF_KV_BASE/values/member:$DID" -H "$CF_AUTH")
SUCCESS=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',''))" 2>/dev/null || echo "")
if [ "$SUCCESS" = "True" ]; then
    echo "Deleted member record."
else
    echo "Delete response: $RESP"
fi

# ─── 3. Adjust participation counter ─────────────────────────────────────────
echo ""
echo "--- KV: Adjusting participation counter ---"
COUNTER=$(curl -s "$CF_KV_BASE/values/participation:counter" -H "$CF_AUTH" 2>/dev/null)
if [ -n "$COUNTER" ] && echo "$COUNTER" | grep -qE '^[0-9]+$'; then
    NEW_COUNTER=$((COUNTER - 1))
    if [ "$NEW_COUNTER" -lt 0 ]; then NEW_COUNTER=0; fi
    echo "Counter was $COUNTER, setting to $NEW_COUNTER"
    curl -s -X PUT "$CF_KV_BASE/values/participation:counter" \
        -H "$CF_AUTH" \
        -H "Content-Type: text/plain" \
        --data-raw "$NEW_COUNTER" > /dev/null
    echo "Done."
else
    echo "No counter found or not a number: '$COUNTER'"
fi

# ─── 4. Clean members index ──────────────────────────────────────────────────
echo ""
echo "--- KV: Cleaning members index ---"
INDEX=$(curl -s "$CF_KV_BASE/values/community:members" -H "$CF_AUTH" 2>/dev/null)
if echo "$INDEX" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
    NEW_INDEX=$(echo "$INDEX" | python3 -c "
import json, sys
members = json.load(sys.stdin)
members = [m for m in members if m != '$DID']
print(json.dumps(members))
")
    echo "Removing $DID from members index"
    curl -s -X PUT "$CF_KV_BASE/values/community:members" \
        -H "$CF_AUTH" \
        -H "Content-Type: text/plain" \
        --data-raw "$NEW_INDEX" > /dev/null
    echo "Done."
else
    echo "No valid members index found."
fi

echo ""
echo "=== Done! $HANDLE can now re-claim their participation trophy ==="
