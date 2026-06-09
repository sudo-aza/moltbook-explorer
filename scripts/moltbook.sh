#!/usr/bin/env bash
# moltbook.sh — CLI wrapper for the Moltbook API
#
# Usage:
#   ./scripts/moltbook.sh <endpoint> [method] [data]
#
# Examples:
#   ./scripts/moltbook.sh /agents/me
#   ./scripts/moltbook.sh /feed                    # GET hot feed
#   ./scripts/moltbook.sh /feed?sort=new           # with query params
#   ./scripts/moltbook.sh /posts POST '{"submolt_name":"general","title":"Hi","content":"Hello"}'
#   ./scripts/moltbook.sh /posts/abc123/upvote POST
#   ./scripts/moltbook.sh /submolts/general/subscribe POST
#
# Proxies are auto-discovered and credentials loaded from ~/.config/moltbook/credentials.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS_FILE="${HOME}/.config/moltbook/credentials.json"
PROXY_CACHE="${SCRIPT_DIR}/.moltbook_proxies"

# --- Load credentials ---
if [ ! -f "$CREDS_FILE" ]; then
  echo "ERROR: Credentials not found at $CREDS_FILE" >&2
  exit 1
fi
API_KEY=$(python3 -c "import json; print(json.load(open('$CREDS_FILE'))['api_key'])")
BASE_URL="https://www.moltbook.com/api/v1"

# --- Parse arguments ---
ENDPOINT="${1:?Usage: moltbook.sh <endpoint> [method] [data_json]}"
METHOD="${2:-GET}"
DATA="${3:-}"

# Build full URL
URL="${BASE_URL}${ENDPOINT}"

# --- Discover working proxies ---
discover_proxies() {
  python3 -c "
import urllib.request, json, ssl, concurrent.futures

resp = urllib.request.urlopen('https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=json&timeout=3000', timeout=10)
data = json.loads(resp.read())
proxies = [f\"http://{p['ip']}:{p['port']}\" for p in data.get('proxies', []) if p.get('protocol') == 'http'][:20]

api_key = '${API_KEY}'

def test(px):
    try:
        ph = urllib.request.ProxyHandler({'https': px, 'http': px})
        hh = urllib.request.HTTPSHandler(context=ssl._create_unverified_context())
        o = urllib.request.build_opener(ph, hh)
        r = urllib.request.Request('https://www.moltbook.com/api/v1/agents/me',
            headers={'Authorization': f'Bearer {api_key}'})
        o.open(r, timeout=6)
        return px
    except:
        return None

with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
    results = [r for r in ex.map(test, proxies) if r]

print('\n'.join(results[:5]))
" 2>/dev/null
}

get_proxies() {
  # Use cached proxies if less than 10 minutes old
  if [ -f "$PROXY_CACHE" ]; then
    cache_age=$(( $(date +%s) - $(stat -c %Y "$PROXY_CACHE" 2>/dev/null || echo 0) ))
    if [ "$cache_age" -lt 600 ]; then
      cat "$PROXY_CACHE"
      return
    fi
  fi

  # Discover fresh proxies
  echo "Discovering proxies..." >&2
  discovered=$(discover_proxies)
  if [ -n "$discovered" ]; then
    echo "$discovered" > "$PROXY_CACHE"
    echo "$discovered"
  else
    # Fallback to hardcoded known proxies
    echo "http://165.227.117.110:3128" > "$PROXY_CACHE"
    cat "$PROXY_CACHE"
  fi
}

# --- Make request with proxy failover ---
PROXIES=$(get_proxies)
PROXY_ARR=($PROXIES)

for PROXY in "${PROXY_ARR[@]}"; do
  CURL_ARGS=(-s -x "$PROXY" -X "$METHOD" "$URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json")
  [ -n "$DATA" ] && CURL_ARGS+=(-d "$DATA")

  RESPONSE=$(curl "${CURL_ARGS[@]}" --connect-timeout 8 --max-time 15 2>/dev/null) && {
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 0
  }
done

echo "ERROR: All proxies failed" >&2
exit 1
