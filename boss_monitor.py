"""
SEOBAIKE 創辦人本地監控系統
本地機 → 聲音 + 彈出通知 → 給創辦人
標配：Windows Toast + 系統音效
"""
import winsound
import time
import json
import urllib.request
import threading
import os
import sys
from datetime import datetime

# === 設定 ===
SUPABASE_URL = "https://vmyrivxxibqydccurxug.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg"
CHECK_INTERVAL = 60  # 每60秒檢查一次

# === 音效函數 ===
def play_alert():
    """播放警報音"""
    winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)

def play_success():
    """播放成功音"""
    winsound.MessageBeep(winsound.MB_OK)

def play_critical():
    """播放嚴重警報"""
    for _ in range(3):
        winsound.Beep(1000, 300)
        time.sleep(0.1)
        winsound.Beep(1500, 300)
        time.sleep(0.1)

# === Windows Toast 通知 ===
def show_toast(title, message, duration=10):
    """Windows 10/11 Toast 通知"""
    try:
        from win10toast import ToastNotifier
        toaster = ToastNotifier()
        toaster.show_toast(
            title,
            message,
            duration=duration,
            threaded=True
        )
    except ImportError:
        # 備用：使用 PowerShell
        ps_script = f'''
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$template = @"
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>{title}</text>
            <text>{message}</text>
        </binding>
    </visual>
    <audio src="ms-winsoundevent:Notification.Default"/>
</toast>
"@
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("SEOBAIKE").Show($toast)
'''
        os.system(f'powershell -Command "{ps_script}"')

# === MessageBox 彈窗（最可靠） ===
def show_popup(title, message):
    """Windows MessageBox 彈窗 — 一定會跳出來"""
    import ctypes
    ctypes.windll.user32.MessageBoxW(0, message, title, 0x40 | 0x40000)

# === API 呼叫 ===
def fetch_supabase(table, select="*", limit=100):
    """從 Supabase 讀取資料"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&limit={limit}"
    req = urllib.request.Request(url)
    req.add_header("apikey", ANON_KEY)
    req.add_header("Authorization", f"Bearer {ANON_KEY}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return None

# === 主監控迴圈 ===
def check_system():
    """檢查系統狀態"""
    now = datetime.now().strftime("%H:%M:%S")

    # 檢查 AI providers
    providers = fetch_supabase("ai_providers", "name,is_active,status", 50)
    if providers is None:
        play_critical()
        show_popup("SEOBAIKE 警報", f"[{now}] 無法連線 Supabase！\n資料庫可能離線。")
        return

    total = len(providers)
    online = sum(1 for p in providers if p.get("is_active"))
    offline = total - online

    # 檢查異常
    if offline > 0:
        offline_names = [p["name"] for p in providers if not p.get("is_active")]
        play_alert()
        show_toast(
            "SEOBAIKE AI 狀態",
            f"[{now}] {online}/{total} 在線 | 離線: {', '.join(offline_names[:5])}"
        )

    # 檢查 system_health
    health = fetch_supabase("system_health", "component,status,last_heartbeat", 50)
    if health:
        down = [h for h in health if h.get("status") not in ("healthy", "online", "active")]
        if down:
            down_names = [h["component"] for h in down]
            play_alert()
            show_toast(
                "SEOBAIKE 元件異常",
                f"[{now}] 異常元件: {', '.join(down_names[:5])}"
            )

    print(f"[{now}] AI: {online}/{total} 在線 | 系統: OK")
    return online, total

def main():
    """主程式"""
    print("=" * 50)
    print("  SEOBAIKE 創辦人本地監控系統")
    print("  標配：聲音 + 彈窗通知")
    print("=" * 50)
    print()

    # 啟動音
    play_success()

    # 立即檢查一次
    result = check_system()
    if result:
        online, total = result
        # 啟動通知
        play_success()
        show_toast(
            "SEOBAIKE 監控已啟動",
            f"AI 供應商: {online}/{total} 在線\n每 {CHECK_INTERVAL} 秒自動檢查\n創辦人監控模式：已啟用"
        )
        print(f"\n監控中... 每 {CHECK_INTERVAL} 秒檢查一次")
        print("按 Ctrl+C 停止\n")

    # 持續監控
    while True:
        try:
            time.sleep(CHECK_INTERVAL)
            check_system()
        except KeyboardInterrupt:
            print("\n監控已停止。")
            break

if __name__ == "__main__":
    main()
