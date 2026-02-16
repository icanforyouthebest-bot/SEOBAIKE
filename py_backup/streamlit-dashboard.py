"""SEOBAIKE — Streamlit 即時儀表板 — 每 3 秒自動刷新"""
import streamlit as st
import httpx
import time
import json
import os
from datetime import datetime

st.set_page_config(page_title="SEOBAIKE 即時監控", page_icon="🔥", layout="wide")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vmyrivxxibqydccurxug.supabase.co")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
NVIDIA_EP = f"{SUPABASE_URL}/functions/v1/nvidia-boss"
GATEWAY_EP = f"{SUPABASE_URL}/functions/v1/ai-gateway"
HEADERS = {"Authorization": f"Bearer {ANON_KEY}", "Content-Type": "application/json"}

if "round" not in st.session_state:
    st.session_state.round = 0
    st.session_state.nv_ok = 0
    st.session_state.nv_fail = 0
    st.session_state.gw_ok = 0
    st.session_state.gw_fail = 0
    st.session_state.history = []

st.session_state.round += 1
now = datetime.now().strftime("%H:%M:%S")
msgs = ["status","patent check","L1-L4","constraints","audit","bindings","allow","path stats","perf","health"]
msg = msgs[st.session_state.round % len(msgs)]

# Header
st.markdown("""
<div style="background:linear-gradient(135deg,#76b900,#cc785c,#1a1a2e);padding:15px 30px;border-radius:12px;margin-bottom:20px;">
<h1 style="color:white;margin:0;">SEOBAIKE — 雙霸主即時監控</h1>
<p style="color:#ddd;margin:0;">AI FOR SEO | 專利 115100981 | 小路光有限公司 | 每 3 秒自動刷新</p>
</div>
""", unsafe_allow_html=True)

# Engine tests
col1, col2 = st.columns(2)

# SEOBAIKE 主引擎測試
try:
    t0 = time.time()
    with httpx.Client(timeout=30) as c:
        r = c.post(NVIDIA_EP, headers=HEADERS, json={"message": msg})
    nv_ms = round((time.time()-t0)*1000)
    d = r.json()
    if r.status_code == 200 and d.get("reply"):
        st.session_state.nv_ok += 1
        nv_status = "OK"
        nv_reply = d["reply"][:80]
        real_data = d.get("real_data", {})
    else:
        st.session_state.nv_fail += 1
        nv_status = "FAIL"
        nv_reply = str(d)[:80]
        real_data = {}
except Exception as e:
    st.session_state.nv_fail += 1
    nv_status = "ERROR"
    nv_reply = str(e)[:80]
    nv_ms = 0
    real_data = {}

with col1:
    st.markdown(f"### SEOBAIKE 主引擎")
    c1, c2, c3 = st.columns(3)
    c1.metric("成功", st.session_state.nv_ok)
    c2.metric("失敗", st.session_state.nv_fail)
    c3.metric("延遲", f"{nv_ms}ms")
    nv_rate = round(st.session_state.nv_ok/(st.session_state.nv_ok+st.session_state.nv_fail)*100, 1) if (st.session_state.nv_ok+st.session_state.nv_fail) > 0 else 0
    st.progress(nv_rate/100, text=f"成功率 {nv_rate}%")
    st.code(f"[{nv_status}] {nv_reply}")

# Gateway test
try:
    t0 = time.time()
    with httpx.Client(timeout=30) as c:
        r = c.post(GATEWAY_EP, headers=HEADERS, json={"message":msg,"platform":"telegram","platform_user_id":"5372713163"})
    gw_ms = round((time.time()-t0)*1000)
    gw_d = r.json()
    if r.status_code == 200:
        st.session_state.gw_ok += 1
        gw_status = "OK"
        gw_info = f"allowed={gw_d.get('allowed')} industry={gw_d.get('industry','')}"
    else:
        st.session_state.gw_fail += 1
        gw_status = "FAIL"
        gw_info = str(gw_d)[:80]
except Exception as e:
    st.session_state.gw_fail += 1
    gw_status = "ERROR"
    gw_info = str(e)[:80]
    gw_ms = 0

with col2:
    st.markdown(f"### SEOBAIKE 約束引擎")
    c1, c2, c3 = st.columns(3)
    c1.metric("成功", st.session_state.gw_ok)
    c2.metric("失敗", st.session_state.gw_fail)
    c3.metric("延遲", f"{gw_ms}ms")
    gw_rate = round(st.session_state.gw_ok/(st.session_state.gw_ok+st.session_state.gw_fail)*100, 1) if (st.session_state.gw_ok+st.session_state.gw_fail) > 0 else 0
    st.progress(gw_rate/100, text=f"成功率 {gw_rate}%")
    st.code(f"[{gw_status}] {gw_info}")

# L1-L4 Patent System
st.markdown("---")
st.markdown("### 專利約束系統 L1→L4")
p1, p2, p3, p4 = st.columns(4)
p1.metric("L1 產業", real_data.get("l1_count", "?"))
p2.metric("L2 次產業", real_data.get("l2_count", "?"))
p3.metric("L3 製程", real_data.get("l3_count", "?"))
p4.metric("L4 節點", real_data.get("l4_count", "?"))

p5, p6, p7, p8 = st.columns(4)
p5.metric("路徑檢查", real_data.get("total_path_checks", "?"))
p6.metric("稽核記錄", real_data.get("total_audit_entries", "?"))
p7.metric("Allow 規則", real_data.get("allow_paths", "?"))
p8.metric("Deny 規則", real_data.get("deny_paths", "?"))

# Log
st.session_state.history.insert(0, f"[{now}] #{st.session_state.round} NV:{nv_ms}ms({nv_status}) GW:{gw_ms}ms({gw_status}) msg={msg}")
st.session_state.history = st.session_state.history[:30]

st.markdown("---")
st.markdown("### 即時測試記錄")
st.code("\n".join(st.session_state.history))

# Footer
st.markdown(f"""
---
**第 {st.session_state.round} 輪** | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | SEOBAIKE 專利 115100981 | 小路光有限公司
""")

# Auto-refresh every 3 seconds
time.sleep(3)
st.rerun()
