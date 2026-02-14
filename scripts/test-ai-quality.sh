#!/bin/bash
# ============================================================
# SEOBAIKE AI 回覆品質驗證
# 用法: bash scripts/test-ai-quality.sh
# 環境變數: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# ============================================================

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-https://vmyrivxxibqydccurxug.supabase.co}"
SRK="${SUPABASE_SERVICE_ROLE_KEY}"
WORKER_URL="${WORKER_URL:-https://seobaike-remote-control.icanforyouthebest.workers.dev}"

if [ -z "$SRK" ]; then
  echo "錯誤: 未設定 SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

PASS=0
FAIL=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local name="$1"
  local result="$2"
  local expected="$3"

  if echo "$result" | grep -qi "$expected"; then
    echo "  通過  $name"
    PASS=$((PASS + 1))
  else
    echo "  失敗  $name"
    echo "        回傳: $(echo "$result" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================================"
echo "  SEOBAIKE AI 回覆品質驗證"
echo "  時間: $(date)"
echo "============================================================"
echo ""

# ── 1. AI 閘道（約束式聊天）──
echo "▶ 1. AI 約束式聊天（ai-gateway）"
R=$(curl -s -X POST "$SUPABASE_URL/functions/v1/ai-gateway" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SRK" \
  -d '{"message":"什麼是SEO?","platform":"test","platform_user_id":"test_user"}')
check "SEO 問題有回覆" "$R" "reply\|response\|SEO\|搜尋"

R=$(curl -s -X POST "$SUPABASE_URL/functions/v1/ai-gateway" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SRK" \
  -d '{"message":"如何提升網站排名?","platform":"test","platform_user_id":"test_user"}')
check "排名問題有回覆" "$R" "reply\|response\|排名\|網站"

echo ""

# ── 2. AI 模型覆蓋度 ──
echo "▶ 2. AI 模型覆蓋度"
R=$(curl -s "$SUPABASE_URL/rest/v1/ai_model_registry?select=provider,model_id,tier&is_active=eq.true" \
  -H "apikey: $SRK" \
  -H "Authorization: Bearer $SRK")

PROVIDERS=$(echo "$R" | python3 -c "
import sys,json
data = json.load(sys.stdin)
providers = set(d['provider'] for d in data)
print(len(providers))
for p in sorted(providers):
    models = [d['model_id'] for d in data if d['provider'] == p]
    print(f'  {p}: {len(models)} 個模型')
" 2>/dev/null || echo "0")

echo "$PROVIDERS" | tail -n +2
PROVIDER_COUNT=$(echo "$PROVIDERS" | head -1)
check "AI 供應商 >= 3" "count=$PROVIDER_COUNT" "count=[3-9]\|count=[1-9][0-9]"

TOTAL_MODELS=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "AI 模型總數 >= 20" "count=$TOTAL_MODELS" "count=[2-9][0-9]\|count=[1-9][0-9][0-9]"
echo ""

# ── 3. call_opus_gpu Token 記錄 ──
echo "▶ 3. Opus GPU 呼叫 + Token 記錄"
R=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/call_opus_gpu" \
  -H "Content-Type: application/json" \
  -H "apikey: $SRK" \
  -H "Authorization: Bearer $SRK" \
  -d '{"p_user_id":"test_audit","p_model":"opus-4.6-max","p_context":{"test":"self_audit"}}')
check "call_opus_gpu 回傳 token 計數" "$R" "tokens_used"
check "call_opus_gpu 回傳 GPU 利用率" "$R" "gpu_utilization"

# 確認有寫入 ai_token_log
sleep 1
R=$(curl -s "$SUPABASE_URL/rest/v1/ai_token_log?order=created_at.desc&limit=1" \
  -H "apikey: $SRK" \
  -H "Authorization: Bearer $SRK")
check "ai_token_log 有記錄" "$R" "tokens_used\|model"
echo ""

# ── 4. 專利路徑驗證 ──
echo "▶ 4. 專利推理路徑 check_inference_path()"
R=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/check_inference_path" \
  -H "Content-Type: application/json" \
  -H "apikey: $SRK" \
  -H "Authorization: Bearer $SRK" \
  -d '{"p_input":"SEO關鍵字分析","p_industry":"digital_marketing"}')
check "推理路徑回傳結果" "$R" "path\|matched\|result\|allowed"
echo ""

# ── 結果 ──
echo "============================================================"
echo "  AI 品質驗證結果"
echo "  通過: $PASS / $TOTAL"
echo "  失敗: $FAIL / $TOTAL"
SCORE_PCT=$((PASS * 100 / TOTAL))
echo "  分數: $SCORE_PCT / 100"
echo "============================================================"

if [ "$FAIL" -eq 0 ]; then
  echo "  全部通過"
  exit 0
else
  echo "  有 $FAIL 項失敗"
  exit 1
fi
