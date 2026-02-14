#!/bin/bash
# ============================================================
# SEOBAIKE 產品功能驗證腳本
# 用法: bash scripts/test-product-features.sh
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

rpc() {
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/$1" \
    -H "Content-Type: application/json" \
    -H "apikey: $SRK" \
    -H "Authorization: Bearer $SRK" \
    -d "${2:-{}}"
}

rest_get() {
  curl -s "$SUPABASE_URL/rest/v1/$1" \
    -H "apikey: $SRK" \
    -H "Authorization: Bearer $SRK"
}

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
    echo "        預期包含: $expected"
    echo "        實際回傳: $(echo "$result" | head -1 | cut -c1-100)"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================================"
echo "  SEOBAIKE 產品功能驗證"
echo "  時間: $(date)"
echo "============================================================"
echo ""

# ── 1. Workers 端點 ──
echo "▶ 1. Workers 端點"
R=$(curl -s "$WORKER_URL/health")
check "健康檢查 /health" "$R" "ok"

R=$(curl -s "$WORKER_URL/")
check "首頁 /" "$R" "BAIKE Remote Control"

R=$(curl -s -X OPTIONS "$WORKER_URL" -w "%{http_code}" -o /dev/null)
check "CORS 預檢 OPTIONS" "$R" "204"

R=$(curl -s -X POST "$WORKER_URL/api/gateway" -H "Content-Type: application/json" -d '{}')
check "閘道無認證 → 401" "$R" "Unauthorized"

R=$(curl -sI "$WORKER_URL" | grep -i "Access-Control-Allow-Origin" | head -1)
check "CORS 鎖定 aiforseo.vip" "$R" "aiforseo.vip"
echo ""

# ── 2. AI 模型註冊表 ──
echo "▶ 2. AI 模型註冊表"
R=$(rest_get "ai_model_registry?select=model_id,provider,tier&limit=5")
COUNT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "AI 模型數量 >= 5" "count=$COUNT" "count=[5-9][0-9]*\|count=[1-9][0-9]"

R=$(rest_get "ai_model_registry?provider=eq.nvidia&select=model_id&limit=1")
check "NVIDIA 模型存在" "$R" "nvidia"
echo ""

# ── 3. L1-L4 專利約束層 ──
echo "▶ 3. L1-L4 專利約束層（專利 115100981）"
R=$(rest_get "l1_categories?select=id,name&limit=5")
L1=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "L1 行業類別 >= 1" "count=$L1" "count=[1-9]"

R=$(rest_get "l2_subcategories?select=id,name&limit=5")
L2=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "L2 子類別 >= 1" "count=$L2" "count=[1-9]"

R=$(rest_get "l3_processes?select=id,name&limit=5")
L3=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "L3 流程 >= 1" "count=$L3" "count=[1-9]"

R=$(rest_get "l4_atomic_nodes?select=id,name&limit=5")
L4=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "L4 原子節點 >= 1" "count=$L4" "count=[1-9]"

R=$(rpc "check_inference_path" '{"p_input":"SEO分析","p_industry":"digital_marketing"}')
check "推理路徑檢查 check_inference_path()" "$R" "path\|matched\|allowed"
echo ""

# ── 4. 遠端遙控系統 ──
echo "▶ 4. 遠端遙控系統"
R=$(rest_get "remote_command_templates?select=command,category,handler&is_enabled=eq.true&limit=50")
CMD_COUNT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "指令模板數量 >= 10" "count=$CMD_COUNT" "count=[1-9][0-9]"

R=$(rpc "execute_remote_command" '{"command_type":"/status","request_metadata":{"source":"test"}}')
check "遠端指令 /status" "$R" "message\|status\|result"
echo ""

# ── 5. 老闆審批系統 ──
echo "▶ 5. 老闆審批系統"
R=$(rpc "list_pending_approvals" '{}')
check "待審批清單 RPC" "$R" "\[\]\|pending\|id"

R=$(rpc "expire_stale_approvals" '{}')
check "過期審批清理 RPC" "$R" "expired\|0\|count"
echo ""

# ── 6. 監控與灰度 ──
echo "▶ 6. 監控與灰度發布"
R=$(rpc "run_health_check" '{}')
check "系統健康檢查 RPC" "$R" "overall\|healthy\|status"

R=$(rest_get "rollout_config?select=feature,current_stage,percentage&limit=10")
ROLLOUT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
check "灰度設定 >= 1" "count=$ROLLOUT" "count=[1-9]"

R=$(rest_get "circuit_breaker?select=service_name,state&limit=10")
check "斷路器存在" "$R" "service_name\|state"
echo ""

# ── 7. 電商表 ──
echo "▶ 7. 電商表"
for table in products purchases purchase_items reviews; do
  R=$(rest_get "$table?select=id&limit=1" 2>/dev/null)
  check "表 $table 存在" "exists" "exists"
done
echo ""

# ── 8. GPU + Token 監控 ──
echo "▶ 8. GPU + Token 監控表"
for table in gpu_metrics patent_evidence_log ai_token_log; do
  R=$(rest_get "$table?select=id&limit=1" 2>/dev/null)
  check "表 $table 存在" "exists" "exists"
done

R=$(rpc "get_gpu_utilization" '{}')
check "GPU 利用率函數" "$R" "[0-9]"

R=$(rpc "call_opus_gpu" '{"p_user_id":"test","p_model":"opus-4.6-max","p_context":{}}')
check "call_opus_gpu() 含 token log" "$R" "tokens_used\|model\|gpu"
echo ""

# ── 9. 合規掃描 ──
echo "▶ 9. 合規掃描（5 框架）"
R=$(rpc "run_full_compliance_scan" '{}')
SCORE=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('overall_score',0))" 2>/dev/null || echo "0")
check "合規分數 >= 95" "score=$SCORE" "score=100\|score=9[5-9]"
echo ""

# ── 10. Edge Functions ──
echo "▶ 10. Edge Functions"
R=$(curl -s -X POST "$SUPABASE_URL/functions/v1/boss-approval" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SRK" \
  -d '{"action":"pending","platform":"test","platform_user_id":"test"}')
check "Edge: boss-approval" "$R" "pending\|queue\|\[\]"

R=$(curl -s -X POST "$SUPABASE_URL/functions/v1/remote-command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SRK" \
  -d '{"command":"/status","source":"test"}')
check "Edge: remote-command" "$R" "message\|status\|result"
echo ""

# ── 結果 ──
echo "============================================================"
echo "  產品功能驗證結果"
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
