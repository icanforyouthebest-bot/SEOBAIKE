# Edge Functions 清單（160 個）

**Supabase Project:** vmyrivxxibqydccurxug

## 有真實流量的（2 個）

| 函數名 | 用途 | 流量來源 |
|--------|------|----------|
| nvidia-boss | 主 AI 引擎（約束推理） | dashboard.html 自動測試 |
| ai-gateway | AI 閘道（多平台路由） | dashboard.html 自動測試 |

**注意：以上流量來自 dashboard.html 的 setInterval 自動呼叫，非真實用戶。**

## 其他 Edge Functions（158 個）

已部署但無真實流量。完整清單保存在：
`C:\Users\icanf\.claude\projects\C--SEOBAIKE\2f44e44f-ca0a-48a2-9b1c-033c369820d7\tool-results\mcp-supabase-list_edge_functions-1771159223364.txt`

可透過 Supabase Dashboard > Edge Functions 查看所有函數及其原始碼。

## 如何取得 Edge Function 原始碼

```bash
# 使用 Supabase CLI
supabase functions list --project-ref vmyrivxxibqydccurxug
supabase functions download <function-name> --project-ref vmyrivxxibqydccurxug
```
