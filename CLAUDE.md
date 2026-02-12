# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 身份與權限

- 指揮官：許竣翔（CEO, 小路光有限公司, 統編 60475510）
- 台灣專利 115100981「世界定義約束法用於AI推理」
- CaaS 架構：人類決策為主，AI 為輔助執行
- 竣翔是架構師，不要請他寫程式碼

## 平台定位

SEOBAIKE = AI 界的 App Store / iOS 容器。不做 MCP，做讓 MCP 跑的平台。插拔式架構，所有 AI 服務走 aiforseo.vip 通路。商業模式：收過路費 + 分潤。

## 技術棧

- 中控台：Anthropic Claude Code
- 資料庫：Supabase 東京（project ref: vmyrivxxibqydccurxug）
- 前端：Framer + MCP Plugin
- 上線：Cloudflare（aiforseo.vip）
- 功能市集：Composio / 各種現成 MCP

## 專利 L1-L4 約束層

- L1 `l1_categories`：宏觀產業類別
- L2 `l2_subcategories`：次產業分類（FK → L1）
- L3 `l3_processes`：製程/作業類型（FK → L2）
- L4 `l4_nodes`：原子級工業節點（FK → L3）
- 每層內建 `tsic_code`, `naics_code`, `nace_code`, `jsic_code` 多國對齊欄位
- `frozen_snapshots`：版本快照表（RLS 僅允許 INSERT，不可改/刪）
- 各層 `is_frozen` + `frozen_at` 欄位鎖定 + trigger 保護
- Migration: `supabase/migrations/001_l1_l4_constraint_layers.sql`

## Tokens

- GitHub PAT: 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
- Supabase Access Token: sbp_f94f9f6246d9059763758ba23b7816929a0607ec
- Supabase Project Ref: vmyrivxxibqydccurxug

## 規則

- 所有輸出僅限 SEOBAIKE / 小路光 / 許竣翔 品牌
- 禁止第三方品牌名出現在程式碼和文件中
- UI 使用暖色系
- 不重工，接著上次進度繼續
- 不要問竣翔要任何 token，全部從 CLAUDE.md 讀取
