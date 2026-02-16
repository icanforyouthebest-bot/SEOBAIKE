# SEOBAIKE 資料庫結構摘要

**Supabase Project:** vmyrivxxibqydccurxug
**區域：** 東京
**PostgreSQL 版本：** 17.x
**公開表數量：** 284

## 核心表（專利約束層）

| 表名 | 用途 | 筆數 |
|------|------|------|
| l1_categories | L1 宏觀產業類別 | 26 |
| l2_subcategories | L2 次產業分類（FK→L1） | 100 |
| l3_processes | L3 製程/作業類型（FK→L2） | 226 |
| l4_nodes | L4 原子級工業節點（FK→L3） | 414 |
| constraint_paths | 約束路徑定義 | -- |
| inference_path_checks | 推理路徑檢查記錄 | -- |
| inference_audit_trail | 推理稽核軌跡 | -- |
| frozen_snapshots | 版本快照鎖定 | -- |

## 業務表

| 表名 | 用途 |
|------|------|
| ai_model_registry | AI 平台目錄（4,129 筆） |
| ai_model_routing_config | AI 模型路由配置 |
| profiles | 使用者基本資料 |
| users | 認證使用者 |
| customer_industry_binding | 客戶產業綁定 |
| boss_approval_queue | 老闆核准佇列 |
| remote_commands / remote_command_logs | 遠端指令系統 |

## 關鍵函數（自訂 PLPGSQL）

| 函數名 | 用途 |
|--------|------|
| check_inference_path() | 專利核心：L1→L4 路徑驗證 |
| constrained_ai_chat() | 約束式 AI 對話 |
| resolve_query_industry() | 查詢產業解析 |
| execute_remote_command() | 遠端指令執行 |
| run_security_scan() | 安全掃描 |
| check_rate_limit() | 限速檢查 |
| log_audit_event() | 稽核事件記錄 |
| approve_command() / reject_command() | 指令核准/拒絕 |
| emergency_stop() | 緊急停止 |

## 觸發器

| 觸發器 | 表 | 事件 | 執行函數 |
|--------|-----|------|----------|
| trg_l1_protect_frozen | l1_categories | UPDATE/DELETE | protect_frozen_row() |
| trg_l2_protect_frozen | l2_subcategories | UPDATE/DELETE | protect_frozen_row() |
| trg_l3_protect_frozen | l3_processes | UPDATE/DELETE | protect_frozen_row() |
| trg_l4_protect_frozen | l4_nodes | UPDATE/DELETE | protect_frozen_row() |
| trg_enforce_industry_path | business_items | INSERT/UPDATE | enforce_industry_path() |
| trg_protect_platform_identity | platform_identity | UPDATE/DELETE | protect_platform_identity() |
| trg_protect_market_intelligence | market_intelligence | UPDATE/DELETE | protect_market_intelligence() |

## Migrations

共 159 個 migration，從 001 到 wave159。
- 001-048：核心結構（L1-L4、RLS、業務邏輯、安全）
- wave1-wave159：平台登錄（INSERT 到 ai_model_registry）

完整 migration 清單可透過 Supabase Dashboard 查看。

## 如何匯出完整 schema

```bash
# 使用 Supabase CLI
supabase db dump --project-ref vmyrivxxibqydccurxug > full_schema.sql

# 或透過 pg_dump（需要資料庫連線字串，從 Supabase Dashboard > Settings > Database 取得）
pg_dump "postgresql://postgres:[PASSWORD]@db.vmyrivxxibqydccurxug.supabase.co:5432/postgres" --schema-only > full_schema.sql
```
