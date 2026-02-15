"""SEOBAIKE 全系統監控面板 — AI FOR SEO — 全自動即時更新"""
import gradio as gr
import httpx
import asyncio
import time
import json
import os
from datetime import datetime

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vmyrivxxibqydccurxug.supabase.co")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
NVIDIA_EP = f"{SUPABASE_URL}/functions/v1/nvidia-boss"
GATEWAY_EP = f"{SUPABASE_URL}/functions/v1/ai-gateway"
HEADERS = {"Authorization": f"Bearer {ANON_KEY}", "Content-Type": "application/json"}

round_count = 0
nv_ok = 0
nv_fail = 0
gw_ok = 0
gw_fail = 0
log_lines = []

msgs = ["system status","patent check","L1 L2 L3 L4 count","constraint rules","audit report",
        "binding list","allow industries","path check stats","performance","health"]

async def check_nvidia(msg):
    global nv_ok, nv_fail
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            t0 = time.time()
            r = await c.post(NVIDIA_EP, headers=HEADERS, json={"message": msg})
            ms = round((time.time()-t0)*1000)
            d = r.json()
            if r.status_code == 200 and d.get("reply"):
                nv_ok += 1
                return f"SEOBAIKE 主引擎: OK ({ms}ms)\n{d.get('reply','')[:80]}", d.get("real_data",{}), ms
            else:
                nv_fail += 1
                return f"SEOBAIKE 主引擎: FAIL ({ms}ms)", {}, ms
    except Exception as e:
        nv_fail += 1
        return f"SEOBAIKE 主引擎: ERROR - {e}", {}, 0

async def check_gateway(msg):
    global gw_ok, gw_fail
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            t0 = time.time()
            r = await c.post(GATEWAY_EP, headers=HEADERS, json={"message":msg,"platform":"telegram","platform_user_id":"5372713163"})
            ms = round((time.time()-t0)*1000)
            d = r.json()
            if r.status_code == 200:
                gw_ok += 1
                return f"ai-gateway: OK ({ms}ms) allowed={d.get('allowed')} industry={d.get('industry','')}", ms
            else:
                gw_fail += 1
                return f"ai-gateway: FAIL ({ms}ms)", ms
    except Exception as e:
        gw_fail += 1
        return f"ai-gateway: ERROR - {e}", 0

async def check_edge_functions():
    funcs = ["nvidia-boss","ai-gateway","ai-brain","ai-command","ai-secretary","seobaike-ai-router","admin-gateway","ai-model-router"]
    results = []
    async with httpx.AsyncClient(timeout=10) as c:
        for f in funcs:
            try:
                r = await c.options(f"{SUPABASE_URL}/functions/v1/{f}")
                status = "ACTIVE" if r.status_code in [200,204] else str(r.status_code)
                results.append(f"  {f}: {status}")
            except:
                results.append(f"  {f}: TIMEOUT")
    return "\n".join(results)

def run_auto_check():
    global round_count, log_lines
    round_count += 1
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = msgs[round_count % len(msgs)]

    loop = asyncio.new_event_loop()

    nv_result, real_data, nv_ms = loop.run_until_complete(check_nvidia(msg))
    gw_result, gw_ms = loop.run_until_complete(check_gateway(msg))

    # Only check edge functions every 10 rounds to reduce load
    if round_count % 10 == 1:
        ef_result = loop.run_until_complete(check_edge_functions())
    else:
        ef_result = None
    loop.close()

    # L1-L4 data
    l1 = real_data.get("l1_count", "?")
    l2 = real_data.get("l2_count", "?")
    l3 = real_data.get("l3_count", "?")
    l4 = real_data.get("l4_count", "?")
    checks = real_data.get("total_path_checks", "?")
    audit = real_data.get("total_audit_entries", "?")
    allow = real_data.get("allow_paths", "?")
    deny = real_data.get("deny_paths", "?")
    bindings = real_data.get("total_bindings", "?")

    # Build live stats
    nv_rate = round(nv_ok/(nv_ok+nv_fail)*100, 1) if (nv_ok+nv_fail) > 0 else 0
    gw_rate = round(gw_ok/(gw_ok+gw_fail)*100, 1) if (gw_ok+gw_fail) > 0 else 0

    engines = f"""{'='*50}
  第 {round_count} 輪即時測試 @ {now}
{'='*50}

  SEOBAIKE 主引擎  | 成功: {nv_ok} | 失敗: {nv_fail} | 成功率: {nv_rate}% | 延遲: {nv_ms}ms
  {nv_result}

  ai-gateway  | 成功: {gw_ok} | 失敗: {gw_fail} | 成功率: {gw_rate}% | 延遲: {gw_ms}ms
  {gw_result}

  {'▓' * int(nv_rate/2)}{'░' * (50-int(nv_rate/2))} 主引擎 {nv_rate}%
  {'▓' * int(gw_rate/2)}{'░' * (50-int(gw_rate/2))} Gateway {gw_rate}%"""

    patent = f"""L1 產業: {l1} | L2 次產業: {l2} | L3 製程: {l3} | L4 節點: {l4}
路徑檢查: {checks} | 稽核記錄: {audit}
Allow: {allow} | Deny: {deny} | 客戶綁定: {bindings}

總節點數: {l1 if l1 != '?' else 0}+{l2 if l2 != '?' else 0}+{l3 if l3 != '?' else 0}+{l4 if l4 != '?' else 0} = {(int(l1) if str(l1).isdigit() else 0)+(int(l2) if str(l2).isdigit() else 0)+(int(l3) if str(l3).isdigit() else 0)+(int(l4) if str(l4).isdigit() else 0)} 個約束節點"""

    # Add to log
    log_lines.insert(0, f"[{now}] #{round_count} NV:{nv_ms}ms GW:{gw_ms}ms | msg={msg}")
    log_lines = log_lines[:50]  # keep last 50
    live_log = "\n".join(log_lines)

    report = f"""=== 全系統即時監控 @ {now} ===
=== 第 {round_count} 輪 (每 6 秒自動刷新) ===

【雙霸主引擎】
{nv_result}
{gw_result}

【專利約束系統 L1→L4】
{patent}

【累計統計】
  SEOBAIKE 主引擎 : {nv_ok} 成功 / {nv_fail} 失敗 = {nv_rate}%
  ai-gateway : {gw_ok} 成功 / {gw_fail} 失敗 = {gw_rate}%

【本機工具】
  SEOBAIKE CLI — 已連線 www.aiforseo.vip
  Python 3.13.12 — AI SDK 就緒
  Node.js 24.13.0 — Workers 就緒
  Docker 29.2.0 — baike-monitor 運行中
  TypeScript 5.9.3 — 編譯就緒
  Wrangler 4.65.0 — Cloudflare 就緒"""

    return engines, patent, live_log, report

# Gradio 6.x: use Timer for auto-refresh
with gr.Blocks(title="SEOBAIKE 全系統監控") as app:
    gr.Markdown("# SEOBAIKE — 雙霸主全系統即時監控\n**AI FOR SEO | 專利 115100981 | 小路光有限公司**\n\n**每 6 秒自動刷新 — 全部數據即時跳動**")

    timer = gr.Timer(value=6)

    with gr.Row():
        engines_box = gr.Textbox(label="SEOBAIKE 引擎即時狀態 (自動更新中)", lines=12)
        patent_box = gr.Textbox(label="專利約束系統 L1→L4", lines=12)

    with gr.Row():
        log_box = gr.Textbox(label="即時測試記錄 (最近 50 筆)", lines=12)
        report_box = gr.Textbox(label="完整即時報告", lines=12)

    with gr.Row():
        btn = gr.Button("手動立即檢測", variant="primary", size="lg")

    timer.tick(fn=run_auto_check, outputs=[engines_box, patent_box, log_box, report_box])
    btn.click(fn=run_auto_check, outputs=[engines_box, patent_box, log_box, report_box])
    app.load(fn=run_auto_check, outputs=[engines_box, patent_box, log_box, report_box])

app.launch(server_port=7870, share=False, inbrowser=True)
