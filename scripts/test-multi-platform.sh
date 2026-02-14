#!/bin/bash
# ============================================================
# SEOBAIKE 多平台訊息系統驗證
# 用法: bash scripts/test-multi-platform.sh
# ============================================================

set -euo pipefail

WORKER_URL="${WORKER_URL:-https://seobaike-remote-control.icanforyouthebest.workers.dev}"

PASS=0
FAIL=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local name="$1"
  local actual_code="$2"
  local expected_code="$3"

  if [ "$actual_code" = "$expected_code" ]; then
    echo "  通過  $name → HTTP $actual_code"
    PASS=$((PASS + 1))
  else
    echo "  失敗  $name → HTTP $actual_code（預期 $expected_code）"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================================"
echo "  SEOBAIKE 多平台端點驗證"
echo "  時間: $(date)"
echo "============================================================"
echo ""

# ── LINE ──
echo "▶ LINE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER_URL/api/webhook/line" \
  -H "Content-Type: application/json" -d '{"events":[]}')
check "LINE Webhook（無密鑰）→ 503" "$CODE" "503"

# ── Telegram ──
echo "▶ Telegram"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER_URL/api/webhook/telegram" \
  -H "Content-Type: application/json" -d '{"update_id":1}')
check "Telegram Webhook" "$CODE" "200"

# ── WhatsApp ──
echo "▶ WhatsApp"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER_URL/api/webhook/whatsapp" \
  -H "Content-Type: application/json" -d '{"entry":[]}')
check "WhatsApp Webhook（無密鑰）→ 503" "$CODE" "503"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test")
check "WhatsApp 驗證（錯誤 token）→ 403" "$CODE" "403"

# ── Messenger ──
echo "▶ Messenger"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER_URL/api/webhook/messenger" \
  -H "Content-Type: application/json" -d '{"entry":[]}')
check "Messenger Webhook（無密鑰）→ 503" "$CODE" "503"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/api/webhook/messenger?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test")
check "Messenger 驗證（錯誤 token）→ 403" "$CODE" "403"

# ── 閘道 ──
echo "▶ API 閘道"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER_URL/api/gateway" \
  -H "Content-Type: application/json" -d '{}')
check "閘道無認證 → 401" "$CODE" "401"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$WORKER_URL/api/gateway")
check "閘道 GET 方法 → 404" "$CODE" "404"

# ── AI 聊天 ──
echo "▶ AI 聊天"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER_URL/api/ai/chat" \
  -H "Content-Type: application/json" -d '{}')
check "AI 聊天缺少參數 → 400" "$CODE" "400"

# ── 安全 ──
echo "▶ 安全"
ORIGIN=$(curl -sI "$WORKER_URL" | grep -i "Access-Control-Allow-Origin" | tr -d '\r' | awk '{print $2}')
if [ "$ORIGIN" = "https://aiforseo.vip" ]; then
  echo "  通過  CORS 鎖定 → $ORIGIN"
  PASS=$((PASS + 1))
else
  echo "  失敗  CORS 仍然是 → $ORIGIN（應為 https://aiforseo.vip）"
  FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

HSTS=$(curl -sI "$WORKER_URL" | grep -i "Strict-Transport-Security" | head -1)
check "HSTS 標頭存在" "$([ -n "$HSTS" ] && echo "200" || echo "0")" "200"

CSP=$(curl -sI "$WORKER_URL" | grep -i "Content-Security-Policy" | head -1)
check "CSP 標頭存在" "$([ -n "$CSP" ] && echo "200" || echo "0")" "200"

echo ""
echo "============================================================"
echo "  多平台驗證結果"
echo "  通過: $PASS / $TOTAL"
echo "  失敗: $FAIL / $TOTAL"
echo "============================================================"

if [ "$FAIL" -eq 0 ]; then
  echo "  全部通過"
  exit 0
else
  echo "  有 $FAIL 項失敗"
  exit 1
fi
