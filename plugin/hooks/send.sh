#!/bin/sh
# Posts the hook's JSON payload to Clorbit. If Clorbit is not running the connection is
# refused within milliseconds and the script exits silently with code 0.
# The target follows CLORBIT_URL, else CLORBIT_PORT (like the server and the CLI), else :4980.
PORT="${CLORBIT_PORT:-${FLEET_PORT:-4980}}"
URL="${CLORBIT_URL:-${FLEET_URL:-http://127.0.0.1:$PORT}}"
curl -s --connect-timeout 0.3 -m 1 -X POST -H 'content-type: application/json' \
  --data-binary @- "$URL/api/hook" >/dev/null 2>&1
exit 0
