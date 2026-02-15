# 研發包（Development Package）

**發佈日期**：2026-02-15
**專利**：TW-115100981 | **公司**：小路光有限公司 | **CEO**：許竣翔
**適用對象**：研發部門

---

## 本包用途

提供研發部門進行技術開發、架構維護、平台整合所需的全部文件與程式碼。

## 包含文件

| # | 檔案名 | 說明 |
|---|--------|------|
| 1 | README.md | 本說明文件 |
| 2 | task_chain_code_index.md | 十層任務鏈所有程式碼索引 |
| 3 | layer5_plus_fix_report.md | L5-L10 卡點解決文件（244 行） |
| 4 | platform_registry_list.md | 4,000 筆平台收錄清單 |
| 5 | checksums.sha256 | 本包所有檔案 SHA256 驗證碼 |

## 使用方式

1. 閱讀 `task_chain_code_index.md` 了解十層任務鏈程式碼架構
2. 閱讀 `layer5_plus_fix_report.md` 了解 L5-L10 各層狀態與卡點修復
3. 查閱 `platform_registry_list.md` 了解 4,000 筆平台的供應商分佈與 tier 分類
4. 驗證文件完整性：`sha256sum -c checksums.sha256`

## 技術棧總覽

| 組件 | 技術 | 路徑 |
|------|------|------|
| 中控台 | Claude Code (Opus 4.6) | CLAUDE.md |
| 資料庫 | Supabase（東京） | vmyrivxxibqydccurxug |
| API 層 | Cloudflare Workers | workers/src/index.ts |
| 前端 | Framer + Cloudflare Pages | pages-site/ |
| 網域 | aiforseo.vip | Cloudflare DNS |

## 十層任務鏈程式碼位置

| 層 | 檔案 | 行數 | 語言 |
|----|------|------|------|
| L1 | task_generator.py | 144 | Python |
| L2 | assign_tasks.py | 181 | Python |
| L3 | monitor_tasks.py | 151 | Python |
| L4 | optimize_scheduler.py | 223 | Python |
| L7 | clone_checker.py | 212 | Python |
| L9 | self_audit.py | 790 | Python |
| API | workers/src/index.ts | 982 | TypeScript |

---

*SEOBAIKE — 專利 TW-115100981 | 小路光有限公司*
