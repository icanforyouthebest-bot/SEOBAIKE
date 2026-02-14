#!/bin/bash
# ============================================================
# BAIKE 全量上線流程 — 自動化腳本
# 用法: bash scripts/launch-sequence.sh
# ============================================================

set -e

SUPABASE_URL="${SUPABASE_URL:-https://vmyrivxxibqydccurxug.supabase.co}"
SRK="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SRK" ]; then
  echo "❌ 未設定 SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

rpc() {
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/$1" \
    -H "Content-Type: application/json" \
    -H "apikey: $SRK" \
    -H "Authorization: Bearer $SRK" \
    -d "${2:-{}}"
}

echo "============================================================"
echo "  BAIKE 全量上線流程"
echo "============================================================"
echo ""

# Step 1: 安全掃描
echo "▶ Step 1: 全方位安全掃描..."
SCAN=$(rpc run_security_scan)
SCORE=$(echo $SCAN | python3 -c "import sys,json; print(json.load(sys.stdin).get('score',0))" 2>/dev/null || echo "?")
GONO=$(echo $SCAN | python3 -c "import sys,json; print(json.load(sys.stdin).get('go_no_go','?'))" 2>/dev/null || echo "?")
echo "  安全分數: $SCORE/100"
echo "  Go/No-Go: $GONO"
if [ "$GONO" = "NO-GO" ]; then
  echo "❌ 安全掃描未通過，中止上線"
  echo "$SCAN" | python3 -m json.tool 2>/dev/null || echo "$SCAN"
  exit 1
fi
echo "  ✅ 安全掃描通過"
echo ""

# Step 2: 健康檢查
echo "▶ Step 2: 全系統健康檢查..."
HEALTH=$(rpc run_health_check)
OVERALL=$(echo $HEALTH | python3 -c "import sys,json; print(json.load(sys.stdin).get('overall','?'))" 2>/dev/null || echo "?")
echo "  系統狀態: $OVERALL"
if [ "$OVERALL" != "healthy" ]; then
  echo "⚠️ 系統不健康，建議先修復再上線"
fi
echo "  ✅ 健康檢查完成"
echo ""

# Step 3: 灰度推進 — 10%
echo "▶ Step 3: 灰度推進至 10% (canary)..."
for feature in boss_approval nvidia_models mcp_tools multi_platform; do
  R=$(rpc advance_rollout "{\"p_feature\":\"$feature\",\"p_performed_by\":\"founder\"}")
  MSG=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','?'))" 2>/dev/null || echo "$R")
  echo "  $feature: $MSG"
done
echo ""

echo "⏸  等待 30 秒觀察 canary..."
sleep 30

# Step 4: 健康閘門 → 30%
echo "▶ Step 4: 健康閘門檢查 → 推進至 30%..."
HEALTH2=$(rpc run_health_check)
OVERALL2=$(echo $HEALTH2 | python3 -c "import sys,json; print(json.load(sys.stdin).get('overall','?'))" 2>/dev/null || echo "?")
echo "  系統狀態: $OVERALL2"

if [ "$OVERALL2" = "healthy" ]; then
  for feature in boss_approval nvidia_models mcp_tools multi_platform; do
    R=$(rpc advance_rollout "{\"p_feature\":\"$feature\",\"p_performed_by\":\"founder\"}")
    MSG=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','?'))" 2>/dev/null || echo "$R")
    echo "  $feature: $MSG"
  done
else
  echo "❌ 健康閘門未通過，停在 10%"
  exit 1
fi
echo ""

echo "⏸  等待 30 秒觀察 partial..."
sleep 30

# Step 5: Go/No-Go 最終閘門 → 100%
echo "▶ Step 5: Pre-Launch Go/No-Go 閘門..."
GATE=$(rpc pre_launch_gate)
FINAL=$(echo $GATE | python3 -c "import sys,json; print(json.load(sys.stdin).get('go_no_go','?'))" 2>/dev/null || echo "?")
echo "  最終決定: $FINAL"

if [ "$FINAL" = "GO" ]; then
  echo ""
  echo "▶ Step 6: 全量上線 100%..."
  for feature in boss_approval nvidia_models mcp_tools multi_platform; do
    R=$(rpc advance_rollout "{\"p_feature\":\"$feature\",\"p_performed_by\":\"founder\"}")
    MSG=$(echo $R | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','?'))" 2>/dev/null || echo "$R")
    echo "  $feature: $MSG"
  done
  echo ""
  echo "============================================================"
  echo "  ✅ BAIKE 全量上線完成"
  echo "============================================================"
else
  echo "❌ Go/No-Go 未通過，停在 30%"
  echo "$GATE" | python3 -m json.tool 2>/dev/null || echo "$GATE"
  exit 1
fi
