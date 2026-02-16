# SEOBAIKE 創辦人本地監控系統
# 標配：聲音 + 彈窗 + Windows 通知中心
# 每 60 秒自動檢查，異常立刻發聲

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName PresentationFramework

$SUPABASE_URL = "https://vmyrivxxibqydccurxug.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg"

function Play-Alert {
    [System.Media.SystemSounds]::Exclamation.Play()
}

function Play-Success {
    [System.Media.SystemSounds]::Asterisk.Play()
}

function Play-Critical {
    for ($i = 0; $i -lt 3; $i++) {
        [Console]::Beep(1000, 300)
        Start-Sleep -Milliseconds 100
        [Console]::Beep(1500, 300)
        Start-Sleep -Milliseconds 100
    }
}

function Show-Notification($title, $message) {
    # Windows Toast via BurntToast or fallback
    try {
        $balloon = New-Object System.Windows.Forms.NotifyIcon
        $balloon.Icon = [System.Drawing.SystemIcons]::Information
        $balloon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        $balloon.BalloonTipTitle = $title
        $balloon.BalloonTipText = $message
        $balloon.Visible = $true
        $balloon.ShowBalloonTip(10000)
        Start-Sleep -Seconds 2
        $balloon.Dispose()
    } catch {
        # Fallback: MessageBox
        [System.Windows.Forms.MessageBox]::Show($message, $title, 'OK', 'Information')
    }
}

function Check-System {
    $now = Get-Date -Format "HH:mm:ss"

    try {
        $headers = @{
            "apikey" = $ANON_KEY
            "Authorization" = "Bearer $ANON_KEY"
        }

        # Check AI Providers
        $resp = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/ai_providers?select=name,is_active,status&limit=50" -Headers $headers -TimeoutSec 10
        $total = $resp.Count
        $online = ($resp | Where-Object { $_.is_active -eq $true }).Count
        $offline = $total - $online

        if ($offline -gt 0) {
            $offlineNames = ($resp | Where-Object { $_.is_active -ne $true } | Select-Object -ExpandProperty name) -join ", "
            Play-Alert
            Show-Notification "SEOBAIKE AI 警報" "[$now] $online/$total 在線 | 離線: $offlineNames"
        }

        Write-Host "[$now] AI: $online/$total 在線" -ForegroundColor $(if ($offline -gt 0) { "Yellow" } else { "Green" })

        return @{ Online = $online; Total = $total; Offline = $offline }
    } catch {
        Play-Critical
        Show-Notification "SEOBAIKE 嚴重警報" "[$now] 無法連線資料庫！"
        Write-Host "[$now] 錯誤: 無法連線" -ForegroundColor Red
        return $null
    }
}

# === 啟動 ===
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  SEOBAIKE 創辦人本地監控系統" -ForegroundColor Cyan
Write-Host "  標配：聲音 + 彈窗通知" -ForegroundColor Cyan
Write-Host "  每 60 秒自動檢查" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Play-Success
$result = Check-System

if ($result) {
    Show-Notification "SEOBAIKE 監控已啟動" "AI: $($result.Online)/$($result.Total) 在線`n創辦人監控模式：已啟用"
}

Write-Host "`n持續監控中... 按 Ctrl+C 停止`n" -ForegroundColor White

while ($true) {
    Start-Sleep -Seconds 60
    Check-System
}
