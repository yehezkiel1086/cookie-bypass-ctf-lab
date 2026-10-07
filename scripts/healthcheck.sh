#!/usr/bin/env bash
set -e

PORT="${1:-3075}"
HOST="${2:-localhost}"
BASE_URL="http://${HOST}:${PORT}"

echo "[*] Checking Cyber Range Health on ${BASE_URL}..."

# 1. Check Root Endpoint & Headers
echo -n "[*] Testing Root endpoint & X-Powered-By header: "
HEADERS=$(curl -sI "${BASE_URL}/")
if echo "$HEADERS" | grep -q "X-Powered-By: Node.js"; then
    echo "OK (X-Powered-By: Node.js detected)"
else
    echo "FAIL"
    exit 1
fi

# 2. Check pre_mfa_session cookie
echo -n "[*] Testing pre_mfa_session cookie: "
if echo "$HEADERS" | grep -q "pre_mfa_session=pending_mfa_verification"; then
    echo "OK (pre_mfa_session cookie issued)"
else
    echo "FAIL"
    exit 1
fi

# 3. Check robots.txt
echo -n "[*] Testing /robots.txt: "
ROBOTS=$(curl -s "${BASE_URL}/robots.txt")
if echo "$ROBOTS" | grep -q "Disallow: /api/verify-mfa"; then
    echo "OK (/api/verify-mfa disallowed)"
else
    echo "FAIL"
    exit 1
fi

# 4. Check /dashboard restricted status
echo -n "[*] Testing /dashboard restricted access: "
DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/dashboard")
if [ "$DASH_STATUS" -eq 403 ]; then
    echo "OK (403 Forbidden as expected)"
else
    echo "FAIL (Got $DASH_STATUS)"
    exit 1
fi

echo "[+] All health checks passed successfully!"
