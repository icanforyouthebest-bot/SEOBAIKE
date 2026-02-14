#!/bin/bash
# ============================================================
# SEOBAIKE CI Compliance Check
# 呼叫 run_full_compliance_scan() RPC，解析結果並閘門判定
# 用法: bash scripts/ci-compliance-check.sh
# 環境變數: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# 回傳 exit code: 0=通過 (>=90), 1=失敗 (<90)
# ============================================================

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-https://vmyrivxxibqydccurxug.supabase.co}"
SRK="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SRK" ]; then
  echo "FAIL: SUPABASE_SERVICE_ROLE_KEY not set"
  exit 1
fi

echo "============================================================"
echo "  SEOBAIKE Compliance Scan (5 Frameworks, 44 Items)"
echo "============================================================"
echo ""

# Call the RPC
RESULT=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/run_full_compliance_scan" \
  -H "Content-Type: application/json" \
  -H "apikey: $SRK" \
  -H "Authorization: Bearer $SRK" \
  -d '{}')

if [ -z "$RESULT" ] || [ "$RESULT" = "null" ]; then
  echo "FAIL: Empty response from run_full_compliance_scan()"
  exit 1
fi

# Parse JSON with python3
SCORE=$(echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('overall_score', 0))
" 2>/dev/null || echo "0")

GRADE=$(echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('grade', '?'))
" 2>/dev/null || echo "?")

echo "  Overall Score : $SCORE / 100"
echo "  Grade         : $GRADE"
echo ""

# Print framework breakdown
echo "------------------------------------------------------------"
echo "  Framework Breakdown"
echo "------------------------------------------------------------"
echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
frameworks = data.get('frameworks', data.get('framework_scores', {}))
if isinstance(frameworks, dict):
    for name, info in frameworks.items():
        if isinstance(info, dict):
            s = info.get('score', info.get('pct', '?'))
            p = info.get('pass_count', info.get('passed', '?'))
            t = info.get('total', '?')
            print(f'  {name:30s} {s:>3}/100  ({p}/{t} passed)')
        else:
            print(f'  {name:30s} {info}')
elif isinstance(frameworks, list):
    for f in frameworks:
        name = f.get('framework', f.get('name', '?'))
        s = f.get('score', f.get('pct', '?'))
        print(f'  {name:30s} {s:>3}/100')
" 2>/dev/null || echo "  (unable to parse framework details)"
echo ""

# Print critical issues / failures
echo "------------------------------------------------------------"
echo "  Issues & Warnings"
echo "------------------------------------------------------------"
echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
issues = data.get('critical_issues', data.get('failures', data.get('issues', [])))
if not issues:
    print('  None - all checks passed')
else:
    for item in issues:
        if isinstance(item, dict):
            name = item.get('check', item.get('item', item.get('name', '?')))
            status = item.get('status', item.get('result', '?'))
            print(f'  ISSUE: {name} -> {status}')
        else:
            print(f'  ISSUE: {item}')
" 2>/dev/null || echo "  (unable to parse issues)"
echo ""

# Gate decision — 100/100 or blocked, no exceptions
echo "============================================================"
SCORE_INT=$(echo "$SCORE" | python3 -c "import sys; print(int(float(sys.stdin.read().strip())))" 2>/dev/null || echo "0")

if [ "$SCORE_INT" -ge 98 ]; then
  echo "  GATE: PASS (score $SCORE >= 98)"
  echo "============================================================"
  exit 0
else
  echo "  GATE: FAIL (score $SCORE < 98 — deployment blocked)"
  echo "============================================================"
  exit 1
fi
