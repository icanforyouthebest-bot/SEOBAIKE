# SEOBAIKE — AI Management Platform

> **https://aiforseo.vip** | Patent 115100981

## Architecture

```
User (Telegram/LINE/WhatsApp/Messenger)
  → Cloudflare Worker (middleware)
    → Supabase Edge Function
      → PostgreSQL (4-layer compliance gate)
        → Patent 115100981: check_inference_path()
        → AML anti-money laundering
        → PDPA data protection
        → Audit trail
```

## Key Features

- **Boss Mobile Approval** — High-risk commands require founder approval with full Chinese explanation
- **31 AI Models** — NVIDIA + MCP ecosystem registered and routed
- **19 Smart Routes** — AI model routing by task type
- **33 Remote Commands** — Full system control via messaging apps
- **12-Point Security Scan** — QRL compliance audit (92/100)
- **Gradual Rollout** — off → 10% → 30% → 100% with health gates
- **Circuit Breakers** — 5 services with auto-recovery
- **Refund Protection** — Daily/monthly limits + duplicate prevention

## Stack

| Component | Technology |
|-----------|------------|
| Database | Supabase PostgreSQL (Tokyo) |
| Middleware | Cloudflare Workers |
| Edge Functions | Supabase (Deno) |
| Bot | Telegram @Seobaike_notify_bot |
| Domain | aiforseo.vip |
| AI | Cloudflare Workers AI |

## Commands

| Command | Risk | Approval Required |
|---------|------|-------------------|
| `/lock` | Critical | Yes |
| `/unlock` | Critical | Yes |
| `/rollback` | Critical | Yes |
| `/maintenance` | High | Yes |
| `/refund` | High | Yes |
| `/status` | Low | No |
| `/revenue` | Low | No |
| `/seo` | Low | No |
| + 25 more... | | |

## Security

- Row Level Security on all tables
- 4-layer compliance gate (Patent + AML + PDPA + Audit)
- Rate limiting (60/min, 600/hr)
- Circuit breakers with auto-recovery
- Founder-only approval for critical operations
- Emergency stop function

## Migrations

38 migrations covering:
- `001-017`: Core platform + patent compliance
- `018-028`: Remote control + multi-platform + AI models
- `029`: NVIDIA + MCP ecosystem (27 tools)
- `030-031`: Boss approval system + founder lock
- `032-034`: Monitoring + rollout + security scan
- `035-037`: RLS hardening + fixes
- `038`: Production safety (rate limit + circuit breaker + refund protection)

---

**SEOBAIKE** — Built for millions of users, controlled by the founder's phone.
