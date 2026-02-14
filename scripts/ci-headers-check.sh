#!/bin/bash
# ============================================================
# SEOBAIKE CI Security Headers Check
# 檢查 Workers URL 的 6 個必要安全 headers
# 用法: bash scripts/ci-headers-check.sh [URL]
# 回傳 exit code: 0=全通過 (6/6), 1=有缺失
# ============================================================

set -euo pipefail

TARGET_URL="${1:-https://seobaike-remote-control.icanforyouthebest.workers.dev}"

echo "============================================================"
echo "  SEOBAIKE Security Headers Check"
echo "  Target: $TARGET_URL"
echo "============================================================"
echo ""

# Fetch headers
HEADERS=$(curl -sI "$TARGET_URL" 2>/dev/null || true)

if [ -z "$HEADERS" ]; then
  echo "FAIL: Could not fetch headers from $TARGET_URL"
  exit 1
fi

# Required headers list
REQUIRED_HEADERS=(
  "Strict-Transport-Security"
  "Content-Security-Policy"
  "X-Frame-Options"
  "X-Content-Type-Options"
  "Access-Control-Allow-Origin"
  "Content-Type"
)

PASS_COUNT=0
TOTAL=${#REQUIRED_HEADERS[@]}

echo "------------------------------------------------------------"
echo "  Header Verification ($TOTAL required)"
echo "------------------------------------------------------------"

for header in "${REQUIRED_HEADERS[@]}"; do
  # Case-insensitive header match
  if echo "$HEADERS" | grep -qi "^${header}:"; then
    VALUE=$(echo "$HEADERS" | grep -i "^${header}:" | head -1 | sed 's/^[^:]*: //' | tr -d '\r')
    echo "  PASS  $header"
    echo "        -> $VALUE"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL  $header"
    echo "        -> MISSING"
  fi
done

echo ""

# Calculate score
SCORE=$((PASS_COUNT * 100 / TOTAL))

echo "------------------------------------------------------------"
echo "  Result: $PASS_COUNT / $TOTAL headers present"
echo "  Score:  $SCORE / 100"
echo "------------------------------------------------------------"
echo ""

# Gate decision
echo "============================================================"
if [ "$PASS_COUNT" -eq "$TOTAL" ]; then
  echo "  GATE: PASS ($PASS_COUNT/$TOTAL = 100)"
  echo "============================================================"
  exit 0
else
  echo "  GATE: FAIL ($PASS_COUNT/$TOTAL < $TOTAL/$TOTAL)"
  echo "============================================================"
  exit 1
fi
