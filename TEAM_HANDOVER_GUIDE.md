# SEOBAIKE 團隊交接指南

**日期：** 2026-02-15
**交接人：** Claude Code (Opus 4.6) → 團隊
**核准人：** 許竣翔（CEO）

---

## 一、如何驗證系統狀態

### 1.1 主站檢查

```bash
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s" https://www.aiforseo.vip/
# 預期：HTTP 200 | < 1s
```

### 1.2 AI 引擎檢查

```bash
curl -X POST \
  https://vmyrivxxibqydccurxug.supabase.co/functions/v1/nvidia-boss \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "system status"}'
# 預期：200 OK，JSON 回應含 reply 欄位
```

### 1.3 約束結構檢查

透過 Supabase Dashboard 或 SQL：
```sql
SELECT
  (SELECT count(*) FROM l1_categories) as l1,
  (SELECT count(*) FROM l2_subcategories) as l2,
  (SELECT count(*) FROM l3_processes) as l3,
  (SELECT count(*) FROM l4_nodes) as l4;
-- 預期：26 + 100 + 226 + 414 = 766
```

### 1.4 安全檢測

```bash
cd /path/to/SEOBAIKE
python self_audit.py
# 預期：100/100 (A+)，10/10 項 SAFE
```

---

## 二、如何下載部門包

### 2.1 檔案位置

| 檔案 | 路徑 | SHA256 |
|------|------|--------|
| 部門交付包 | `department_packages.zip` | `342c0e8bd46b7fce22c08f81cd23a3156fa076ad8b4a4f35918028afc4eb1e7c` |
| 完整資料包 | `data_complete_package.zip` | `4e37eb65e99fb6be67cc777834b870c2504382369727a197c5262f5ecfa3463b` |

### 2.2 驗證步驟

```bash
sha256sum department_packages.zip
# 比對上表 SHA256 值
```

### 2.3 部門包內容

- 法務部：合規文件、專利說明、免責聲明
- 資安部：安全檢測報告、漏洞修復記錄
- 研發部：API 文件、約束結構、Edge Functions 清單
- 營運部：使用指南、帳號體系、對接流程
- 稽核部：證據包、完整性報告、誠實宣告

---

## 三、如何發布全球公告

### 3.1 公告文件

檔案：`GLOBAL_LAUNCH_ANNOUNCEMENT.md`

包含五種語言版本：
1. 繁體中文
2. 簡體中文
3. 英文
4. 日文
5. 韓文

### 3.2 發布管道建議

| 管道 | 語言 | 優先級 |
|------|------|--------|
| www.aiforseo.vip 首頁 | 繁中 + 英文 | P0 |
| GitHub Repository README | 英文 | P0 |
| 社群媒體（LinkedIn, Twitter/X） | 英文 | P1 |
| 台灣媒體 | 繁中 | P1 |
| 日本市場 | 日文 | P2 |
| 韓國市場 | 韓文 | P2 |
| 中國市場 | 簡中 | P2 |

### 3.3 發布前檢查清單

- [ ] aiforseo.vip 回應 200 OK
- [ ] nvidia-boss Edge Function 回應 200
- [ ] L1-L4 結構完整（766 筆）
- [ ] 安全分數 100/100
- [ ] 公告文件五種語言校對完成
- [ ] 創辦人最終核准

---

## 四、如何對接後續需求

### 4.1 技術支援

- **Supabase 管理**：Supabase Dashboard（東京節點）
- **Cloudflare 管理**：aiforseo.vip 域名 + Workers
- **程式碼庫**：GitHub Repository
- **AI 引擎**：160 個 Edge Functions

### 4.2 常見操作

| 操作 | 方式 |
|------|------|
| 新增 L1-L4 節點 | Supabase SQL INSERT |
| 部署 Edge Function | `supabase functions deploy <name>` |
| 更新前端 | Cloudflare Pages 部署 |
| 安全掃描 | `python self_audit.py` |
| 查看即時流量 | Supabase Dashboard → Edge Functions Logs |

### 4.3 緊急聯絡

- 創辦人決策：許竣翔（CEO）
- 系統問題：檢查 Supabase Logs + Cloudflare Analytics
- 安全問題：重跑 `python self_audit.py`，檢查分數變化

---

## 五、交接完成確認

此文件由 Claude Code (Opus 4.6) 生成，作為全球上線交接的操作指南。

**交接項目：**
- [x] 系統狀態確認（全部通過）
- [x] 安全檢測 100/100
- [x] 五部門資料包（SHA256 已驗證）
- [x] 全球公告（五語言）
- [x] 世界賽準備文件
- [x] 團隊交接指南（本文件）

**等待：** 創辦人按下「全球啟動」按鈕。

---

**小路光有限公司 | 專利 TW-115100981 | www.aiforseo.vip**
