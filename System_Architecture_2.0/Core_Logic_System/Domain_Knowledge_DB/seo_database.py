"""
competitor_intelligence v15 — Network-isolated, fingerprinted, health-monitored
Tables: v14(58) + resolver_cache, http_fingerprint, domain_health_daily = 61
Gates:  v14(58) + NETWORK_PRECHECK → FINGERPRINT → DOMAIN_HEALTH_DAILY → HEALTH_ALERT = 62 total
"""
import sqlite3, json, os, hashlib, datetime, re, time, random
from urllib.parse import urlparse, urlunparse, urlencode, parse_qs

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "competitor_intelligence.db")

# ═══════════════════════════════════════════════════════════════════════
# Scoring model
# ═══════════════════════════════════════════════════════════════════════
SCORING = {
    "base": 100,
    "penalties": {
        "TITLE_MISSING": 40, "NO_H1": 30, "NO_META_DESCRIPTION": 15,
        "CANONICAL_MISSING": 10, "JSONLD_MISSING": 8, "BROKEN_JSONLD": 12,
        "MULTI_H1": 5, "LANG_MISSING": 4, "ROBOTS_NOINDEX": 0,
    },
    "floor": 0, "ceiling": 100,
}

# ═══════════════════════════════════════════════════════════════════════
# Issue taxonomy v4  (code, severity, family, default_penalty, message)
# ═══════════════════════════════════════════════════════════════════════
ISSUE_TAXONOMY = [
    ("NO_H1",                 "CRITICAL", "STRUCTURE",  30, "Page has no H1 tag"),
    ("TITLE_MISSING",         "CRITICAL", "SEO",        40, "Page title is missing or empty"),
    ("PARSE_FAILED",          "CRITICAL", "SYSTEM",      0, "HTML parsing failed — no usable content"),
    ("NO_META_DESCRIPTION",   "WARNING",  "SEO",        15, "Missing or empty meta description"),
    ("CANONICAL_MISSING",     "WARNING",  "SEO",        10, "No canonical URL specified"),
    ("FETCH_NOT_HTML",        "WARNING",  "HTTP",        0, "Response content-type is not text/html"),
    ("FETCH_TOO_SMALL",       "WARNING",  "HTTP",        0, "HTML body smaller than 500 bytes"),
    ("BROKEN_JSONLD",         "WARNING",  "SCHEMA",     12, "JSON-LD exists but failed to parse"),
    ("LANG_MISSING",          "WARNING",  "SEO",         4, "No lang attribute on html tag"),
    ("MULTI_H1",              "INFO",     "STRUCTURE",   5, "Multiple H1 tags — weight dispersed"),
    ("TITLE_TOO_SHORT",       "INFO",     "SEO",         0, "Page title shorter than 15 characters"),
    ("JSONLD_MISSING",        "INFO",     "SCHEMA",      8, "No JSON-LD structured data found"),
    ("ROBOTS_NOINDEX",        "INFO",     "ROBOTS",      0, "robots meta contains noindex"),
    ("HREFLANG_INCONSISTENT", "INFO",     "SEO",         0, "hreflang annotations are inconsistent"),
    ("SNAPSHOT_SKIPPED_DUP",  "INFO",     "SYSTEM",      0, "Snapshot skipped — content unchanged"),
    ("AUDIT_SCHEMA_MISMATCH", "WARNING",  "SYSTEM",      0, "Audit output did not conform to schema"),
    ("ROBOTS_DISALLOW",       "INFO",     "ROBOTS",      0, "URL disallowed by robots.txt"),
]

# ═══════════════════════════════════════════════════════════════════════
# Retry / artifact / priority policies
# ═══════════════════════════════════════════════════════════════════════
RETRY_POLICY = {"max_retries": 3, "backoff_seconds": [30, 120, 600], "cooldown_minutes": 15}
ARTIFACT_POLICY = {"default": "HASH_ONLY", "tier_A": "STORE_BYTES", "max_html_bytes": 2_000_000}

PRIORITY_MODEL = {
    "base": 100,
    "boosts": {"SITEMAP": 30, "REPRESENTATIVE": 50, "SCORE_DROP_20": 40, "NEW_CRITICAL": 60,
               "PAIR_FIXED": 100, "PRICING_DOCS_INTENT": 30, "COVERAGE_GAP": 60},
    "penalties": {"STATUS_4XX_5XX": -50, "DUPLICATE_URL": -100, "DOMAIN_COOLDOWN": -999,
                  "LOGIN_SIGNUP_INTENT": -200},
}

# Edge emission caps
EDGE_SAMPLE_CAP = 50

# Changed flags for delta focus
CHANGED_FLAGS = [
    "TITLE_CHANGED", "META_CHANGED", "H1_CHANGED", "CANONICAL_CHANGED",
    "ROBOTS_CHANGED", "JSONLD_TYPES_CHANGED", "LANG_CHANGED", "LINK_GRAPH_CHANGED",
]

# ═══════════════════════════════════════════════════════════════════════
# v5 constants
# ═══════════════════════════════════════════════════════════════════════
QA_SAMPLING_RATE = 0.05  # 5% random sampling
DETERMINISM_MODES = ("NORMAL", "STRICT")

# ═══════════════════════════════════════════════════════════════════════
# v6 constants
# ═══════════════════════════════════════════════════════════════════════
PAGE_INTENT_FLAGS = ("HOME", "PRICING", "DOCS", "BLOG", "LOGIN", "SIGNUP")
TEMPLATE_FAMILIES = ("MARKETING", "DOCS", "APP", "UNKNOWN")

SEGMENT_TEMPLATES = [
    {"name": "SEARCH_ENGINE",
     "definition_json": {"domain_list": ["www.google.com", "www.bing.com", "duckduckgo.com"],
                         "note": "super-sites; isolate from SaaS stats"}},
    {"name": "SEO_TOOLS_SAAS",
     "definition_json": {"hints": ["pricing", "features", "seo", "rank tracker"],
                         "note": "primary competitor group"}},
    {"name": "UNCLASSIFIED",
     "definition_json": {"note": "catch-all for domains without segment assignment"}},
]

# Intent detection rules (URL path + title tokens only, no semantic inference)
_INTENT_PATTERNS = {
    "HOME":    {"paths": ["/", ""], "tokens": []},
    "PRICING": {"paths": ["/pricing", "/plans", "/price"], "tokens": ["pricing", "plans", "price"]},
    "DOCS":    {"paths": ["/docs", "/documentation", "/api", "/reference", "/guide"],
                "tokens": ["documentation", "docs", "api reference", "guide"]},
    "BLOG":    {"paths": ["/blog", "/news", "/articles"], "tokens": ["blog", "news", "article"]},
    "LOGIN":   {"paths": ["/login", "/signin", "/sign-in"], "tokens": ["login", "sign in", "signin"]},
    "SIGNUP":  {"paths": ["/signup", "/register", "/sign-up", "/join"],
                "tokens": ["sign up", "signup", "register", "join", "get started"]},
}

# v7 KPI templates
KPI_TEMPLATES = [
    {"key": "CRITICAL_RATE",          "name": "representative CRITICAL ratio",
     "direction": "LOWER_BETTER",     "unit": "ratio",  "window_days": 7},
    {"key": "SCORE_P50",              "name": "representative score P50",
     "direction": "HIGHER_BETTER",    "unit": "score",  "window_days": 30},
    {"key": "NO_H1_RATE",             "name": "NO_H1 occurrence rate",
     "direction": "LOWER_BETTER",     "unit": "ratio",  "window_days": 7},
    {"key": "CANONICAL_MISSING_RATE", "name": "CANONICAL_MISSING occurrence rate",
     "direction": "LOWER_BETTER",     "unit": "ratio",  "window_days": 7},
]

# v8 policy + redaction + export view
POLICY_TEMPLATES = [
    {"key": "COMPETITOR_INTEL_CORE", "version": "1.0",
     "content_json": {
         "allowed": ["HTTP status + html structural fields", "issue codes + counts + score",
                     "link graph counts + sampled url_norm (capped)", "segment/pair/KPI/alerts/tickets",
                     "sitemap existence + coverage"],
         "forbidden": ["full-page content republishing", "personal data extraction",
                       "credential/session scraping", "bypass robots or access control",
                       "non-deterministic free-text narratives in exports"],
         "export_floor": ["PUBLIC view uses KPI + counts only",
                          "PUBLIC view never includes raw html/audit_raw artifacts",
                          "PUBLIC view caps url samples <= 20 per domain"]}},
]

REDACTION_TEMPLATES = [
    {"name": "MASK_EMAILS",
     "pattern": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
     "action": "MASK", "scope": "EXPORT"},
    {"name": "DROP_LONG_TEXT",
     "pattern": r".{2000,}",
     "action": "DROP", "scope": "EXPORT"},
]

EXPORT_VIEW_DEFS = [
    {"name": "PUBLIC",
     "allowed_fields_json": ["domain", "tier", "score", "issues_count_critical",
                             "issues_count_warning", "issues_count_info", "issues_sha256",
                             "intent_flags_json", "template_family", "segment",
                             "kpi_key", "kpi_value", "alert_count", "ticket_count",
                             "fetched_at", "is_representative"]},
    {"name": "INTERNAL",
     "allowed_fields_json": ["domain", "tier", "url", "score", "title", "meta_desc",
                             "h1", "h1_count", "h2_count", "canonical", "robots_meta", "lang",
                             "jsonld_count", "jsonld_types", "word_count", "text_len",
                             "internal_links_count", "external_links_count",
                             "images_count", "a11y_pct", "issues", "issues_sha256",
                             "issues_count_critical", "issues_count_warning", "issues_count_info",
                             "intent_flags_json", "template_family", "segment",
                             "cluster_id", "is_representative", "fetch_ms", "parse_ms", "audit_ms",
                             "score_breakdown_json", "explain_compact_json",
                             "kpi_key", "kpi_value", "alert_count", "ticket_count",
                             "fetched_at", "url_norm"]},
]

PUBLIC_URL_SAMPLE_CAP = 20

# v9 cost model + budget
COST_MODEL_DEFAULTS = {
    "ROBOTS": {"unit_type": "REQ",    "unit_cost": 0.0, "currency": "USD"},
    "FETCH":  {"unit_type": "REQ",    "unit_cost": 0.0, "currency": "USD"},
    "PARSE":  {"unit_type": "MS",     "unit_cost": 0.0, "currency": "USD"},
    "AUDIT":  {"unit_type": "TOKENS", "unit_cost": 0.0, "currency": "USD"},
    "ARTIFACT":{"unit_type": "KB",    "unit_cost": 0.0, "currency": "USD"},
    "DELTA":  {"unit_type": "MS",     "unit_cost": 0.0, "currency": "USD"},
    "EXPORT": {"unit_type": "ROWS",   "unit_cost": 0.0, "currency": "USD"},
}

BUDGET_POLICY_TEMPLATE = {
    "name": "DEFAULT_BUDGET_USD", "version": "1.0",
    "currency": "USD", "window": "JOB",
    "limit_total": 2.0, "limit_per_domain": 0.5, "limit_per_job": None,
    "actions_json": {
        "soft_stop_threshold": 0.8,
        "soft_stop_actions": ["DISABLE_DISCOVERY", "HASH_ONLY_ARTIFACT",
                              "INCREASE_TTL", "SKIP_HIGH_COMPLEXITY_AUDIT_FIELDS"],
        "hard_stop_actions": ["STOP_JOB", "RESCHEDULE_FRONTIER", "ALERT"],
    },
}

BUDGET_STATUSES = ("OK", "SOFT_STOP", "HARD_STOP")
COST_STAGES = ("ROBOTS", "FETCH", "PARSE", "AUDIT", "ARTIFACT", "DELTA", "EXPORT")
COST_UNIT_TYPES = ("REQ", "KB", "TOKENS", "MS", "ROWS")
COST_TIER_MIN_ENTRIES = 50  # minimum ledger entries before re-tiering a domain

# v10 replay / release gate
REPLAY_DEFAULT_SAMPLE = 200
REPLAY_MIN_SAMPLE = 50

RELEASE_CRITERIA_TEMPLATE = {
    "non_determinism_rate_max": 0.001,
    "new_critical_rate_increase_max": 0.01,
    "score_p50_shift_range": [-5, 5],
    "qa_review_min": 20,
    "qa_reject_rate_max": 0.01,
}

# v11 coverage + ingest
INGEST_SOURCE_KINDS = ("SEED", "SITEMAP", "DISCOVERY", "MANUAL", "PAIR_FIXED")
COVERAGE_REQUIRED_INTENTS = ("HOME", "PRICING", "DOCS")
COVERAGE_MIN_PAIR_PCT = 0.9
COVERAGE_MIN_DOMAIN_PCT = 0.6
AUTH_SURFACE_INTENTS = ("LOGIN", "SIGNUP")  # restricted depth
PAIR_FIXED_INTENTS = ("HOME", "PRICING", "DOCS", "LOGIN", "SIGNUP")

# v12 integrity + KPI filter + data quality
INTEGRITY_TEMPLATES = [
    {"name": "MIN_FIELDS_FOR_KPI", "severity": "CRITICAL",
     "requirements_json": {
         "must_have": ["score_total", "issues_sha256", "issues_count_critical",
                       "h1_count", "meta_description_len", "jsonld_count"]}},
    {"name": "GRAPH_OPTIONAL", "severity": "WARNING",
     "requirements_json": {
         "should_have": ["internal_links_count", "external_links_count"]}},
]

KPI_FILTER_TEMPLATE = {
    "name": "REP_COMPLETE_ONLY",
    "predicate_json": {"is_representative": 1, "is_complete": 1, "http_status_family": "2xx"},
}

DEFAULT_INGEST_SOURCES = [
    {"name": "SEED_DEFAULT",      "kind": "SEED",       "config_json": {"note": "initial seed URLs"}},
    {"name": "SITEMAP_DISCOVERY", "kind": "SITEMAP",    "config_json": {"note": "from sitemap.xml"}},
    {"name": "LINK_DISCOVERY",    "kind": "DISCOVERY",  "config_json": {"note": "discovered via link crawl"}},
    {"name": "MANUAL_ADD",        "kind": "MANUAL",     "config_json": {"note": "manually added URLs"}},
    {"name": "PAIR_FIXED_PAGES",  "kind": "PAIR_FIXED", "config_json": {"note": "fixed comparison pair pages"}},
]

# v13 lineage + sample_set + stability
LINEAGE_EDGE_TYPES = ("CRAWL_TO_SNAPSHOT", "SNAPSHOT_TO_ISSUE", "SNAPSHOT_TO_ARTIFACT",
                      "SNAPSHOT_TO_DELTA", "SNAPSHOT_TO_KPI", "SNAPSHOT_TO_ALERT",
                      "ALERT_TO_TICKET", "JOB_TO_EXPORT")
LINEAGE_KIND_MAP = {
    "crawl_job": "JOB", "page_snapshot": "SNAPSHOT", "page_issue": "ISSUE",
    "artifact_store": "ARTIFACT", "snapshot_delta": "DELTA",
    "kpi_value": "KPI", "alert_event": "ALERT", "fix_ticket": "TICKET",
    "export_job": "EXPORT",
}

SAMPLE_SET_TEMPLATE = {
    "name": "STABILITY_WEEKLY",
    "description": "Weekly stability monitoring sample",
    "strategy": "STRATIFIED",  # RANDOM, STRATIFIED, TOP_N
    "sample_size": 200,
    "refresh_interval_days": 7,
    "stratify_by": "segment",
}

STABILITY_MAX_ISSUES_FLIP_RATE = 0.15
STABILITY_MAX_SCORE_STDDEV = 8.0
STABILITY_MIN_SAMPLE = 20
STABILITY_WINDOW_DAYS = 30

# v14 anomaly detection + baseline
ANOMALY_METHODS = ("ZSCORE", "PCTL", "DELTA_RATE")
ANOMALY_SCOPES = ("DOMAIN", "SEGMENT", "PAIR", "GLOBAL")
ANOMALY_DEFAULT_COOLDOWN = 360  # minutes

ANOMALY_TEMPLATES = [
    {"name": "DQ_PARSE_FAIL_SPIKE", "scope": "GLOBAL",
     "metric_key": "parse_fail_rate", "method": "ZSCORE",
     "params_json": {"window_days": 14, "z": 3.0},
     "severity": "CRITICAL", "cooldown_minutes": 360},
    {"name": "DOMAIN_CRITICAL_RATE_SPIKE", "scope": "DOMAIN",
     "metric_key": "CRITICAL_RATE", "method": "DELTA_RATE",
     "params_json": {"window_days": 7, "delta": 0.05},
     "severity": "WARNING", "cooldown_minutes": 120},
]

KPI_BASELINE_WINDOW_DAYS = 14
KPI_BASELINE_METRIC_KEYS = ("CRITICAL_RATE", "SCORE_P50", "NO_H1_RATE",
                             "CANONICAL_MISSING_RATE", "parse_fail_rate",
                             "audit_incomplete_rate")

# v15 network health + fingerprint
NETWORK_STAGES = ("DNS", "TLS", "HTTP")
HEALTH_TIERS = ("GOOD", "DEGRADED", "BAD")
HEALTH_THRESHOLDS = {
    "BAD":      {"fetch_success_rate_lt": 0.8, "tls_ok_rate_lt": 0.9},
    "DEGRADED": {"fetch_success_rate_lt": 0.95, "avg_fetch_ms_gt": 2000},
}
RESOLVER_COOLDOWN_MINUTES = 15
FINGERPRINT_HEADER_KEYS = ("server", "x-powered-by", "x-cdn", "cache-control",
                           "vary", "etag", "strict-transport-security")

# ═══════════════════════════════════════════════════════════════════════
# URL normalization
# ═══════════════════════════════════════════════════════════════════════
_UTM = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"}

def normalize_url(url):
    p = urlparse(url)
    host = p.hostname.lower() if p.hostname else ""
    path = p.path.rstrip("/") or "/"
    qs = parse_qs(p.query, keep_blank_values=False)
    clean = {k: v for k, v in qs.items() if k.lower() not in _UTM}
    query = urlencode(clean, doseq=True) if clean else ""
    return urlunparse((p.scheme.lower(), host, path, "", query, ""))

def extract_domain(url):
    p = urlparse(url)
    return p.hostname.lower() if p.hostname else url

def compute_cluster_key(final_url, url):
    """cluster_key = normalized final_url if available, else url_norm."""
    if final_url:
        return normalize_url(final_url)
    return normalize_url(url)


def detect_page_intent(url, title=None):
    """v6: detect intent flags from URL path + title tokens. No semantic inference."""
    p = urlparse(url)
    path = p.path.rstrip("/").lower() or "/"
    title_lower = (title or "").lower()
    flags = []
    for flag, rules in _INTENT_PATTERNS.items():
        if path in rules["paths"]:
            flags.append(flag)
        elif any(tok in title_lower for tok in rules["tokens"] if tok):
            flags.append(flag)
    if not flags and path == "/":
        flags.append("HOME")
    return sorted(set(flags))


def detect_template_family(intent_flags, url):
    """v6: classify page template family from intent flags."""
    if any(f in intent_flags for f in ("DOCS",)):
        return "DOCS"
    if any(f in intent_flags for f in ("LOGIN", "SIGNUP")):
        return "APP"
    if any(f in intent_flags for f in ("HOME", "PRICING", "BLOG")):
        return "MARKETING"
    return "UNKNOWN"

# ═══════════════════════════════════════════════════════════════════════
# Connection
# ═══════════════════════════════════════════════════════════════════════
def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn

# ═══════════════════════════════════════════════════════════════════════
# Schema v4
# ═══════════════════════════════════════════════════════════════════════
def init_db():
    conn = get_conn()
    try:
        c = conn.cursor()
        _create_tables(c)
        _seed_issues(c)
        _migrate(c)
        _seed_golden_rule(c)
        _seed_segment_templates(c)
        _seed_kpi_templates(c)
        _seed_policy_templates(c)
        _seed_redaction_rules(c)
        _seed_export_views(c)
        _seed_budget_policy(c)
        _seed_ingest_sources(c)
        _seed_integrity_gates(c)
        _seed_kpi_filter(c)
        _seed_anomaly_detectors(c)
        conn.commit()
    finally:
        conn.close()

def _create_tables(c):
    # ── domain ──
    c.execute('''CREATE TABLE IF NOT EXISTS domain (
        domain_id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        tier TEXT NOT NULL DEFAULT 'C' CHECK(tier IN ('A','B','C')),
        default_ttl_hours INTEGER NOT NULL DEFAULT 72,
        crawl_budget_per_hour INTEGER NOT NULL DEFAULT 60,
        rate_limit_ms INTEGER NOT NULL DEFAULT 1000,
        robots_fetched_at TEXT, robots_sha256 TEXT, notes TEXT,
        sitemap_url TEXT, sitemap_fetched_at TEXT, sitemap_sha256 TEXT,
        quality_floor_score INTEGER NOT NULL DEFAULT 0,
        is_outlier INTEGER NOT NULL DEFAULT 0,
        outlier_reason TEXT)''')

    # ── crawl_job (v5: rule_set_id, determinism_mode) ──
    c.execute('''CREATE TABLE IF NOT EXISTS crawl_job (
        job_id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        finished_at TEXT, seed TEXT,
        agent_version TEXT DEFAULT 'deep_analyzer_v5',
        mode TEXT DEFAULT 'SEED_ONLY' CHECK(mode IN ('SEED_ONLY','FRONTIER','REFRESH','DELTA_ONLY','SITEMAP')),
        max_pages INTEGER, max_depth INTEGER, budget_ms INTEGER,
        rule_set_id INTEGER,
        determinism_mode TEXT DEFAULT 'NORMAL' CHECK(determinism_mode IN ('NORMAL','STRICT')),
        notes TEXT, settings_json TEXT DEFAULT '{}')''')

    # ── page ──
    c.execute('''CREATE TABLE IF NOT EXISTS page (
        page_id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER REFERENCES domain(domain_id),
        domain TEXT NOT NULL, url TEXT NOT NULL,
        url_norm TEXT NOT NULL UNIQUE,
        final_url TEXT, redirect_chain_json TEXT DEFAULT '[]',
        canonical_url TEXT,
        first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        last_status_code INTEGER, content_type TEXT,
        sha256_html TEXT, html_size INTEGER DEFAULT 0,
        cluster_id INTEGER REFERENCES canonical_cluster(cluster_id),
        is_representative INTEGER NOT NULL DEFAULT 0)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_page_domain_id ON page(domain_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_page_last_seen ON page(last_seen_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_page_status ON page(last_status_code)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_page_cluster ON page(cluster_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_page_representative ON page(is_representative)')

    # ── page_snapshot ──
    c.execute('''CREATE TABLE IF NOT EXISTS page_snapshot (
        snap_id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER NOT NULL REFERENCES page(page_id),
        job_id INTEGER REFERENCES crawl_job(job_id),
        fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        http_status_family TEXT, fetch_ms INTEGER, parse_ms INTEGER, audit_ms INTEGER,
        title TEXT, title_len INTEGER DEFAULT 0,
        meta_description TEXT, meta_description_len INTEGER DEFAULT 0,
        h1 TEXT, h1_count INTEGER DEFAULT 0, h1_hash TEXT,
        h2_count INTEGER DEFAULT 0,
        robots_meta TEXT, canonical TEXT, lang TEXT,
        word_count INTEGER DEFAULT 0, text_len INTEGER DEFAULT 0,
        sha256_text TEXT, sha256_dom TEXT,
        jsonld_count INTEGER DEFAULT 0, jsonld_types_json TEXT DEFAULT '[]',
        open_graph_json TEXT DEFAULT '{}', twitter_card_json TEXT DEFAULT '{}',
        hreflang_json TEXT DEFAULT '[]',
        internal_links_count INTEGER DEFAULT 0, external_links_count INTEGER DEFAULT 0,
        images_count INTEGER DEFAULT 0, a11y_alt_coverage_pct REAL DEFAULT 0.0,
        score_total INTEGER DEFAULT 0, score_breakdown_json TEXT DEFAULT '{}',
        html_artifact_sha256 TEXT, headers_artifact_sha256 TEXT, audit_raw_sha256 TEXT,
        verdict_json TEXT DEFAULT '{}',
        issues_sha256 TEXT,
        issues_count_critical INTEGER DEFAULT 0,
        issues_count_warning INTEGER DEFAULT 0,
        issues_count_info INTEGER DEFAULT 0,
        explain_compact_json TEXT DEFAULT '{}',
        intent_flags_json TEXT DEFAULT '[]',
        template_family TEXT DEFAULT 'UNKNOWN',
        UNIQUE(page_id, fetched_at))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_snap_page ON page_snapshot(page_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_snap_job ON page_snapshot(job_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_snap_fetched ON page_snapshot(fetched_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_snap_score ON page_snapshot(score_total)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_snap_issues_sha ON page_snapshot(issues_sha256)')

    # ── issue ──
    c.execute('''CREATE TABLE IF NOT EXISTS issue (
        issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        severity TEXT NOT NULL CHECK(severity IN ('CRITICAL','WARNING','INFO')),
        family TEXT DEFAULT 'SEO',
        default_penalty INTEGER DEFAULT 0,
        message TEXT NOT NULL)''')

    # ── page_issue ──
    c.execute('''CREATE TABLE IF NOT EXISTS page_issue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        issue_id INTEGER NOT NULL REFERENCES issue(issue_id),
        UNIQUE(snap_id, issue_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_pi_snap ON page_issue(snap_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_pi_issue ON page_issue(issue_id)')

    # ── snapshot_delta ──
    c.execute('''CREATE TABLE IF NOT EXISTS snapshot_delta (
        delta_id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER NOT NULL REFERENCES page(page_id),
        from_snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        to_snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        changed_flags_json TEXT DEFAULT '{}',
        issue_added_json TEXT DEFAULT '[]', issue_removed_json TEXT DEFAULT '[]',
        score_delta INTEGER DEFAULT 0,
        UNIQUE(page_id, from_snap_id, to_snap_id))''')

    # ── crawl_frontier ──
    c.execute('''CREATE TABLE IF NOT EXISTS crawl_frontier (
        fid INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER REFERENCES domain(domain_id),
        url TEXT NOT NULL, url_norm TEXT NOT NULL UNIQUE,
        priority INTEGER NOT NULL DEFAULT 0,
        depth INTEGER NOT NULL DEFAULT 0,
        discovered_from TEXT,
        discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        scheduled_at TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','DONE','SKIPPED','FAILED')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT, cooldown_until TEXT,
        http_hint_json TEXT DEFAULT '{}',
        last_error TEXT,
        source TEXT DEFAULT 'SEED' CHECK(source IN ('SEED','SITEMAP','DISCOVERY','REFRESH','MANUAL')),
        cluster_key_hint TEXT)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_fr_status ON crawl_frontier(status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_fr_domain ON crawl_frontier(domain_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_fr_sched ON crawl_frontier(scheduled_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_fr_retry ON crawl_frontier(next_retry_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_fr_prio ON crawl_frontier(priority DESC)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_fr_source ON crawl_frontier(source)')

    # ── artifact_store ──
    c.execute('''CREATE TABLE IF NOT EXISTS artifact_store (
        artifact_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sha256 TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL CHECK(kind IN ('HTML','HEADERS','ROBOTS','AUDIT_RAW','TEXT_EXTRACT')),
        bytes BLOB, size INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')

    # ── snapshot_artifact ──
    c.execute('''CREATE TABLE IF NOT EXISTS snapshot_artifact (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        artifact_id INTEGER NOT NULL REFERENCES artifact_store(artifact_id),
        UNIQUE(snap_id, artifact_id))''')

    # ── http_cache ──
    c.execute('''CREATE TABLE IF NOT EXISTS http_cache (
        page_id INTEGER PRIMARY KEY REFERENCES page(page_id),
        etag TEXT, last_modified TEXT,
        last_checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')

    # ── job_metric ──
    c.execute('''CREATE TABLE IF NOT EXISTS job_metric (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES crawl_job(job_id),
        metric_key TEXT NOT NULL, metric_value REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_jm_job ON job_metric(job_id)')

    # ── event_log ──
    c.execute('''CREATE TABLE IF NOT EXISTS event_log (
        eid INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER, domain_id INTEGER, page_id INTEGER, snap_id INTEGER,
        stage TEXT, level TEXT DEFAULT 'INFO' CHECK(level IN ('INFO','WARN','ERROR')),
        code TEXT, message TEXT, payload_json TEXT,
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ev_job ON event_log(job_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ev_page ON event_log(page_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ev_stage ON event_log(stage)')

    # ═══════════════════════════════════════════════════════════════════
    # v4 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── url_graph_edge ──
    c.execute('''CREATE TABLE IF NOT EXISTS url_graph_edge (
        eid INTEGER PRIMARY KEY AUTOINCREMENT,
        from_page_id INTEGER NOT NULL REFERENCES page(page_id),
        to_url_norm TEXT NOT NULL,
        to_domain_id INTEGER REFERENCES domain(domain_id),
        edge_type TEXT NOT NULL CHECK(edge_type IN ('INTERNAL_LINK','EXTERNAL_LINK','REDIRECT','CANONICAL','HREFLANG')),
        rel TEXT,
        anchor_hash TEXT,
        first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        snap_id INTEGER REFERENCES page_snapshot(snap_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_uge_from ON url_graph_edge(from_page_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_uge_type ON url_graph_edge(edge_type)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_uge_to_domain ON url_graph_edge(to_domain_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_uge_last_seen ON url_graph_edge(last_seen_at)')

    # ── canonical_cluster ──
    c.execute('''CREATE TABLE IF NOT EXISTS canonical_cluster (
        cluster_id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER REFERENCES domain(domain_id),
        cluster_key TEXT NOT NULL,
        representative_page_id INTEGER REFERENCES page(page_id),
        size INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cc_domain ON canonical_cluster(domain_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cc_key ON canonical_cluster(cluster_key)')

    # ── cluster_member ──
    c.execute('''CREATE TABLE IF NOT EXISTS cluster_member (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cluster_id INTEGER NOT NULL REFERENCES canonical_cluster(cluster_id),
        page_id INTEGER NOT NULL REFERENCES page(page_id),
        role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('REPRESENTATIVE','MEMBER')),
        UNIQUE(cluster_id, page_id))''')

    # ── site_hint ──
    c.execute('''CREATE TABLE IF NOT EXISTS site_hint (
        domain_id INTEGER PRIMARY KEY REFERENCES domain(domain_id),
        appears_multilingual INTEGER NOT NULL DEFAULT 0,
        has_sitemap INTEGER NOT NULL DEFAULT 0,
        sitemap_url TEXT,
        cms_fingerprint TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')

    # ── alert_rule (v6: segment_id, baseline) ──
    c.execute('''CREATE TABLE IF NOT EXISTS alert_rule (
        rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        scope TEXT NOT NULL CHECK(scope IN ('DOMAIN','PAGE','CLUSTER')),
        predicate_json TEXT NOT NULL DEFAULT '{}',
        severity TEXT NOT NULL DEFAULT 'WARNING' CHECK(severity IN ('CRITICAL','WARNING','INFO')),
        cooldown_minutes INTEGER NOT NULL DEFAULT 60,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        segment_id INTEGER,
        baseline_metric_key TEXT,
        baseline_threshold TEXT CHECK(baseline_threshold IN ('P90','P75','P50') OR baseline_threshold IS NULL),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')

    # ── alert_event (v7: ticket_id, kpi_key, baseline_ref_json) ──
    c.execute('''CREATE TABLE IF NOT EXISTS alert_event (
        aid INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER NOT NULL REFERENCES alert_rule(rule_id),
        domain_id INTEGER,
        page_id INTEGER,
        cluster_id INTEGER,
        job_id INTEGER,
        snap_id INTEGER,
        severity TEXT NOT NULL CHECK(severity IN ('CRITICAL','WARNING','INFO')),
        message TEXT NOT NULL,
        payload_json TEXT DEFAULT '{}',
        ticket_id INTEGER,
        kpi_key TEXT,
        baseline_ref_json TEXT,
        fired_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_rule ON alert_event(rule_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_domain ON alert_event(domain_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_fired ON alert_event(fired_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_severity ON alert_event(severity)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_ticket ON alert_event(ticket_id)')

    # ═══════════════════════════════════════════════════════════════════
    # v5 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── golden_rule: versioned rule sets ──
    c.execute('''CREATE TABLE IF NOT EXISTS golden_rule (
        rule_set_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        version INTEGER NOT NULL DEFAULT 1,
        scoring_json TEXT NOT NULL DEFAULT '{}',
        issue_taxonomy_json TEXT NOT NULL DEFAULT '[]',
        penalties_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_active INTEGER NOT NULL DEFAULT 1,
        frozen_at TEXT,
        notes TEXT)''')

    # ── snapshot_rule_binding: links snapshot to active rule set ──
    c.execute('''CREATE TABLE IF NOT EXISTS snapshot_rule_binding (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        rule_set_id INTEGER NOT NULL REFERENCES golden_rule(rule_set_id),
        UNIQUE(snap_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_srb_rule ON snapshot_rule_binding(rule_set_id)')

    # ── qa_sample (v7: ticket_id) ──
    c.execute('''CREATE TABLE IF NOT EXISTS qa_sample (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        job_id INTEGER REFERENCES crawl_job(job_id),
        reason TEXT NOT NULL CHECK(reason IN ('NEW_DOMAIN','VOLATILE','ALERT_FIRED','RANDOM','MANUAL')),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','REVIEWED','APPROVED','REJECTED')),
        reviewer_notes TEXT,
        ticket_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        reviewed_at TEXT)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_qa_status ON qa_sample(status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_qa_job ON qa_sample(job_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_qa_reason ON qa_sample(reason)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_qa_ticket ON qa_sample(ticket_id)')

    # ── drift_check: determinism verification ──
    c.execute('''CREATE TABLE IF NOT EXISTS drift_check (
        check_id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER NOT NULL REFERENCES page(page_id),
        snap_a_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        snap_b_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        rule_set_id INTEGER REFERENCES golden_rule(rule_set_id),
        issues_sha256_a TEXT,
        issues_sha256_b TEXT,
        is_deterministic INTEGER NOT NULL DEFAULT 1,
        drift_details_json TEXT DEFAULT '{}',
        checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_dc_page ON drift_check(page_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_dc_determ ON drift_check(is_deterministic)')

    # ── export_job (v8: view_id, redaction_applied, public_artifact_sha256) ──
    c.execute('''CREATE TABLE IF NOT EXISTS export_job (
        export_id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER REFERENCES crawl_job(job_id),
        export_type TEXT NOT NULL CHECK(export_type IN ('CSV','JSON','HTML','PDF','PAIR_REPORT')),
        output_path TEXT NOT NULL,
        row_count INTEGER NOT NULL DEFAULT 0,
        artifact_sha256 TEXT,
        view_id INTEGER REFERENCES export_view(view_id),
        redaction_applied INTEGER NOT NULL DEFAULT 0,
        public_artifact_sha256 TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        notes TEXT)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ej_type ON export_job(export_type)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ej_view ON export_job(view_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ej_created ON export_job(created_at)')

    # ═══════════════════════════════════════════════════════════════════
    # v6 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── segment: competitor grouping ──
    c.execute('''CREATE TABLE IF NOT EXISTS segment (
        segment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        definition_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_enabled INTEGER NOT NULL DEFAULT 1)''')

    # ── domain_segment: domain ↔ segment mapping (many-to-many) ──
    c.execute('''CREATE TABLE IF NOT EXISTS domain_segment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER NOT NULL REFERENCES domain(domain_id),
        segment_id INTEGER NOT NULL REFERENCES segment(segment_id),
        weight REAL NOT NULL DEFAULT 1.0,
        assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(domain_id, segment_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ds_domain ON domain_segment(domain_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ds_segment ON domain_segment(segment_id)')

    # ── baseline_stat: per-segment rolling baseline ──
    c.execute('''CREATE TABLE IF NOT EXISTS baseline_stat (
        bid INTEGER PRIMARY KEY AUTOINCREMENT,
        segment_id INTEGER NOT NULL REFERENCES segment(segment_id),
        rule_set_id INTEGER REFERENCES golden_rule(rule_set_id),
        window_days INTEGER NOT NULL DEFAULT 30,
        metric_key TEXT NOT NULL,
        p50 REAL, p75 REAL, p90 REAL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bs_segment ON baseline_stat(segment_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bs_rule ON baseline_stat(rule_set_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bs_metric ON baseline_stat(metric_key)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bs_created ON baseline_stat(created_at)')

    # ── comparison_pair: fixed A/B competitor pairing ──
    c.execute('''CREATE TABLE IF NOT EXISTS comparison_pair (
        pid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        segment_id INTEGER REFERENCES segment(segment_id),
        left_domain_id INTEGER NOT NULL REFERENCES domain(domain_id),
        right_domain_id INTEGER NOT NULL REFERENCES domain(domain_id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_enabled INTEGER NOT NULL DEFAULT 1)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cp_segment ON comparison_pair(segment_id)')

    # ═══════════════════════════════════════════════════════════════════
    # v7 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── kpi_definition: fixed KPI dictionary ──
    c.execute('''CREATE TABLE IF NOT EXISTS kpi_definition (
        kpi_id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        rule_set_id INTEGER REFERENCES golden_rule(rule_set_id),
        compute_sql TEXT,
        unit TEXT NOT NULL DEFAULT 'ratio',
        direction TEXT NOT NULL DEFAULT 'LOWER_BETTER' CHECK(direction IN ('HIGHER_BETTER','LOWER_BETTER')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_enabled INTEGER NOT NULL DEFAULT 1,
        UNIQUE(key, rule_set_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kd_key ON kpi_definition(key)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kd_rule ON kpi_definition(rule_set_id)')

    # ── kpi_value: KPI time-series data ──
    c.execute('''CREATE TABLE IF NOT EXISTS kpi_value (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kpi_id INTEGER NOT NULL REFERENCES kpi_definition(kpi_id),
        scope TEXT NOT NULL CHECK(scope IN ('DOMAIN','SEGMENT','PAIR','JOB')),
        scope_id INTEGER NOT NULL,
        window_days INTEGER NOT NULL DEFAULT 7,
        value REAL NOT NULL,
        as_of_date TEXT NOT NULL,
        job_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(kpi_id, scope, scope_id, window_days, as_of_date))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kv_kpi ON kpi_value(kpi_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kv_scope ON kpi_value(scope,scope_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kv_date ON kpi_value(as_of_date)')

    # ── fix_ticket: internal tracking tickets ──
    c.execute('''CREATE TABLE IF NOT EXISTS fix_ticket (
        tid INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL CHECK(source IN ('ALERT','QA','MANUAL')),
        domain_id INTEGER,
        page_id INTEGER,
        cluster_id INTEGER,
        issue_code TEXT,
        rule_set_id INTEGER,
        severity TEXT NOT NULL DEFAULT 'WARNING' CHECK(severity IN ('CRITICAL','WARNING','INFO')),
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ACK','FIXED','WONTFIX')),
        opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        closed_at TEXT,
        note TEXT)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ft_status ON fix_ticket(status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ft_severity ON fix_ticket(severity)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ft_opened ON fix_ticket(opened_at)')

    # ── ticket_link: evidence chain ──
    c.execute('''CREATE TABLE IF NOT EXISTS ticket_link (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tid INTEGER NOT NULL REFERENCES fix_ticket(tid),
        kind TEXT NOT NULL CHECK(kind IN ('SNAPSHOT','ALERT','EXPORT','EVENT')),
        ref_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(tid, kind, ref_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_tl_tid ON ticket_link(tid)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_tl_kind ON ticket_link(kind)')

    # ═══════════════════════════════════════════════════════════════════
    # v8 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── policy: system-level rules ──
    c.execute('''CREATE TABLE IF NOT EXISTS policy (
        policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        version TEXT NOT NULL,
        content_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_active INTEGER NOT NULL DEFAULT 1,
        UNIQUE(key, version))''')

    # ── policy_binding: bind policy to job/export/ticket ──
    c.execute('''CREATE TABLE IF NOT EXISTS policy_binding (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK(kind IN ('JOB','EXPORT','TICKET')),
        ref_id INTEGER NOT NULL,
        policy_id INTEGER NOT NULL REFERENCES policy(policy_id),
        bound_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(kind, ref_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_pb_kind ON policy_binding(kind)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_pb_policy ON policy_binding(policy_id)')

    # ── redaction_rule: output sanitization ──
    c.execute('''CREATE TABLE IF NOT EXISTS redaction_rule (
        rid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pattern TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('MASK','DROP','HASH')),
        scope TEXT NOT NULL CHECK(scope IN ('EXPORT','LOG','ARTIFACT')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_enabled INTEGER NOT NULL DEFAULT 1)''')

    # ── export_view: PUBLIC/INTERNAL field restrictions ──
    c.execute('''CREATE TABLE IF NOT EXISTS export_view (
        view_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        allowed_fields_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')

    # ═══════════════════════════════════════════════════════════════════
    # v9 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── cost_ledger: per-stage cost tracking ──
    c.execute('''CREATE TABLE IF NOT EXISTS cost_ledger (
        cid INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER REFERENCES crawl_job(job_id),
        domain_id INTEGER REFERENCES domain(domain_id),
        page_id INTEGER REFERENCES page(page_id),
        snap_id INTEGER,
        stage TEXT NOT NULL CHECK(stage IN ('ROBOTS','FETCH','PARSE','AUDIT','ARTIFACT','DELTA','EXPORT')),
        units REAL NOT NULL DEFAULT 0,
        unit_type TEXT NOT NULL CHECK(unit_type IN ('REQ','KB','TOKENS','MS','ROWS')),
        unit_cost REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD','TWD')),
        cost_total REAL NOT NULL DEFAULT 0,
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        meta_json TEXT NOT NULL DEFAULT '{}')''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cl_job ON cost_ledger(job_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cl_stage ON cost_ledger(stage)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cl_ts ON cost_ledger(ts)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cl_domain ON cost_ledger(domain_id)')

    # ── budget_policy: versioned budget rules ──
    c.execute('''CREATE TABLE IF NOT EXISTS budget_policy (
        bid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD','TWD')),
        window TEXT NOT NULL DEFAULT 'JOB' CHECK(window IN ('JOB','DAILY','WEEKLY','MONTHLY')),
        limit_total REAL NOT NULL DEFAULT 2.0,
        limit_per_domain REAL,
        limit_per_job REAL,
        actions_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_active INTEGER NOT NULL DEFAULT 1,
        UNIQUE(name, version))''')

    # ── budget_binding: job-to-budget binding ──
    c.execute('''CREATE TABLE IF NOT EXISTS budget_binding (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES crawl_job(job_id),
        bid INTEGER NOT NULL REFERENCES budget_policy(bid),
        bound_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(job_id))''')

    # ═══════════════════════════════════════════════════════════════════
    # v10 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── replay_plan: regression test plan for rule_set upgrades ──
    c.execute('''CREATE TABLE IF NOT EXISTS replay_plan (
        rid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        from_rule_set_id INTEGER NOT NULL REFERENCES golden_rule(rule_set_id),
        to_rule_set_id INTEGER NOT NULL REFERENCES golden_rule(rule_set_id),
        segment_id INTEGER REFERENCES segment(segment_id),
        sample_size INTEGER NOT NULL DEFAULT 200,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','DONE','FAILED')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        finished_at TEXT)''')

    # ── replay_item: fixed sample list for replay ──
    c.execute('''CREATE TABLE IF NOT EXISTS replay_item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid INTEGER NOT NULL REFERENCES replay_plan(rid),
        snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        html_sha256 TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','DONE','FAILED')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(rid, snap_id))''')

    # ── replay_result: per-snapshot diff output ──
    c.execute('''CREATE TABLE IF NOT EXISTS replay_result (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid INTEGER NOT NULL REFERENCES replay_plan(rid),
        snap_id INTEGER NOT NULL,
        to_rule_set_id INTEGER NOT NULL,
        issues_sha256_new TEXT,
        score_total_new INTEGER,
        issue_added_json TEXT NOT NULL DEFAULT '[]',
        issue_removed_json TEXT NOT NULL DEFAULT '[]',
        score_delta INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(rid, snap_id, to_rule_set_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_rr_rid ON replay_result(rid)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_rr_rs ON replay_result(to_rule_set_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_rr_delta ON replay_result(score_delta)')

    # ── release_gate: pass/fail gate for rule_set/policy/budget upgrades ──
    c.execute('''CREATE TABLE IF NOT EXISTS release_gate (
        gid INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK(kind IN ('RULE_SET','POLICY','BUDGET')),
        from_version TEXT,
        to_version TEXT,
        criteria_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PASS','FAIL')),
        evidence_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        decided_at TEXT)''')

    # ═══════════════════════════════════════════════════════════════════
    # v11 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── ingest_source: data source registry ──
    c.execute('''CREATE TABLE IF NOT EXISTS ingest_source (
        sid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL CHECK(kind IN ('SEED','SITEMAP','DISCOVERY','MANUAL','PAIR_FIXED')),
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_enabled INTEGER NOT NULL DEFAULT 1)''')

    # ── frontier_source_link: frontier ↔ ingest_source (auditable) ──
    c.execute('''CREATE TABLE IF NOT EXISTS frontier_source_link (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fid INTEGER NOT NULL,
        sid INTEGER NOT NULL REFERENCES ingest_source(sid),
        linked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(fid, sid))''')

    # ── pair_fixed_page: fixed comparison pair pages per intent ──
    c.execute('''CREATE TABLE IF NOT EXISTS pair_fixed_page (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pair_id INTEGER NOT NULL REFERENCES comparison_pair(pid),
        intent_flag TEXT NOT NULL CHECK(intent_flag IN ('HOME','PRICING','DOCS','LOGIN','SIGNUP')),
        url_norm TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(pair_id, intent_flag, url_norm))''')

    # ── coverage_matrix: intent coverage tracking per scope ──
    c.execute('''CREATE TABLE IF NOT EXISTS coverage_matrix (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL CHECK(scope IN ('DOMAIN','SEGMENT','PAIR')),
        scope_id INTEGER NOT NULL,
        intent_flag TEXT NOT NULL CHECK(intent_flag IN ('HOME','PRICING','DOCS','BLOG','LOGIN','SIGNUP')),
        rule_set_id INTEGER,
        as_of_date TEXT NOT NULL,
        pages_seen INTEGER NOT NULL DEFAULT 0,
        rep_pages_seen INTEGER NOT NULL DEFAULT 0,
        coverage_pct REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(scope, scope_id, intent_flag, as_of_date, rule_set_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cm_scope ON coverage_matrix(scope)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cm_sid ON coverage_matrix(scope_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cm_date ON coverage_matrix(as_of_date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_cm_intent ON coverage_matrix(intent_flag)')

    # ═══════════════════════════════════════════════════════════════════
    # v12 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── integrity_gate: data completeness rules ──
    c.execute('''CREATE TABLE IF NOT EXISTS integrity_gate (
        igid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rule_set_id INTEGER,
        requirements_json TEXT NOT NULL DEFAULT '{}',
        severity TEXT NOT NULL DEFAULT 'CRITICAL' CHECK(severity IN ('CRITICAL','WARNING')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_enabled INTEGER NOT NULL DEFAULT 1,
        UNIQUE(name, rule_set_id))''')

    # ── snapshot_integrity: per-snapshot integrity check result ──
    c.execute('''CREATE TABLE IF NOT EXISTS snapshot_integrity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snap_id INTEGER NOT NULL REFERENCES page_snapshot(snap_id),
        igid INTEGER NOT NULL REFERENCES integrity_gate(igid),
        status TEXT NOT NULL DEFAULT 'PASS' CHECK(status IN ('PASS','FAIL')),
        missing_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(snap_id, igid))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_si_igid ON snapshot_integrity(igid)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_si_status ON snapshot_integrity(status)')

    # ── kpi_filter: versioned KPI computation filters ──
    c.execute('''CREATE TABLE IF NOT EXISTS kpi_filter (
        fid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rule_set_id INTEGER,
        predicate_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_enabled INTEGER NOT NULL DEFAULT 1,
        UNIQUE(name, rule_set_id))''')

    # ── data_quality_daily: daily data quality dashboard ──
    c.execute('''CREATE TABLE IF NOT EXISTS data_quality_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        as_of_date TEXT NOT NULL,
        rule_set_id INTEGER,
        scope TEXT NOT NULL DEFAULT 'GLOBAL' CHECK(scope IN ('GLOBAL','SEGMENT','DOMAIN')),
        scope_id INTEGER,
        snapshot_pass_rate REAL NOT NULL DEFAULT 0,
        audit_incomplete_rate REAL NOT NULL DEFAULT 0,
        parse_fail_rate REAL NOT NULL DEFAULT 0,
        fetch_not_html_rate REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(as_of_date, rule_set_id, scope, scope_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_dqd_date ON data_quality_daily(as_of_date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_dqd_scope ON data_quality_daily(scope)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_dqd_sid ON data_quality_daily(scope_id)')

    # ═══════════════════════════════════════════════════════════════════
    # v13 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── lineage_edge: directed graph of data lineage ──
    c.execute('''CREATE TABLE IF NOT EXISTS lineage_edge (
        lid INTEGER PRIMARY KEY AUTOINCREMENT,
        from_kind TEXT NOT NULL,
        from_id INTEGER NOT NULL,
        to_kind TEXT NOT NULL,
        to_id INTEGER NOT NULL,
        edge_type TEXT NOT NULL,
        job_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        meta_json TEXT DEFAULT '{}',
        UNIQUE(from_kind, from_id, to_kind, to_id, edge_type))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_le_from ON lineage_edge(from_kind, from_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_le_to ON lineage_edge(to_kind, to_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_le_edge ON lineage_edge(edge_type)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_le_job ON lineage_edge(job_id)')

    # ── snapshot_sample_set: fixed monitoring sample sets ──
    c.execute('''CREATE TABLE IF NOT EXISTS snapshot_sample_set (
        ssid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        strategy TEXT NOT NULL DEFAULT 'STRATIFIED' CHECK(strategy IN ('RANDOM','STRATIFIED','TOP_N')),
        sample_size INTEGER NOT NULL DEFAULT 200,
        rule_set_id INTEGER,
        segment_id INTEGER,
        refresh_interval_days INTEGER NOT NULL DEFAULT 7,
        last_refreshed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        is_active INTEGER NOT NULL DEFAULT 1,
        UNIQUE(name, rule_set_id))''')

    # ── sample_member: pages belonging to a sample set ──
    c.execute('''CREATE TABLE IF NOT EXISTS sample_member (
        mid INTEGER PRIMARY KEY AUTOINCREMENT,
        ssid INTEGER NOT NULL REFERENCES snapshot_sample_set(ssid),
        page_id INTEGER NOT NULL REFERENCES page(page_id),
        added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        reason TEXT,
        UNIQUE(ssid, page_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_sm_ssid ON sample_member(ssid)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_sm_page ON sample_member(page_id)')

    # ── stability_stat: per-sample-set stability metrics ──
    c.execute('''CREATE TABLE IF NOT EXISTS stability_stat (
        stid INTEGER PRIMARY KEY AUTOINCREMENT,
        ssid INTEGER NOT NULL REFERENCES snapshot_sample_set(ssid),
        as_of_date TEXT NOT NULL,
        rule_set_id INTEGER,
        member_count INTEGER NOT NULL DEFAULT 0,
        score_mean REAL NOT NULL DEFAULT 0,
        score_stddev REAL NOT NULL DEFAULT 0,
        critical_flip_rate REAL NOT NULL DEFAULT 0,
        issues_hash_flip_rate REAL NOT NULL DEFAULT 0,
        stable_pct REAL NOT NULL DEFAULT 0,
        alert_level TEXT NOT NULL DEFAULT 'OK' CHECK(alert_level IN ('OK','WARNING','CRITICAL')),
        details_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(ssid, as_of_date, rule_set_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ss_ssid ON stability_stat(ssid)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ss_date ON stability_stat(as_of_date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ss_alert ON stability_stat(alert_level)')

    # ═══════════════════════════════════════════════════════════════════
    # v14 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── anomaly_detector: statistical anomaly detection rules ──
    c.execute('''CREATE TABLE IF NOT EXISTS anomaly_detector (
        adid INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rule_set_id INTEGER,
        scope TEXT NOT NULL DEFAULT 'GLOBAL' CHECK(scope IN ('DOMAIN','SEGMENT','PAIR','GLOBAL')),
        metric_key TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'ZSCORE' CHECK(method IN ('ZSCORE','PCTL','DELTA_RATE')),
        params_json TEXT NOT NULL DEFAULT '{}',
        severity TEXT NOT NULL DEFAULT 'WARNING' CHECK(severity IN ('CRITICAL','WARNING','INFO')),
        cooldown_minutes INTEGER NOT NULL DEFAULT 360,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(name, rule_set_id))''')

    # ── anomaly_event: detected anomalies (separate from alert_event) ──
    c.execute('''CREATE TABLE IF NOT EXISTS anomaly_event (
        aeid INTEGER PRIMARY KEY AUTOINCREMENT,
        adid INTEGER NOT NULL REFERENCES anomaly_detector(adid),
        scope TEXT NOT NULL DEFAULT 'GLOBAL' CHECK(scope IN ('DOMAIN','SEGMENT','PAIR','GLOBAL')),
        scope_id INTEGER,
        rule_set_id INTEGER,
        metric_key TEXT NOT NULL,
        value REAL NOT NULL,
        baseline_json TEXT NOT NULL DEFAULT '{}',
        severity TEXT NOT NULL DEFAULT 'WARNING' CHECK(severity IN ('CRITICAL','WARNING','INFO')),
        message TEXT,
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_ts ON anomaly_event(ts)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_sev ON anomaly_event(severity)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_mk ON anomaly_event(metric_key)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_ae_scope ON anomaly_event(scope)')

    # ── kpi_baseline_daily: daily KPI baselines for anomaly detection ──
    c.execute('''CREATE TABLE IF NOT EXISTS kpi_baseline_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        as_of_date TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'GLOBAL' CHECK(scope IN ('DOMAIN','SEGMENT','PAIR','GLOBAL')),
        scope_id INTEGER,
        rule_set_id INTEGER,
        metric_key TEXT NOT NULL,
        window_days INTEGER NOT NULL DEFAULT 14,
        mean REAL NOT NULL DEFAULT 0,
        stddev REAL NOT NULL DEFAULT 0,
        p50 REAL NOT NULL DEFAULT 0,
        p75 REAL NOT NULL DEFAULT 0,
        p90 REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(as_of_date, scope, scope_id, rule_set_id, metric_key, window_days))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kbd_date ON kpi_baseline_daily(as_of_date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kbd_scope ON kpi_baseline_daily(scope)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kbd_sid ON kpi_baseline_daily(scope_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_kbd_mk ON kpi_baseline_daily(metric_key)')

    # ═══════════════════════════════════════════════════════════════════
    # v15 new tables
    # ═══════════════════════════════════════════════════════════════════

    # ── resolver_cache: DNS/TLS resolution cache per domain ──
    c.execute('''CREATE TABLE IF NOT EXISTS resolver_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER NOT NULL UNIQUE REFERENCES domain(domain_id),
        dns_ok INTEGER NOT NULL DEFAULT 1,
        tls_ok INTEGER NOT NULL DEFAULT 1,
        last_ip_json TEXT,
        last_error TEXT,
        checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        cooldown_until TEXT)''')

    # ── http_fingerprint: server/CDN/cache header fingerprints ──
    c.execute('''CREATE TABLE IF NOT EXISTS http_fingerprint (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER NOT NULL REFERENCES domain(domain_id),
        sha256 TEXT NOT NULL,
        server TEXT,
        powered_by TEXT,
        cdn_hint TEXT,
        cache_control TEXT,
        vary TEXT,
        etag_present INTEGER NOT NULL DEFAULT 0,
        hsts_present INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(domain_id, sha256))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_hf_did ON http_fingerprint(domain_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_hf_created ON http_fingerprint(created_at)')

    # ── domain_health_daily: daily domain fetch/DNS/TLS health ──
    c.execute('''CREATE TABLE IF NOT EXISTS domain_health_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER NOT NULL REFERENCES domain(domain_id),
        as_of_date TEXT NOT NULL,
        rule_set_id INTEGER,
        dns_ok_rate REAL NOT NULL DEFAULT 1.0,
        tls_ok_rate REAL NOT NULL DEFAULT 1.0,
        fetch_success_rate REAL NOT NULL DEFAULT 1.0,
        http_304_ratio REAL NOT NULL DEFAULT 0,
        avg_fetch_ms REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        UNIQUE(domain_id, as_of_date, rule_set_id))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_dhd_date ON domain_health_daily(as_of_date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_dhd_fsr ON domain_health_daily(fetch_success_rate)')


def _seed_issues(c):
    for code, severity, family, penalty, message in ISSUE_TAXONOMY:
        c.execute('INSERT OR IGNORE INTO issue (code, severity, family, default_penalty, message) VALUES (?,?,?,?,?)',
                  (code, severity, family, penalty, message))
        c.execute('UPDATE issue SET severity=?,family=?,default_penalty=?,message=? WHERE code=?',
                  (severity, family, penalty, message, code))


def _seed_default_alert_rules(c):
    """Insert built-in alert rules (idempotent)."""
    defaults = [
        ("score_drop_20",   "DOMAIN", {"type": "score_drop", "threshold": 20},  "WARNING",  60),
        ("new_critical",    "PAGE",   {"type": "new_issue",  "severity": "CRITICAL"}, "CRITICAL", 120),
        ("robots_noindex",  "PAGE",   {"type": "new_issue",  "code": "ROBOTS_NOINDEX"}, "WARNING", 1440),
        ("sitemap_gone",    "DOMAIN", {"type": "sitemap_disappeared"}, "CRITICAL", 1440),
        ("canonical_drift", "CLUSTER",{"type": "cluster_size_spike", "threshold": 5}, "WARNING", 360),
    ]
    for name, scope, pred, sev, cool in defaults:
        c.execute('SELECT rule_id FROM alert_rule WHERE name=?', (name,))
        if not c.fetchone():
            c.execute('INSERT INTO alert_rule (name,scope,predicate_json,severity,cooldown_minutes) VALUES (?,?,?,?,?)',
                      (name, scope, json.dumps(pred), sev, cool))


def _seed_golden_rule(c):
    """Insert default v5_initial rule set (idempotent)."""
    c.execute('SELECT rule_set_id FROM golden_rule WHERE name=?', ('v5_initial',))
    if not c.fetchone():
        c.execute('''INSERT INTO golden_rule (name,version,scoring_json,issue_taxonomy_json,penalties_json,notes)
                     VALUES (?,?,?,?,?,?)''',
                  ('v5_initial', 1,
                   json.dumps(SCORING, ensure_ascii=False),
                   json.dumps(ISSUE_TAXONOMY, ensure_ascii=False),
                   json.dumps(SCORING["penalties"], ensure_ascii=False),
                   'Default v5 rule set — seeded at init'))


def get_active_rule_set(c=None):
    """Get the currently active golden_rule. Returns dict or None."""
    own_conn = c is None
    if own_conn:
        conn = get_conn()
        c = conn.cursor()
    try:
        c.execute('SELECT rule_set_id,name,version,scoring_json,issue_taxonomy_json,penalties_json FROM golden_rule WHERE is_active=1 ORDER BY rule_set_id DESC LIMIT 1')
        r = c.fetchone()
        if r:
            return {"rule_set_id": r[0], "name": r[1], "version": r[2],
                    "scoring": json.loads(r[3]), "taxonomy": json.loads(r[4]),
                    "penalties": json.loads(r[5])}
        return None
    finally:
        if own_conn:
            conn.close()


def _seed_segment_templates(c):
    """Insert default segment templates (idempotent)."""
    for tpl in SEGMENT_TEMPLATES:
        c.execute('SELECT segment_id FROM segment WHERE name=?', (tpl["name"],))
        if not c.fetchone():
            c.execute('INSERT INTO segment (name,definition_json) VALUES (?,?)',
                      (tpl["name"], json.dumps(tpl["definition_json"], ensure_ascii=False)))


def _seed_kpi_templates(c):
    """Insert default KPI definitions tied to the active rule set (idempotent)."""
    c.execute('SELECT rule_set_id FROM golden_rule WHERE is_active=1 ORDER BY rule_set_id DESC LIMIT 1')
    r = c.fetchone()
    rs_id = r[0] if r else None
    if not rs_id:
        return
    for tpl in KPI_TEMPLATES:
        c.execute('SELECT kpi_id FROM kpi_definition WHERE key=? AND rule_set_id=?',
                  (tpl["key"], rs_id))
        if not c.fetchone():
            c.execute('''INSERT INTO kpi_definition (key,name,rule_set_id,unit,direction)
                         VALUES (?,?,?,?,?)''',
                      (tpl["key"], tpl["name"], rs_id, tpl["unit"], tpl["direction"]))


def _seed_policy_templates(c):
    """Insert default policy (idempotent)."""
    for tpl in POLICY_TEMPLATES:
        c.execute('SELECT policy_id FROM policy WHERE key=? AND version=?',
                  (tpl["key"], tpl["version"]))
        if not c.fetchone():
            c.execute('INSERT INTO policy (key,version,content_json) VALUES (?,?,?)',
                      (tpl["key"], tpl["version"],
                       json.dumps(tpl["content_json"], ensure_ascii=False)))


def _seed_redaction_rules(c):
    """Insert default redaction rules (idempotent)."""
    for tpl in REDACTION_TEMPLATES:
        c.execute('SELECT rid FROM redaction_rule WHERE name=?', (tpl["name"],))
        if not c.fetchone():
            c.execute('INSERT INTO redaction_rule (name,pattern,action,scope) VALUES (?,?,?,?)',
                      (tpl["name"], tpl["pattern"], tpl["action"], tpl["scope"]))


def _seed_export_views(c):
    """Insert default export views (idempotent)."""
    for vdef in EXPORT_VIEW_DEFS:
        c.execute('SELECT view_id FROM export_view WHERE name=?', (vdef["name"],))
        if not c.fetchone():
            c.execute('INSERT INTO export_view (name,allowed_fields_json) VALUES (?,?)',
                      (vdef["name"], json.dumps(vdef["allowed_fields_json"])))


def get_active_policy(c=None):
    """Get the currently active policy. Returns dict or None."""
    own_conn = c is None
    if own_conn:
        conn = get_conn(); c = conn.cursor()
    try:
        c.execute('SELECT policy_id,key,version,content_json FROM policy WHERE is_active=1 ORDER BY policy_id DESC LIMIT 1')
        r = c.fetchone()
        if r:
            return {"policy_id": r[0], "key": r[1], "version": r[2],
                    "content": json.loads(r[3])}
        return None
    finally:
        if own_conn: conn.close()


def bind_policy(c, kind, ref_id, policy_id=None):
    """POLICY_GATE: bind active policy to a JOB/EXPORT/TICKET. Returns policy_id."""
    if policy_id is None:
        pol = get_active_policy(c)
        if not pol:
            _log(c, "POLICY", "ERROR", "POLICY_NOT_BOUND", f"no active policy for {kind}={ref_id}")
            return None
        policy_id = pol["policy_id"]
    c.execute('INSERT OR IGNORE INTO policy_binding (kind,ref_id,policy_id) VALUES (?,?,?)',
              (kind, ref_id, policy_id))
    return policy_id


def get_export_view(c, view_name):
    """Get export_view by name. Returns dict or None."""
    c.execute('SELECT view_id,name,allowed_fields_json FROM export_view WHERE name=?', (view_name,))
    r = c.fetchone()
    if r:
        return {"view_id": r[0], "name": r[1], "allowed_fields": json.loads(r[2])}
    return None


def apply_redaction(text_value, scope="EXPORT"):
    """Apply enabled redaction rules to a text value. Returns sanitized text."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT pattern,action FROM redaction_rule WHERE is_enabled=1 AND scope=?', (scope,))
        rules = c.fetchall()
        result = text_value
        if result is None:
            return None
        for pattern, action in rules:
            if action == "MASK":
                result = re.sub(pattern, "***REDACTED***", str(result))
            elif action == "DROP":
                if re.search(pattern, str(result)):
                    return None
            elif action == "HASH":
                result = re.sub(pattern, lambda m: hashlib.sha256(m.group().encode()).hexdigest()[:16], str(result))
        return result
    finally:
        conn.close()


def _seed_integrity_gates(c):
    """Insert default integrity gate templates (idempotent)."""
    rs = get_active_rule_set(c)
    rs_id = rs["rule_set_id"] if rs else None
    for tpl in INTEGRITY_TEMPLATES:
        c.execute('SELECT igid FROM integrity_gate WHERE name=? AND rule_set_id IS ?',
                  (tpl["name"], rs_id))
        if not c.fetchone():
            c.execute('''INSERT INTO integrity_gate (name,rule_set_id,requirements_json,severity)
                         VALUES (?,?,?,?)''',
                      (tpl["name"], rs_id,
                       json.dumps(tpl["requirements_json"], ensure_ascii=False),
                       tpl["severity"]))


def _seed_kpi_filter(c):
    """Insert default KPI filter (idempotent)."""
    rs = get_active_rule_set(c)
    rs_id = rs["rule_set_id"] if rs else None
    tpl = KPI_FILTER_TEMPLATE
    c.execute('SELECT fid FROM kpi_filter WHERE name=? AND rule_set_id IS ?',
              (tpl["name"], rs_id))
    if not c.fetchone():
        c.execute('INSERT INTO kpi_filter (name,rule_set_id,predicate_json) VALUES (?,?,?)',
                  (tpl["name"], rs_id,
                   json.dumps(tpl["predicate_json"], ensure_ascii=False)))


def _seed_anomaly_detectors(c):
    """Insert default anomaly detector templates (idempotent)."""
    rs = get_active_rule_set(c)
    rs_id = rs["rule_set_id"] if rs else None
    for tpl in ANOMALY_TEMPLATES:
        c.execute('SELECT adid FROM anomaly_detector WHERE name=? AND rule_set_id IS ?',
                  (tpl["name"], rs_id))
        if not c.fetchone():
            c.execute('''INSERT INTO anomaly_detector
                (name,rule_set_id,scope,metric_key,method,params_json,severity,cooldown_minutes)
                VALUES (?,?,?,?,?,?,?,?)''',
                (tpl["name"], rs_id, tpl["scope"], tpl["metric_key"],
                 tpl["method"], json.dumps(tpl["params_json"], ensure_ascii=False),
                 tpl["severity"], tpl.get("cooldown_minutes", ANOMALY_DEFAULT_COOLDOWN)))


def _seed_ingest_sources(c):
    """Insert default ingest sources (idempotent)."""
    for src in DEFAULT_INGEST_SOURCES:
        c.execute('SELECT sid FROM ingest_source WHERE name=?', (src["name"],))
        if not c.fetchone():
            c.execute('INSERT INTO ingest_source (name,kind,config_json) VALUES (?,?,?)',
                      (src["name"], src["kind"], json.dumps(src["config_json"], ensure_ascii=False)))


def _seed_budget_policy(c):
    """Insert default budget policy (idempotent)."""
    tpl = BUDGET_POLICY_TEMPLATE
    c.execute('SELECT bid FROM budget_policy WHERE name=? AND version=?',
              (tpl["name"], tpl["version"]))
    if not c.fetchone():
        c.execute('''INSERT INTO budget_policy (name,version,currency,window,limit_total,limit_per_domain,limit_per_job,actions_json)
                     VALUES (?,?,?,?,?,?,?,?)''',
                  (tpl["name"], tpl["version"], tpl["currency"], tpl["window"],
                   tpl["limit_total"], tpl["limit_per_domain"], tpl["limit_per_job"],
                   json.dumps(tpl["actions_json"], ensure_ascii=False)))


def get_active_budget(c=None):
    """Get the currently active budget_policy. Returns dict or None."""
    own_conn = c is None
    if own_conn:
        conn = get_conn(); c = conn.cursor()
    try:
        c.execute('SELECT bid,name,version,currency,window,limit_total,limit_per_domain,limit_per_job,actions_json FROM budget_policy WHERE is_active=1 ORDER BY bid DESC LIMIT 1')
        r = c.fetchone()
        if r:
            return {"bid": r[0], "name": r[1], "version": r[2], "currency": r[3],
                    "window": r[4], "limit_total": r[5], "limit_per_domain": r[6],
                    "limit_per_job": r[7], "actions": json.loads(r[8])}
        return None
    finally:
        if own_conn: conn.close()


def bind_budget(c, job_id, bid=None):
    """BUDGET_BIND_GATE: bind active budget_policy to a job. Returns bid or None."""
    if bid is None:
        bp = get_active_budget(c)
        if not bp:
            _log(c, "BUDGET", "ERROR", "BUDGET_NOT_BOUND", f"no active budget_policy for job={job_id}")
            return None
        bid = bp["bid"]
    c.execute('INSERT OR IGNORE INTO budget_binding (job_id,bid) VALUES (?,?)', (job_id, bid))
    return bid


def record_cost(c, job_id, stage, units, domain_id=None, page_id=None, snap_id=None, meta=None):
    """COST_ACCOUNTING_GATE: record a cost entry in cost_ledger."""
    cm = COST_MODEL_DEFAULTS.get(stage, {"unit_type": "REQ", "unit_cost": 0.0, "currency": "USD"})
    unit_type = cm["unit_type"]
    unit_cost = cm["unit_cost"]
    currency = cm["currency"]
    cost_total = round(units * unit_cost, 8)
    c.execute('''INSERT INTO cost_ledger (job_id,domain_id,page_id,snap_id,stage,units,unit_type,unit_cost,currency,cost_total,meta_json)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
              (job_id, domain_id, page_id, snap_id, stage, units, unit_type, unit_cost, currency, cost_total,
               json.dumps(meta or {}, ensure_ascii=False)))
    return cost_total


def evaluate_budget(c, job_id):
    """
    BUDGET_EVAL_GATE: compute job spend, update budget_status.
    Returns (budget_status, spent, limit_total).
    """
    # Get budget binding
    c.execute('SELECT bb.bid FROM budget_binding bb WHERE bb.job_id=?', (job_id,))
    row = c.fetchone()
    if not row:
        return "OK", 0.0, None  # no budget bound → OK
    bid = row[0]

    # Get budget policy
    c.execute('SELECT limit_total,limit_per_domain,actions_json FROM budget_policy WHERE bid=?', (bid,))
    pol = c.fetchone()
    if not pol:
        return "OK", 0.0, None
    limit_total, limit_per_domain, actions_json = pol
    actions = json.loads(actions_json)
    soft_threshold = actions.get("soft_stop_threshold", 0.8)

    # Compute total spend for this job
    c.execute('SELECT COALESCE(SUM(cost_total),0) FROM cost_ledger WHERE job_id=?', (job_id,))
    spent = c.fetchone()[0]

    # Determine status
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    if limit_total and spent >= limit_total:
        status = "HARD_STOP"
    elif limit_total and spent >= soft_threshold * limit_total:
        status = "SOFT_STOP"
    else:
        status = "OK"

    # Update crawl_job
    c.execute('UPDATE crawl_job SET budget_status=?,budget_spent=?,budget_last_calc_at=? WHERE job_id=?',
              (status, spent, now, job_id))

    return status, spent, limit_total


def evaluate_domain_budget(c, job_id, domain_id):
    """Check per-domain budget limit. Returns True if under limit."""
    c.execute('SELECT bb.bid FROM budget_binding bb WHERE bb.job_id=?', (job_id,))
    row = c.fetchone()
    if not row:
        return True
    c.execute('SELECT limit_per_domain FROM budget_policy WHERE bid=?', (row[0],))
    pol = c.fetchone()
    if not pol or not pol[0]:
        return True
    c.execute('SELECT COALESCE(SUM(cost_total),0) FROM cost_ledger WHERE job_id=? AND domain_id=?',
              (job_id, domain_id))
    spent = c.fetchone()[0]
    return spent < pol[0]


def compute_domain_cost_tier(c, domain_id):
    """
    DOMAIN_COST_TIER_GATE: classify domain into cost tier A/B/C based on ledger history.
    Requires >= COST_TIER_MIN_ENTRIES entries.
    """
    c.execute('SELECT COUNT(*) FROM cost_ledger WHERE domain_id=?', (domain_id,))
    cnt = c.fetchone()[0]
    if cnt < COST_TIER_MIN_ENTRIES:
        return None  # not enough data

    # Compute avg cost per snapshot + volatility (stddev proxy)
    c.execute('''SELECT AVG(cost_total), MAX(cost_total), MIN(cost_total)
                 FROM cost_ledger WHERE domain_id=? AND stage IN ('FETCH','PARSE','AUDIT')''',
              (domain_id,))
    avg_cost, max_cost, min_cost = c.fetchone()
    if avg_cost is None:
        return None

    spread = (max_cost - min_cost) if (max_cost and min_cost) else 0
    # Tier A: expensive or high volatility; B: normal; C: cheap
    if avg_cost > 0.1 or spread > 0.2:
        tier = "A"
    elif avg_cost > 0.01 or spread > 0.05:
        tier = "B"
    else:
        tier = "C"

    c.execute('UPDATE domain SET cost_tier=? WHERE domain_id=?', (tier, domain_id))
    return tier


def _migrate(c):
    """v3 → v4 → v5 → v6 → v7 → v8 → v9 backfill."""
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='page'")
    if not c.fetchone():
        return
    c.execute('INSERT OR IGNORE INTO domain (domain) SELECT DISTINCT domain FROM page WHERE domain IS NOT NULL AND domain != ""')
    c.execute("PRAGMA table_info(page)")
    cols = {r[1] for r in c.fetchall()}
    if 'domain_id' in cols:
        c.execute('UPDATE page SET domain_id=(SELECT d.domain_id FROM domain d WHERE d.domain=page.domain) WHERE domain_id IS NULL')
    if 'url_norm' in cols:
        c.execute("SELECT page_id, url FROM page WHERE url_norm IS NULL OR url_norm=''")
        for pid, url in c.fetchall():
            c.execute("UPDATE page SET url_norm=? WHERE page_id=?", (normalize_url(url), pid))

    # v4 migration: add new columns if missing
    if 'cluster_id' not in cols:
        c.execute('ALTER TABLE page ADD COLUMN cluster_id INTEGER REFERENCES canonical_cluster(cluster_id)')
    if 'is_representative' not in cols:
        c.execute('ALTER TABLE page ADD COLUMN is_representative INTEGER NOT NULL DEFAULT 0')

    c.execute("PRAGMA table_info(domain)")
    dcols = {r[1] for r in c.fetchall()}
    for col, defn in [('sitemap_url','TEXT'),('sitemap_fetched_at','TEXT'),
                       ('sitemap_sha256','TEXT'),('quality_floor_score','INTEGER NOT NULL DEFAULT 0')]:
        if col not in dcols:
            c.execute(f'ALTER TABLE domain ADD COLUMN {col} {defn}')

    c.execute("PRAGMA table_info(crawl_frontier)")
    fcols = {r[1] for r in c.fetchall()}
    if 'source' not in fcols:
        c.execute("ALTER TABLE crawl_frontier ADD COLUMN source TEXT DEFAULT 'SEED'")
    if 'cluster_key_hint' not in fcols:
        c.execute("ALTER TABLE crawl_frontier ADD COLUMN cluster_key_hint TEXT")

    # Seed default alert rules
    _seed_default_alert_rules(c)

    # v5 migration: add new columns if missing
    c.execute("PRAGMA table_info(crawl_job)")
    jcols = {r[1] for r in c.fetchall()}
    if 'rule_set_id' not in jcols:
        c.execute('ALTER TABLE crawl_job ADD COLUMN rule_set_id INTEGER')
    if 'determinism_mode' not in jcols:
        c.execute("ALTER TABLE crawl_job ADD COLUMN determinism_mode TEXT DEFAULT 'NORMAL'")

    c.execute("PRAGMA table_info(page_snapshot)")
    scols = {r[1] for r in c.fetchall()}
    for col, defn in [('issues_sha256', 'TEXT'),
                       ('issues_count_critical', 'INTEGER DEFAULT 0'),
                       ('issues_count_warning', 'INTEGER DEFAULT 0'),
                       ('issues_count_info', 'INTEGER DEFAULT 0'),
                       ('explain_compact_json', "TEXT DEFAULT '{}'")]:
        if col not in scols:
            c.execute(f'ALTER TABLE page_snapshot ADD COLUMN {col} {defn}')

    # v6 migration: page_snapshot intent columns
    for col, defn in [('intent_flags_json', "TEXT DEFAULT '[]'"),
                       ('template_family', "TEXT DEFAULT 'UNKNOWN'")]:
        if col not in scols:
            c.execute(f'ALTER TABLE page_snapshot ADD COLUMN {col} {defn}')

    # v6 migration: domain outlier columns
    if 'is_outlier' not in dcols:
        c.execute('ALTER TABLE domain ADD COLUMN is_outlier INTEGER NOT NULL DEFAULT 0')
    if 'outlier_reason' not in dcols:
        c.execute('ALTER TABLE domain ADD COLUMN outlier_reason TEXT')

    # v6 migration: alert_rule segment columns
    c.execute("PRAGMA table_info(alert_rule)")
    arcols = {r[1] for r in c.fetchall()}
    for col, defn in [('segment_id', 'INTEGER'),
                       ('baseline_metric_key', 'TEXT'),
                       ('baseline_threshold', 'TEXT')]:
        if col not in arcols:
            c.execute(f'ALTER TABLE alert_rule ADD COLUMN {col} {defn}')

    # v7 migration: alert_event new columns
    c.execute("PRAGMA table_info(alert_event)")
    aecols = {r[1] for r in c.fetchall()}
    for col, defn in [('ticket_id', 'INTEGER'),
                       ('kpi_key', 'TEXT'),
                       ('baseline_ref_json', 'TEXT')]:
        if col not in aecols:
            c.execute(f'ALTER TABLE alert_event ADD COLUMN {col} {defn}')

    # v7 migration: qa_sample ticket_id
    c.execute("PRAGMA table_info(qa_sample)")
    qacols = {r[1] for r in c.fetchall()}
    if 'ticket_id' not in qacols:
        c.execute('ALTER TABLE qa_sample ADD COLUMN ticket_id INTEGER')

    # v8 migration: export_job new columns
    c.execute("PRAGMA table_info(export_job)")
    ejcols = {r[1] for r in c.fetchall()}
    for col, defn in [('view_id', 'INTEGER'),
                       ('redaction_applied', 'INTEGER NOT NULL DEFAULT 0'),
                       ('public_artifact_sha256', 'TEXT')]:
        if col not in ejcols:
            c.execute(f'ALTER TABLE export_job ADD COLUMN {col} {defn}')

    # v8 migration: alert_event new columns (ticket_id already from v7)
    if 'kpi_key' not in aecols:
        c.execute('ALTER TABLE alert_event ADD COLUMN kpi_key TEXT')
    if 'baseline_ref_json' not in aecols:
        c.execute('ALTER TABLE alert_event ADD COLUMN baseline_ref_json TEXT')

    # v9 migration: crawl_job budget columns
    if 'budget_status' not in jcols:
        c.execute("ALTER TABLE crawl_job ADD COLUMN budget_status TEXT DEFAULT 'OK'")
    if 'budget_spent' not in jcols:
        c.execute('ALTER TABLE crawl_job ADD COLUMN budget_spent REAL DEFAULT 0')
    if 'budget_currency' not in jcols:
        c.execute("ALTER TABLE crawl_job ADD COLUMN budget_currency TEXT DEFAULT 'USD'")
    if 'budget_last_calc_at' not in jcols:
        c.execute('ALTER TABLE crawl_job ADD COLUMN budget_last_calc_at TEXT')

    # v9 migration: domain cost_tier
    if 'cost_tier' not in dcols:
        c.execute("ALTER TABLE domain ADD COLUMN cost_tier TEXT DEFAULT 'C'")

    # v10 migration: golden_rule.release_gate_id
    c.execute("PRAGMA table_info(golden_rule)")
    grcols = {r[1] for r in c.fetchall()}
    if 'release_gate_id' not in grcols:
        c.execute('ALTER TABLE golden_rule ADD COLUMN release_gate_id INTEGER')

    # v11 migration: crawl_frontier new columns
    if 'intent_hint' not in fcols:
        c.execute('ALTER TABLE crawl_frontier ADD COLUMN intent_hint TEXT')
    if 'source_sid_primary' not in fcols:
        c.execute('ALTER TABLE crawl_frontier ADD COLUMN source_sid_primary INTEGER')

    # v12 migration: page_snapshot completeness columns
    if 'is_complete' not in scols:
        c.execute('ALTER TABLE page_snapshot ADD COLUMN is_complete INTEGER NOT NULL DEFAULT 1')
    if 'complete_reason' not in scols:
        c.execute('ALTER TABLE page_snapshot ADD COLUMN complete_reason TEXT')

    # v12 migration: kpi_definition filter link
    c.execute("PRAGMA table_info(kpi_definition)")
    kdcols = {r[1] for r in c.fetchall()}
    if 'kpi_filter_id' not in kdcols:
        c.execute('ALTER TABLE kpi_definition ADD COLUMN kpi_filter_id INTEGER')

    # v13 migration: export_job.lineage_root_id
    c.execute("PRAGMA table_info(export_job)")
    ejcols = {r[1] for r in c.fetchall()}
    if 'lineage_root_id' not in ejcols:
        c.execute('ALTER TABLE export_job ADD COLUMN lineage_root_id INTEGER')

    # v13 migration: kpi_value.lineage_root_id
    c.execute("PRAGMA table_info(kpi_value)")
    kvcols = {r[1] for r in c.fetchall()}
    if 'lineage_root_id' not in kvcols:
        c.execute('ALTER TABLE kpi_value ADD COLUMN lineage_root_id INTEGER')

    # v13 migration: alert_event.lineage_root_id
    if 'lineage_root_id' not in aecols:
        c.execute('ALTER TABLE alert_event ADD COLUMN lineage_root_id INTEGER')

    # v14 migration: alert_event.anomaly_event_id
    if 'anomaly_event_id' not in aecols:
        c.execute('ALTER TABLE alert_event ADD COLUMN anomaly_event_id INTEGER')

    # v15 migration: domain.health_tier + health_note
    if 'health_tier' not in dcols:
        c.execute("ALTER TABLE domain ADD COLUMN health_tier TEXT DEFAULT 'GOOD'")
    if 'health_note' not in dcols:
        c.execute('ALTER TABLE domain ADD COLUMN health_note TEXT')

    # v15 migration: event_log.network_stage
    c.execute("PRAGMA table_info(event_log)")
    elcols = {r[1] for r in c.fetchall()}
    if 'network_stage' not in elcols:
        c.execute('ALTER TABLE event_log ADD COLUMN network_stage TEXT')


# ═══════════════════════════════════════════════════════════════════════
# Scoring
# ═══════════════════════════════════════════════════════════════════════
def compute_score(issue_codes):
    score = SCORING["base"]
    bd = {}
    for code in issue_codes:
        p = SCORING["penalties"].get(code, 0)
        if p:
            bd[code] = -p
            score -= p
    return max(SCORING["floor"], min(SCORING["ceiling"], score)), bd


# ═══════════════════════════════════════════════════════════════════════
# v5 Determinism helpers
# ═══════════════════════════════════════════════════════════════════════
def compute_issues_sha256(issue_codes):
    """Deterministic hash of sorted issue codes for reproducibility check."""
    normalized = sorted(set(issue_codes))
    payload = "|".join(normalized)
    return hashlib.sha256(payload.encode()).hexdigest()


def count_issues_by_severity(issue_codes):
    """Count issues by severity level. Returns (critical, warning, info)."""
    sev_map = {code: sev for code, sev, *_ in ISSUE_TAXONOMY}
    crit = sum(1 for c in issue_codes if sev_map.get(c) == "CRITICAL")
    warn = sum(1 for c in issue_codes if sev_map.get(c) == "WARNING")
    info = sum(1 for c in issue_codes if sev_map.get(c) == "INFO")
    return crit, warn, info


def build_explain_compact(issues, score, breakdown, rule_set_name="v5_initial"):
    """Build compact explain object for determinism auditing."""
    return {
        "i": sorted(issues),
        "s": score,
        "b": breakdown,
        "r": rule_set_name,
        "v": "v5",
    }


# ═══════════════════════════════════════════════════════════════════════
# Priority model v4
# ═══════════════════════════════════════════════════════════════════════
def compute_priority(source="SEED", is_representative=False, score_drop=0, has_new_critical=False,
                     last_status=200, is_dup=False, domain_cooldown=False):
    """Calculate frontier priority based on v4 priority model."""
    p = PRIORITY_MODEL["base"]
    boosts = PRIORITY_MODEL["boosts"]
    pens = PRIORITY_MODEL["penalties"]

    if source == "SITEMAP": p += boosts["SITEMAP"]
    if is_representative: p += boosts["REPRESENTATIVE"]
    if score_drop >= 20: p += boosts["SCORE_DROP_20"]
    if has_new_critical: p += boosts["NEW_CRITICAL"]

    if last_status and last_status >= 400: p += pens["STATUS_4XX_5XX"]
    if is_dup: p += pens["DUPLICATE_URL"]
    if domain_cooldown: p += pens["DOMAIN_COOLDOWN"]

    return max(0, p)


# ═══════════════════════════════════════════════════════════════════════
# Domain
# ═══════════════════════════════════════════════════════════════════════
def ensure_domain(c, name):
    c.execute('SELECT domain_id FROM domain WHERE domain=?', (name,))
    r = c.fetchone()
    if r: return r[0]
    c.execute('INSERT INTO domain (domain) VALUES (?)', (name,))
    return c.lastrowid

def get_domain_config(c, did):
    c.execute('SELECT tier,default_ttl_hours,rate_limit_ms,crawl_budget_per_hour,quality_floor_score FROM domain WHERE domain_id=?', (did,))
    r = c.fetchone()
    if r: return {"tier": r[0], "ttl_hours": r[1], "rate_limit_ms": r[2], "budget": r[3], "quality_floor": r[4] or 0}
    return {"tier": "C", "ttl_hours": 72, "rate_limit_ms": 1000, "budget": 60, "quality_floor": 0}

def set_domain_tier(name, tier):
    ttl = {"A": 24, "B": 72, "C": 168}.get(tier, 72)
    conn = get_conn()
    try:
        conn.execute('UPDATE domain SET tier=?,default_ttl_hours=? WHERE domain=?', (tier, ttl, name))
        conn.commit()
    finally:
        conn.close()

def update_domain_sitemap(c, domain_id, sitemap_url, sitemap_sha256):
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    c.execute('UPDATE domain SET sitemap_url=?,sitemap_fetched_at=?,sitemap_sha256=? WHERE domain_id=?',
              (sitemap_url, now, sitemap_sha256, domain_id))


# ═══════════════════════════════════════════════════════════════════════
# Site hint
# ═══════════════════════════════════════════════════════════════════════
def upsert_site_hint(c, domain_id, appears_multilingual=None, has_sitemap=None,
                     sitemap_url=None, cms_fingerprint=None):
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    c.execute('SELECT domain_id FROM site_hint WHERE domain_id=?', (domain_id,))
    if c.fetchone():
        updates = []
        vals = []
        if appears_multilingual is not None:
            updates.append('appears_multilingual=?'); vals.append(int(appears_multilingual))
        if has_sitemap is not None:
            updates.append('has_sitemap=?'); vals.append(int(has_sitemap))
        if sitemap_url is not None:
            updates.append('sitemap_url=?'); vals.append(sitemap_url)
        if cms_fingerprint is not None:
            updates.append('cms_fingerprint=?'); vals.append(cms_fingerprint)
        if updates:
            updates.append('updated_at=?'); vals.append(now); vals.append(domain_id)
            c.execute(f"UPDATE site_hint SET {','.join(updates)} WHERE domain_id=?", vals)
    else:
        c.execute('INSERT INTO site_hint (domain_id,appears_multilingual,has_sitemap,sitemap_url,cms_fingerprint,updated_at) VALUES (?,?,?,?,?,?)',
                  (domain_id, int(appears_multilingual or 0), int(has_sitemap or 0), sitemap_url, cms_fingerprint, now))


# ═══════════════════════════════════════════════════════════════════════
# Event log
# ═══════════════════════════════════════════════════════════════════════
def _log(c, stage, level, code, message, job_id=None, domain_id=None, page_id=None, snap_id=None, payload=None):
    c.execute('''INSERT INTO event_log (job_id,domain_id,page_id,snap_id,stage,level,code,message,payload_json)
                 VALUES (?,?,?,?,?,?,?,?,?)''',
              (job_id, domain_id, page_id, snap_id, stage, level, code, message,
               json.dumps(payload, ensure_ascii=False) if payload else None))


# ═══════════════════════════════════════════════════════════════════════
# Artifact store
# ═══════════════════════════════════════════════════════════════════════
def _store_artifact(c, sha256, kind, raw_bytes, policy_store):
    c.execute('SELECT artifact_id FROM artifact_store WHERE sha256=?', (sha256,))
    r = c.fetchone()
    if r:
        return r[0]
    blob = raw_bytes if policy_store else None
    size = len(raw_bytes) if raw_bytes else 0
    c.execute('INSERT INTO artifact_store (sha256,kind,bytes,size) VALUES (?,?,?,?)',
              (sha256, kind, blob, size))
    return c.lastrowid

def _link_artifact(c, snap_id, artifact_id):
    c.execute('INSERT OR IGNORE INTO snapshot_artifact (snap_id,artifact_id) VALUES (?,?)',
              (snap_id, artifact_id))


# ═══════════════════════════════════════════════════════════════════════
# HTTP cache
# ═══════════════════════════════════════════════════════════════════════
def get_http_hints(page_id):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT etag,last_modified FROM http_cache WHERE page_id=?', (page_id,))
        r = c.fetchone()
        return {"etag": r[0], "last_modified": r[1]} if r else {}
    finally:
        conn.close()

def _upsert_http_cache(c, page_id, etag, last_modified):
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    c.execute('''INSERT INTO http_cache (page_id,etag,last_modified,last_checked_at)
                 VALUES (?,?,?,?) ON CONFLICT(page_id)
                 DO UPDATE SET etag=excluded.etag, last_modified=excluded.last_modified,
                               last_checked_at=excluded.last_checked_at''',
              (page_id, etag, last_modified, now))


# ═══════════════════════════════════════════════════════════════════════
# Job management
# ═══════════════════════════════════════════════════════════════════════
def start_job(seed, mode="SEED_ONLY", max_pages=None, max_depth=None, settings=None, notes=None,
              rule_set_id=None, determinism_mode="NORMAL"):
    """Start a crawl job. v5: validates rule_set_id against golden_rule if provided."""
    conn = get_conn()
    try:
        c = conn.cursor()
        # v5: resolve rule_set_id — use active if not specified
        if rule_set_id is None:
            rs = get_active_rule_set(c)
            rule_set_id = rs["rule_set_id"] if rs else None
        elif rule_set_id:
            c.execute('SELECT rule_set_id FROM golden_rule WHERE rule_set_id=?', (rule_set_id,))
            if not c.fetchone():
                raise ValueError(f"rule_set_id={rule_set_id} not found in golden_rule")
        c.execute('''INSERT INTO crawl_job (seed,mode,max_pages,max_depth,notes,settings_json,rule_set_id,determinism_mode)
                     VALUES (?,?,?,?,?,?,?,?)''',
                  (seed, mode, max_pages, max_depth, notes, json.dumps(settings or {}),
                   rule_set_id, determinism_mode))
        jid = c.lastrowid
        # ── POLICY_GATE (v8) ── bind active policy to this job
        bind_policy(c, 'JOB', jid)
        # ── BUDGET_BIND_GATE (v9) ── bind active budget to this job
        bind_budget(c, jid)
        return jid
    finally:
        conn.commit()
        conn.close()

def finish_job(job_id, metrics=None):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("UPDATE crawl_job SET finished_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE job_id=?", (job_id,))
        if metrics:
            for k, v in metrics.items():
                c.execute('INSERT INTO job_metric (job_id,metric_key,metric_value) VALUES (?,?,?)',
                          (job_id, k, float(v)))
        conn.commit()
    finally:
        conn.close()
    # ── KPI_COMPUTE_GATE (v7) ── compute KPIs at job finish
    try:
        compute_kpis_for_job(job_id)
    except Exception:
        pass  # KPI compute is best-effort, don't fail the job


# ═══════════════════════════════════════════════════════════════════════
# Frontier v4
# ═══════════════════════════════════════════════════════════════════════
def frontier_add(urls, domain_id=None, priority=0, depth=0, discovered_from=None, source="SEED", cluster_key_hint=None):
    conn = get_conn()
    try:
        c = conn.cursor()
        added = 0
        for url in urls:
            c.execute('''INSERT OR IGNORE INTO crawl_frontier
                         (domain_id,url,url_norm,priority,depth,discovered_from,source,cluster_key_hint)
                         VALUES (?,?,?,?,?,?,?,?)''',
                      (domain_id, url, normalize_url(url), priority, depth, discovered_from, source, cluster_key_hint))
            if c.rowcount > 0: added += 1
        conn.commit()
        return added
    finally:
        conn.close()

def frontier_add_batch(c, items):
    """Batch insert into frontier within an existing transaction. items = list of dicts."""
    added = 0
    for item in items:
        c.execute('''INSERT OR IGNORE INTO crawl_frontier
                     (domain_id,url,url_norm,priority,depth,discovered_from,source,cluster_key_hint)
                     VALUES (?,?,?,?,?,?,?,?)''',
                  (item.get("domain_id"), item["url"], normalize_url(item["url"]),
                   item.get("priority", 0), item.get("depth", 0),
                   item.get("discovered_from"), item.get("source", "SEED"),
                   item.get("cluster_key_hint")))
        if c.rowcount > 0: added += 1
    return added

def frontier_next(limit=10):
    conn = get_conn()
    try:
        c = conn.cursor()
        now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT fid,url,url_norm,domain_id,priority,depth,retry_count,http_hint_json,source
                     FROM crawl_frontier
                     WHERE status='PENDING' AND (next_retry_at IS NULL OR next_retry_at<=?)
                       AND (cooldown_until IS NULL OR cooldown_until<=?)
                     ORDER BY priority DESC, fid ASC LIMIT ?''', (now, now, limit))
        rows = c.fetchall()
        fids = [r[0] for r in rows]
        if fids:
            c.execute(f"UPDATE crawl_frontier SET status='RUNNING',scheduled_at=? WHERE fid IN ({','.join('?'*len(fids))})",
                      [now]+fids)
        conn.commit()
        return [{"fid":r[0],"url":r[1],"url_norm":r[2],"domain_id":r[3],"priority":r[4],
                 "depth":r[5],"retry_count":r[6],"http_hints":json.loads(r[7] or '{}'),
                 "source":r[8]} for r in rows]
    finally:
        conn.close()

def frontier_done(fid, status="DONE", error=None):
    conn = get_conn()
    try:
        conn.execute("UPDATE crawl_frontier SET status=?,last_error=? WHERE fid=?", (status, error, fid))
        conn.commit()
    finally:
        conn.close()

def frontier_retry(fid, error=None):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT retry_count,domain_id FROM crawl_frontier WHERE fid=?', (fid,))
        r = c.fetchone()
        if not r: return
        count, did = r
        new_count = count + 1
        if new_count > RETRY_POLICY["max_retries"]:
            c.execute("UPDATE crawl_frontier SET status='FAILED',retry_count=?,last_error=? WHERE fid=?",
                      (new_count, error, fid))
            if did:
                cool = (datetime.datetime.utcnow() + datetime.timedelta(minutes=RETRY_POLICY["cooldown_minutes"])).strftime('%Y-%m-%dT%H:%M:%SZ')
                c.execute("UPDATE crawl_frontier SET cooldown_until=? WHERE domain_id=? AND status='PENDING'",
                          (cool, did))
        else:
            idx = min(new_count - 1, len(RETRY_POLICY["backoff_seconds"]) - 1)
            wait = RETRY_POLICY["backoff_seconds"][idx]
            nxt = (datetime.datetime.utcnow() + datetime.timedelta(seconds=wait)).strftime('%Y-%m-%dT%H:%M:%SZ')
            c.execute("UPDATE crawl_frontier SET status='PENDING',retry_count=?,next_retry_at=?,last_error=? WHERE fid=?",
                      (new_count, nxt, error, fid))
        conn.commit()
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# URL Graph v4
# ═══════════════════════════════════════════════════════════════════════
def _write_graph_edges(c, page_id, snap_id, domain_id, edges, now):
    """
    Upsert edges into url_graph_edge.
    edges = list of {"to_url_norm", "edge_type", "rel"?, "anchor_hash"?, "to_domain_id"?}
    """
    for e in edges:
        to_norm = e["to_url_norm"]
        etype = e["edge_type"]
        to_did = e.get("to_domain_id")
        rel = e.get("rel")
        ahash = e.get("anchor_hash")

        # Try upsert: update last_seen_at if already exists
        c.execute('''SELECT eid FROM url_graph_edge
                     WHERE from_page_id=? AND to_url_norm=? AND edge_type=?''',
                  (page_id, to_norm, etype))
        existing = c.fetchone()
        if existing:
            c.execute('UPDATE url_graph_edge SET last_seen_at=?,snap_id=? WHERE eid=?',
                      (now, snap_id, existing[0]))
        else:
            c.execute('''INSERT INTO url_graph_edge
                         (from_page_id,to_url_norm,to_domain_id,edge_type,rel,anchor_hash,first_seen_at,last_seen_at,snap_id)
                         VALUES (?,?,?,?,?,?,?,?,?)''',
                      (page_id, to_norm, to_did, etype, rel, ahash, now, now, snap_id))


def build_edge_list(data, page_id, domain_id, page_domain):
    """
    Build edge list from analyzer data for GRAPH_WRITE_GATE.
    Returns list of edge dicts, capped per spec.
    """
    edges = []

    # Redirect edges
    for step in data.get("redirect_chain", []):
        edges.append({
            "to_url_norm": normalize_url(step.get("url", "")),
            "edge_type": "REDIRECT",
            "to_domain_id": None,
        })

    # Canonical edge
    canonical = data.get("canonical")
    if canonical:
        edges.append({
            "to_url_norm": normalize_url(canonical),
            "edge_type": "CANONICAL",
            "to_domain_id": None,
        })

    # Hreflang edges
    for h in data.get("hreflang", []):
        href = h.get("href", "")
        if href:
            edges.append({
                "to_url_norm": normalize_url(href),
                "edge_type": "HREFLANG",
                "rel": h.get("lang", ""),
                "to_domain_id": None,
            })

    # Internal link samples (capped, sorted by url_norm for determinism)
    int_samples = sorted(data.get("internal_links_sample", []))[:EDGE_SAMPLE_CAP]
    for url in int_samples:
        edges.append({
            "to_url_norm": normalize_url(url),
            "edge_type": "INTERNAL_LINK",
            "to_domain_id": domain_id,
        })

    # External link samples (capped, sorted by url_norm for determinism)
    ext_samples = sorted(data.get("external_links_sample", []))[:EDGE_SAMPLE_CAP]
    for url in ext_samples:
        to_dom = extract_domain(url)
        edges.append({
            "to_url_norm": normalize_url(url),
            "edge_type": "EXTERNAL_LINK",
            "to_domain_id": None,  # resolved lazily
        })

    return edges


# ═══════════════════════════════════════════════════════════════════════
# Clustering v4
# ═══════════════════════════════════════════════════════════════════════
def _update_cluster(c, page_id, domain_id, cluster_key, now):
    """
    CLUSTERING_GATE: compute/update canonical_cluster from redirect+canonical signals.
    Returns cluster_id.
    """
    # Find existing cluster with this key
    c.execute('SELECT cluster_id,representative_page_id FROM canonical_cluster WHERE domain_id=? AND cluster_key=?',
              (domain_id, cluster_key))
    row = c.fetchone()

    if row:
        cluster_id = row[0]
        # Add this page as member if not already
        c.execute('INSERT OR IGNORE INTO cluster_member (cluster_id,page_id,role) VALUES (?,?,?)',
                  (cluster_id, page_id, 'MEMBER'))
        # Update size
        c.execute('SELECT COUNT(*) FROM cluster_member WHERE cluster_id=?', (cluster_id,))
        size = c.fetchone()[0]
        c.execute('UPDATE canonical_cluster SET size=?,updated_at=? WHERE cluster_id=?',
                  (size, now, cluster_id))
        # Choose representative: stable 200 + latest last_seen_at
        c.execute('''SELECT cm.page_id FROM cluster_member cm
                     JOIN page p ON cm.page_id=p.page_id
                     WHERE cm.cluster_id=? AND p.last_status_code=200
                     ORDER BY p.last_seen_at DESC LIMIT 1''', (cluster_id,))
        rep = c.fetchone()
        if rep:
            rep_id = rep[0]
            c.execute('UPDATE canonical_cluster SET representative_page_id=? WHERE cluster_id=?',
                      (rep_id, cluster_id))
            # Update flags
            c.execute('UPDATE cluster_member SET role=? WHERE cluster_id=?', ('MEMBER', cluster_id))
            c.execute("UPDATE cluster_member SET role='REPRESENTATIVE' WHERE cluster_id=? AND page_id=?",
                      (cluster_id, rep_id))
            c.execute('UPDATE page SET is_representative=0 WHERE cluster_id=?', (cluster_id,))
            c.execute('UPDATE page SET is_representative=1 WHERE page_id=?', (rep_id,))
    else:
        # Create new cluster
        c.execute('INSERT INTO canonical_cluster (domain_id,cluster_key,representative_page_id,size,updated_at) VALUES (?,?,?,?,?)',
                  (domain_id, cluster_key, page_id, 1, now))
        cluster_id = c.lastrowid
        c.execute('INSERT INTO cluster_member (cluster_id,page_id,role) VALUES (?,?,?)',
                  (cluster_id, page_id, 'REPRESENTATIVE'))
        c.execute('UPDATE page SET is_representative=1 WHERE page_id=?', (page_id,))

    # Update page.cluster_id
    c.execute('UPDATE page SET cluster_id=? WHERE page_id=?', (cluster_id, page_id))
    return cluster_id


# ═══════════════════════════════════════════════════════════════════════
# Alert evaluation v4
# ═══════════════════════════════════════════════════════════════════════
def _evaluate_alerts(c, page_id, domain_id, snap_id, job_id, score_delta=0,
                     new_issues=None, cluster_id=None):
    """
    ALERT_EVAL_GATE: evaluate enabled alert_rules against current state.
    Fires alert_events where predicates match and cooldown satisfied.
    Returns number of alerts fired (v5).
    """
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    new_issues = new_issues or []
    fired_count = 0

    c.execute('SELECT rule_id,name,scope,predicate_json,severity,cooldown_minutes FROM alert_rule WHERE is_enabled=1')
    rules = c.fetchall()

    for rule_id, name, scope, pred_json, severity, cooldown_min in rules:
        pred = json.loads(pred_json)

        # Cooldown check
        c.execute('SELECT fired_at FROM alert_event WHERE rule_id=? ORDER BY aid DESC LIMIT 1', (rule_id,))
        last = c.fetchone()
        if last:
            try:
                last_fired = datetime.datetime.strptime(last[0], '%Y-%m-%dT%H:%M:%SZ')
                if (datetime.datetime.utcnow() - last_fired).total_seconds() < cooldown_min * 60:
                    continue
            except ValueError:
                pass

        fired = False
        msg = ""
        payload = {}

        ptype = pred.get("type")

        if ptype == "score_drop" and score_delta <= -pred.get("threshold", 20):
            fired = True
            msg = f"Score dropped by {abs(score_delta)} points"
            payload = {"score_delta": score_delta}

        elif ptype == "new_issue":
            target_sev = pred.get("severity")
            target_code = pred.get("code")
            for issue_code in new_issues:
                match = False
                if target_code and issue_code == target_code:
                    match = True
                elif target_sev:
                    for tx_code, tx_sev, *_ in ISSUE_TAXONOMY:
                        if tx_code == issue_code and tx_sev == target_sev:
                            match = True
                            break
                if match:
                    fired = True
                    msg = f"New issue: {issue_code}"
                    payload = {"issue_code": issue_code}
                    break

        elif ptype == "sitemap_disappeared":
            c.execute('SELECT sitemap_url FROM domain WHERE domain_id=?', (domain_id,))
            r = c.fetchone()
            # Only fire if sitemap was known but now gone — checked externally
            pass

        elif ptype == "cluster_size_spike":
            threshold = pred.get("threshold", 5)
            if cluster_id:
                c.execute('SELECT size FROM canonical_cluster WHERE cluster_id=?', (cluster_id,))
                r = c.fetchone()
                if r and r[0] >= threshold:
                    fired = True
                    msg = f"Cluster size reached {r[0]}"
                    payload = {"cluster_id": cluster_id, "size": r[0]}

        if fired:
            c.execute('''INSERT INTO alert_event (rule_id,domain_id,page_id,cluster_id,job_id,snap_id,severity,message,payload_json)
                         VALUES (?,?,?,?,?,?,?,?,?)''',
                      (rule_id, domain_id, page_id, cluster_id, job_id, snap_id, severity, msg,
                       json.dumps(payload, ensure_ascii=False)))
            fired_count += 1

    return fired_count


# ═══════════════════════════════════════════════════════════════════════
# QA Sampling v5
# ═══════════════════════════════════════════════════════════════════════
def _qa_sample_check(c, snap_id, job_id, page_id, domain_id,
                     is_new_domain=False, score_delta=0, alert_fired=False):
    """QA_SAMPLING_GATE: determine if this snapshot should be flagged for QA review."""
    reasons = []

    if is_new_domain:
        reasons.append('NEW_DOMAIN')
    if abs(score_delta) >= 20:
        reasons.append('VOLATILE')
    if alert_fired:
        reasons.append('ALERT_FIRED')
    if random.random() < QA_SAMPLING_RATE:
        reasons.append('RANDOM')

    for reason in reasons:
        c.execute('INSERT INTO qa_sample (snap_id,job_id,reason) VALUES (?,?,?)',
                  (snap_id, job_id, reason))
    return reasons


# ═══════════════════════════════════════════════════════════════════════
# Segment management v6
# ═══════════════════════════════════════════════════════════════════════
def _assign_segment(c, domain_id, domain_name):
    """
    SEGMENT_ASSIGN_GATE: assign domain to segment(s).
    Uses SEARCH_ENGINE domain_list for exact match, else UNCLASSIFIED.
    Returns list of segment_ids, and whether domain is outlier.
    """
    # Check if already assigned
    c.execute('SELECT segment_id FROM domain_segment WHERE domain_id=?', (domain_id,))
    existing = [r[0] for r in c.fetchall()]
    if existing:
        # Check if in SEARCH_ENGINE segment → outlier
        c.execute("SELECT segment_id FROM segment WHERE name='SEARCH_ENGINE'")
        se_row = c.fetchone()
        is_outlier = se_row and se_row[0] in existing
        return existing, is_outlier

    # Auto-assign based on segment templates
    assigned = []
    c.execute('SELECT segment_id,name,definition_json FROM segment WHERE is_enabled=1')
    segments = c.fetchall()

    for seg_id, seg_name, def_json in segments:
        defn = json.loads(def_json or '{}')
        domain_list = defn.get("domain_list", [])
        if domain_name in domain_list:
            c.execute('INSERT OR IGNORE INTO domain_segment (domain_id,segment_id) VALUES (?,?)',
                      (domain_id, seg_id))
            assigned.append(seg_id)

    # If no match, assign to UNCLASSIFIED
    if not assigned:
        c.execute("SELECT segment_id FROM segment WHERE name='UNCLASSIFIED'")
        uc = c.fetchone()
        if uc:
            c.execute('INSERT OR IGNORE INTO domain_segment (domain_id,segment_id) VALUES (?,?)',
                      (domain_id, uc[0]))
            assigned.append(uc[0])

    # Mark outlier if in SEARCH_ENGINE
    c.execute("SELECT segment_id FROM segment WHERE name='SEARCH_ENGINE'")
    se_row = c.fetchone()
    is_outlier = se_row and se_row[0] in assigned
    if is_outlier:
        c.execute('UPDATE domain SET is_outlier=1,outlier_reason=? WHERE domain_id=?',
                  ('SEARCH_ENGINE_SEGMENT', domain_id))
    elif not assigned:
        c.execute('UPDATE domain SET is_outlier=1,outlier_reason=? WHERE domain_id=?',
                  ('NO_SEGMENT', domain_id))

    return assigned, is_outlier


def _build_baseline(c, segment_id, rule_set_id, window_days=30):
    """
    BASELINE_BUILD_GATE: compute p50/p75/p90 for a segment.
    Requires >=20 representative snapshots in window.
    """
    cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=window_days)).strftime('%Y-%m-%dT%H:%M:%SZ')

    # Get representative snapshots in this segment within window
    c.execute('''SELECT ps.score_total, ps.issues_count_critical
        FROM page_snapshot ps
        JOIN page p ON ps.page_id=p.page_id
        JOIN domain_segment ds ON p.domain_id=ds.domain_id
        WHERE ds.segment_id=? AND p.is_representative=1
          AND ps.fetched_at>=?
          AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
        ORDER BY ps.score_total''', (segment_id, cutoff))
    rows = c.fetchall()

    if len(rows) < 20:
        return None  # insufficient samples

    scores = sorted([r[0] for r in rows if r[0] is not None])
    crits = sorted([r[1] for r in rows if r[1] is not None])

    def percentile(data, pct):
        if not data: return 0
        k = (len(data) - 1) * pct / 100.0
        f = int(k)
        c_val = f + 1 if f + 1 < len(data) else f
        return data[f] + (k - f) * (data[c_val] - data[f])

    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    for metric_key, data in [('score_total', scores), ('critical_rate', crits)]:
        if not data:
            continue
        p50 = percentile(data, 50)
        p75 = percentile(data, 75)
        p90 = percentile(data, 90)
        c.execute('''INSERT INTO baseline_stat (segment_id,rule_set_id,window_days,metric_key,p50,p75,p90)
                     VALUES (?,?,?,?,?,?,?)''',
                  (segment_id, rule_set_id, window_days, metric_key, p50, p75, p90))

    return len(rows)


def _evaluate_relative_alert(c, domain_id, snap_id, job_id, segment_ids, score, crit_count):
    """
    RELATIVE_ALERT_GATE: fire alerts based on baseline thresholds instead of absolute values.
    Only evaluates alert_rules that have segment_id + baseline_metric_key set.
    Falls back to absolute predicate_json if no baseline config.
    """
    if not segment_ids:
        return 0

    fired = 0
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

    for seg_id in segment_ids:
        c.execute('''SELECT rule_id,name,severity,cooldown_minutes,baseline_metric_key,baseline_threshold
            FROM alert_rule WHERE is_enabled=1 AND segment_id=? AND baseline_metric_key IS NOT NULL''',
                  (seg_id,))
        rules = c.fetchall()
        for rule_id, name, severity, cooldown_min, metric_key, threshold_level in rules:
            # Cooldown check
            c.execute('SELECT fired_at FROM alert_event WHERE rule_id=? ORDER BY aid DESC LIMIT 1', (rule_id,))
            last = c.fetchone()
            if last:
                try:
                    last_fired = datetime.datetime.strptime(last[0], '%Y-%m-%dT%H:%M:%SZ')
                    if (datetime.datetime.utcnow() - last_fired).total_seconds() < cooldown_min * 60:
                        continue
                except ValueError:
                    pass

            # Get baseline
            c.execute('''SELECT p50,p75,p90 FROM baseline_stat
                WHERE segment_id=? AND metric_key=?
                ORDER BY created_at DESC LIMIT 1''', (seg_id, metric_key))
            bl = c.fetchone()
            if not bl:
                continue

            threshold_val = {"P50": bl[0], "P75": bl[1], "P90": bl[2]}.get(threshold_level)
            if threshold_val is None:
                continue

            # Compare current value against baseline threshold
            current_val = score if metric_key == 'score_total' else crit_count
            if metric_key == 'score_total' and current_val < threshold_val:
                msg = f"Score {current_val} below {threshold_level}={threshold_val:.0f} baseline"
                c.execute('''INSERT INTO alert_event (rule_id,domain_id,page_id,cluster_id,job_id,snap_id,severity,message,payload_json)
                    VALUES (?,?,NULL,NULL,?,?,?,?,?)''',
                    (rule_id, domain_id, job_id, snap_id, severity, msg,
                     json.dumps({"metric": metric_key, "value": current_val, "threshold": threshold_level,
                                 "baseline": threshold_val, "segment_id": seg_id})))
                fired += 1
            elif metric_key == 'critical_rate' and current_val > threshold_val:
                msg = f"Critical count {current_val} exceeds {threshold_level}={threshold_val:.0f} baseline"
                c.execute('''INSERT INTO alert_event (rule_id,domain_id,page_id,cluster_id,job_id,snap_id,severity,message,payload_json)
                    VALUES (?,?,NULL,NULL,?,?,?,?,?)''',
                    (rule_id, domain_id, job_id, snap_id, severity, msg,
                     json.dumps({"metric": metric_key, "value": current_val, "threshold": threshold_level,
                                 "baseline": threshold_val, "segment_id": seg_id})))
                fired += 1

    return fired


def generate_pair_report(pair_id):
    """
    PAIR_REPORT_GATE: generate A/B comparison for a fixed pair.
    Returns delta summary and persists export_job(kind=PAIR_REPORT).
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT cp.name,cp.segment_id,cp.left_domain_id,cp.right_domain_id,
            dl.domain as left_domain, dr.domain as right_domain
            FROM comparison_pair cp
            JOIN domain dl ON cp.left_domain_id=dl.domain_id
            JOIN domain dr ON cp.right_domain_id=dr.domain_id
            WHERE cp.pid=? AND cp.is_enabled=1''', (pair_id,))
        pair = c.fetchone()
        if not pair:
            return None

        pair_name, seg_id, left_did, right_did, left_dom, right_dom = pair

        def _latest_snap(did):
            c.execute('''SELECT ps.score_total,ps.issues_count_critical,ps.issues_count_warning,
                ps.issues_count_info,ps.issues_sha256,ps.fetched_at,
                GROUP_CONCAT(i.code,'; ')
                FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
                LEFT JOIN page_issue pi ON ps.snap_id=pi.snap_id
                LEFT JOIN issue i ON pi.issue_id=i.issue_id
                WHERE p.domain_id=? AND p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
                GROUP BY ps.snap_id
                ORDER BY ps.score_total DESC LIMIT 1''', (did,))
            return c.fetchone()

        left_snap = _latest_snap(left_did)
        right_snap = _latest_snap(right_did)

        report = {
            "pair_name": pair_name, "segment_id": seg_id,
            "left": {"domain": left_dom, "score": left_snap[0] if left_snap else None,
                     "crit": left_snap[1] if left_snap else 0, "warn": left_snap[2] if left_snap else 0,
                     "issues": left_snap[6] if left_snap else "", "fetched_at": left_snap[5] if left_snap else None},
            "right": {"domain": right_dom, "score": right_snap[0] if right_snap else None,
                      "crit": right_snap[1] if right_snap else 0, "warn": right_snap[2] if right_snap else 0,
                      "issues": right_snap[6] if right_snap else "", "fetched_at": right_snap[5] if right_snap else None},
            "delta_score": ((left_snap[0] or 0) - (right_snap[0] or 0)) if left_snap and right_snap else None,
        }

        # Persist export_job
        report_json = json.dumps(report, ensure_ascii=False)
        sha = hashlib.sha256(report_json.encode()).hexdigest()
        output_path = os.path.join(os.path.dirname(DB_PATH), f"pair_report_{pair_id}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report_json)
        c.execute('''INSERT INTO export_job (export_type,output_path,row_count,artifact_sha256,notes)
                     VALUES (?,?,?,?,?)''',
                  ('PAIR_REPORT', output_path, 2, sha, f"pair={pair_name}"))
        conn.commit()
        return report
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# KPI Compute v7
# ═══════════════════════════════════════════════════════════════════════
def compute_kpis_for_job(job_id):
    """
    KPI_COMPUTE_GATE: compute all enabled KPIs at job finish.
    Persists kpi_value rows for scope=JOB, DOMAIN, SEGMENT.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

        # Get rule_set_id for this job
        c.execute('SELECT rule_set_id FROM crawl_job WHERE job_id=?', (job_id,))
        r = c.fetchone()
        rs_id = r[0] if r else None

        # Get enabled KPIs for this rule_set
        c.execute('SELECT kpi_id,key,direction,unit FROM kpi_definition WHERE is_enabled=1 AND rule_set_id=?',
                  (rs_id,))
        kpis = c.fetchall()
        if not kpis:
            _log(c, "KPI_COMPUTE", "INFO", "KPI_COMPUTE_SKIPPED", "no enabled KPIs",
                 job_id=job_id)
            conn.commit()
            return 0

        count = 0

        # ── scope=JOB: KPIs for this job's snapshots ──
        for kpi_id, key, direction, unit in kpis:
            val = _compute_kpi_value(c, key, 'JOB', job_id)
            if val is not None:
                c.execute('''INSERT OR REPLACE INTO kpi_value
                    (kpi_id,scope,scope_id,window_days,value,as_of_date,job_id)
                    VALUES (?,?,?,?,?,?,?)''',
                    (kpi_id, 'JOB', job_id, 0, val, today, job_id))
                count += 1

        # ── scope=DOMAIN: rolling KPIs per domain touched in this job ──
        c.execute('''SELECT DISTINCT p.domain_id FROM page_snapshot ps
            JOIN page p ON ps.page_id=p.page_id WHERE ps.job_id=?''', (job_id,))
        domain_ids = [r[0] for r in c.fetchall() if r[0]]

        for did in domain_ids:
            for kpi_id, key, direction, unit in kpis:
                val = _compute_kpi_value(c, key, 'DOMAIN', did)
                if val is not None:
                    c.execute('''INSERT OR REPLACE INTO kpi_value
                        (kpi_id,scope,scope_id,window_days,value,as_of_date,job_id)
                        VALUES (?,?,?,?,?,?,?)''',
                        (kpi_id, 'DOMAIN', did, 7, val, today, job_id))
                    count += 1

        # ── scope=SEGMENT: rolling KPIs per segment ──
        c.execute('SELECT segment_id FROM segment WHERE is_enabled=1')
        seg_ids = [r[0] for r in c.fetchall()]
        for seg_id in seg_ids:
            for kpi_id, key, direction, unit in kpis:
                val = _compute_kpi_value(c, key, 'SEGMENT', seg_id)
                if val is not None:
                    c.execute('''INSERT OR REPLACE INTO kpi_value
                        (kpi_id,scope,scope_id,window_days,value,as_of_date,job_id)
                        VALUES (?,?,?,?,?,?,?)''',
                        (kpi_id, 'SEGMENT', seg_id, 7, val, today, job_id))
                    count += 1

        _log(c, "KPI_COMPUTE", "INFO", "KPI_COMPUTED", f"count={count}",
             job_id=job_id)
        conn.commit()
        return count
    finally:
        conn.close()


def _compute_kpi_value(c, kpi_key, scope, scope_id):
    """Compute a single KPI value. Returns float or None."""
    if kpi_key == "CRITICAL_RATE":
        if scope == 'JOB':
            c.execute('''SELECT COUNT(*) as total,
                SUM(CASE WHEN ps.issues_count_critical>0 THEN 1 ELSE 0 END) as with_crit
                FROM page_snapshot ps WHERE ps.job_id=?''', (scope_id,))
        elif scope == 'DOMAIN':
            c.execute('''SELECT COUNT(*) as total,
                SUM(CASE WHEN ps.issues_count_critical>0 THEN 1 ELSE 0 END) as with_crit
                FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
                WHERE p.domain_id=? AND p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                      (scope_id,))
        elif scope == 'SEGMENT':
            c.execute('''SELECT COUNT(*) as total,
                SUM(CASE WHEN ps.issues_count_critical>0 THEN 1 ELSE 0 END) as with_crit
                FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
                JOIN domain_segment ds ON p.domain_id=ds.domain_id
                WHERE ds.segment_id=? AND p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                      (scope_id,))
        else:
            return None
        r = c.fetchone()
        if r and r[0] > 0:
            return round(r[1] / r[0], 4)
        return 0.0

    elif kpi_key == "SCORE_P50":
        if scope == 'DOMAIN':
            c.execute('''SELECT ps.score_total FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                WHERE p.domain_id=? AND p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
                ORDER BY ps.score_total''', (scope_id,))
        elif scope == 'SEGMENT':
            c.execute('''SELECT ps.score_total FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                JOIN domain_segment ds ON p.domain_id=ds.domain_id
                WHERE ds.segment_id=? AND p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
                ORDER BY ps.score_total''', (scope_id,))
        elif scope == 'JOB':
            c.execute('''SELECT ps.score_total FROM page_snapshot ps
                WHERE ps.job_id=? ORDER BY ps.score_total''', (scope_id,))
        else:
            return None
        scores = [r[0] for r in c.fetchall() if r[0] is not None]
        if not scores:
            return None
        mid = len(scores) // 2
        return float(scores[mid]) if len(scores) % 2 else float((scores[mid-1] + scores[mid]) / 2)

    elif kpi_key in ("NO_H1_RATE", "CANONICAL_MISSING_RATE"):
        issue_code = "NO_H1" if kpi_key == "NO_H1_RATE" else "CANONICAL_MISSING"
        if scope == 'JOB':
            c.execute('SELECT COUNT(DISTINCT ps.snap_id) FROM page_snapshot ps WHERE ps.job_id=?', (scope_id,))
            total = c.fetchone()[0]
            c.execute('''SELECT COUNT(DISTINCT pi.snap_id) FROM page_issue pi
                JOIN page_snapshot ps ON pi.snap_id=ps.snap_id
                JOIN issue i ON pi.issue_id=i.issue_id
                WHERE ps.job_id=? AND i.code=?''', (scope_id, issue_code))
            hit = c.fetchone()[0]
        elif scope == 'DOMAIN':
            c.execute('''SELECT COUNT(*) FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                WHERE p.domain_id=? AND p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                      (scope_id,))
            total = c.fetchone()[0]
            c.execute('''SELECT COUNT(DISTINCT pi.snap_id) FROM page_issue pi
                JOIN page_snapshot ps ON pi.snap_id=ps.snap_id
                JOIN page p ON ps.page_id=p.page_id
                JOIN issue i ON pi.issue_id=i.issue_id
                WHERE p.domain_id=? AND p.is_representative=1 AND i.code=?
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                      (scope_id, issue_code))
            hit = c.fetchone()[0]
        elif scope == 'SEGMENT':
            c.execute('''SELECT COUNT(*) FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                JOIN domain_segment ds ON p.domain_id=ds.domain_id
                WHERE ds.segment_id=? AND p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                      (scope_id,))
            total = c.fetchone()[0]
            c.execute('''SELECT COUNT(DISTINCT pi.snap_id) FROM page_issue pi
                JOIN page_snapshot ps ON pi.snap_id=ps.snap_id
                JOIN page p ON ps.page_id=p.page_id
                JOIN domain_segment ds ON p.domain_id=ds.domain_id
                JOIN issue i ON pi.issue_id=i.issue_id
                WHERE ds.segment_id=? AND p.is_representative=1 AND i.code=?
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                      (scope_id, issue_code))
            hit = c.fetchone()[0]
        else:
            return None
        return round(hit / total, 4) if total > 0 else 0.0

    return None


# ═══════════════════════════════════════════════════════════════════════
# Ticket management v7
# ═══════════════════════════════════════════════════════════════════════
def create_ticket_from_alert(c, alert_aid, domain_id, page_id, cluster_id,
                              severity, issue_code, rule_set_id, snap_id=None):
    """
    ALERT_TO_TICKET_GATE: auto-create fix_ticket from alert event.
    Links alert + snapshot as evidence.
    Returns ticket_id.
    """
    c.execute('''INSERT INTO fix_ticket (source,domain_id,page_id,cluster_id,issue_code,rule_set_id,severity)
                 VALUES (?,?,?,?,?,?,?)''',
              ('ALERT', domain_id, page_id, cluster_id, issue_code, rule_set_id, severity))
    tid = c.lastrowid

    # Link alert as evidence
    c.execute('INSERT OR IGNORE INTO ticket_link (tid,kind,ref_id) VALUES (?,?,?)',
              (tid, 'ALERT', alert_aid))

    # Link snapshot as evidence if available
    if snap_id:
        c.execute('INSERT OR IGNORE INTO ticket_link (tid,kind,ref_id) VALUES (?,?,?)',
                  (tid, 'SNAPSHOT', snap_id))

    # Back-link ticket to alert_event
    c.execute('UPDATE alert_event SET ticket_id=? WHERE aid=?', (tid, alert_aid))

    # ── POLICY_GATE (v8) ── bind active policy to ticket
    bind_policy(c, 'TICKET', tid)

    return tid


def _alert_to_ticket(c, page_id, domain_id, snap_id, job_id, rs_id):
    """Process all un-ticketed CRITICAL/WARNING alerts for this snap and create tickets."""
    c.execute('''SELECT aid,severity,message,page_id,cluster_id FROM alert_event
        WHERE snap_id=? AND ticket_id IS NULL AND severity IN ('CRITICAL','WARNING')''',
              (snap_id,))
    alerts = c.fetchall()
    created = 0
    for aid, sev, msg, a_page_id, a_cluster_id in alerts:
        # Extract issue_code from message if possible
        issue_code = None
        if "issue:" in msg.lower():
            parts = msg.split(":")
            if len(parts) > 1:
                issue_code = parts[-1].strip()
        tid = create_ticket_from_alert(c, aid, domain_id, a_page_id or page_id,
                                        a_cluster_id, sev, issue_code, rs_id, snap_id)
        created += 1
    return created


def update_ticket(tid, status=None, note=None):
    """Update ticket status. Auto-sets closed_at when FIXED/WONTFIX."""
    conn = get_conn()
    try:
        c = conn.cursor()
        updates, vals = [], []
        if status:
            updates.append('status=?'); vals.append(status)
            if status in ('FIXED', 'WONTFIX'):
                updates.append("closed_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')")
        if note:
            updates.append('note=?'); vals.append(note)
        if updates:
            vals.append(tid)
            c.execute(f"UPDATE fix_ticket SET {','.join(updates)} WHERE tid=?", vals)
        conn.commit()
    finally:
        conn.close()


def link_ticket_evidence(tid, kind, ref_id):
    """Manually link evidence to a ticket."""
    conn = get_conn()
    try:
        conn.execute('INSERT OR IGNORE INTO ticket_link (tid,kind,ref_id) VALUES (?,?,?)',
                     (tid, kind, ref_id))
        conn.commit()
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# 27+2 Gate pipeline: save_analysis v7
# ═══════════════════════════════════════════════════════════════════════
def save_analysis(data, job_id=None, raw_html=None, headers=None, timings=None, edge_data=None):
    """
    Full v13 pipeline (54 gates). Returns (success:bool, page_id:str, status:str).
    edge_data = {"internal_links_sample": [...], "external_links_sample": [...],
                 "canonical_url_norm": str|None, "hreflang_map": dict|None}
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        tm = timings or {}

        url = data.get("target_url", "")
        url_n = normalize_url(url)
        domain_name = extract_domain(url)
        final_url = data.get("final_url", url)
        redirect_chain = json.dumps(data.get("redirect_chain", []))
        status_code = data.get("status_code", 200)
        ct_raw = headers or {}
        content_type = ct_raw.get("content-type", ct_raw.get("Content-Type", "text/html"))

        html_bytes = raw_html.encode('utf-8') if raw_html else b""
        html_size = len(html_bytes)
        sha256_html = hashlib.sha256(html_bytes).hexdigest() if html_bytes else None

        now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        status_family = f"{status_code // 100}xx" if status_code else "other"

        # ── domain ──
        domain_id = ensure_domain(c, domain_name)
        dcfg = get_domain_config(c, domain_id)

        # ── page upsert ──
        c.execute('SELECT page_id,sha256_html,last_seen_at FROM page WHERE url_norm=?', (url_n,))
        existing = c.fetchone()
        if existing:
            page_id = existing[0]
            c.execute('''UPDATE page SET last_seen_at=?,last_status_code=?,content_type=?,
                         sha256_html=?,html_size=?,canonical_url=?,final_url=?,redirect_chain_json=?,domain_id=?
                         WHERE page_id=?''',
                      (now,status_code,content_type,sha256_html,html_size,
                       data.get("canonical"),final_url,redirect_chain,domain_id,page_id))
        else:
            c.execute('''INSERT INTO page (domain_id,domain,url,url_norm,final_url,redirect_chain_json,
                         canonical_url,first_seen_at,last_seen_at,last_status_code,content_type,sha256_html,html_size)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (domain_id,domain_name,url,url_n,final_url,redirect_chain,
                       data.get("canonical"),now,now,status_code,content_type,sha256_html,html_size))
            page_id = c.lastrowid

        # ── HTTP cache ──
        etag = ct_raw.get("etag", ct_raw.get("ETag"))
        lm = ct_raw.get("last-modified", ct_raw.get("Last-Modified"))
        if etag or lm:
            _upsert_http_cache(c, page_id, etag, lm)

        # ── 304 path ──
        if status_code == 304:
            _log(c, "HTTP_COND_FETCH", "INFO", "HTTP_304", f"304 for {url_n}",
                 job_id=job_id, domain_id=domain_id, page_id=page_id)
            conn.commit()
            return True, str(page_id), "HTTP_304"

        # ── FETCH_GATE ──
        if status_code not in (200, 301, 302, 304):
            _save_minimal(c, page_id, job_id, now, data, ["FETCH_NOT_HTML"], status_family, tm)
            _log(c, "FETCH", "WARN", "FETCH_NOT_HTML", f"status={status_code}",
                 job_id=job_id, domain_id=domain_id, page_id=page_id)
            conn.commit()
            return True, str(page_id), "FETCH_FAILED"

        if content_type and 'text/html' not in content_type.lower() and status_code not in (301, 302):
            _save_minimal(c, page_id, job_id, now, data, ["FETCH_NOT_HTML"], status_family, tm)
            _log(c, "FETCH", "WARN", "FETCH_NOT_HTML", f"ct={content_type}",
                 job_id=job_id, domain_id=domain_id, page_id=page_id)
            conn.commit()
            return True, str(page_id), "FETCH_FAILED"

        # ── PARSE_GATE ──
        sha256_dom = data.get("sha256_dom")
        if 0 < html_size < 500:
            _save_minimal(c, page_id, job_id, now, data, ["FETCH_TOO_SMALL","PARSE_FAILED"], status_family, tm)
            _log(c, "PARSE", "ERROR", "PARSE_FAILED", f"too_small={html_size}",
                 job_id=job_id, domain_id=domain_id, page_id=page_id)
            conn.commit()
            return True, str(page_id), "PARSE_FAILED"
        if not sha256_dom and not data.get("page_title"):
            _save_minimal(c, page_id, job_id, now, data, ["PARSE_FAILED"], status_family, tm)
            _log(c, "PARSE", "ERROR", "PARSE_FAILED", "no_dom_hash_no_title",
                 job_id=job_id, domain_id=domain_id, page_id=page_id)
            conn.commit()
            return True, str(page_id), "PARSE_FAILED"

        # ── DEDUP_GATE ──
        ttl_h = dcfg["ttl_hours"]
        c.execute('SELECT snap_id,sha256_dom,fetched_at FROM page_snapshot WHERE page_id=? ORDER BY snap_id DESC LIMIT 1', (page_id,))
        prev = c.fetchone()
        if prev and sha256_dom:
            prev_sid, prev_hash, prev_ts = prev
            ttl_exp = False
            if prev_ts:
                try:
                    ttl_exp = (datetime.datetime.utcnow() - datetime.datetime.strptime(prev_ts,'%Y-%m-%dT%H:%M:%SZ')).total_seconds() >= ttl_h*3600
                except ValueError:
                    ttl_exp = True
            if prev_hash and prev_hash == sha256_dom and not ttl_exp:
                c.execute("UPDATE page SET last_seen_at=? WHERE page_id=?", (now, page_id))
                _log(c, "DEDUP", "INFO", "SNAPSHOT_SKIPPED_DUP", "unchanged dom_hash",
                     job_id=job_id, domain_id=domain_id, page_id=page_id)
                conn.commit()
                return True, str(page_id), "DEDUP_SKIPPED"

        # ── build snapshot fields ──
        title = data.get("page_title")
        meta = data.get("meta_description")
        st = data.get("structure", {})
        h1c = st.get("h1_count", 0)
        h1t = ", ".join(st.get("h1_content", []))
        h1h = hashlib.md5(h1t.encode()).hexdigest() if h1t else None
        h2c = st.get("h2_count", 0)
        can = data.get("canonical"); rob = data.get("robots_meta"); lang = data.get("lang")
        wc = data.get("word_count",0); tl = data.get("text_len",0)
        s_text = data.get("sha256_text"); jc = data.get("jsonld_count",0)
        jt = json.dumps(data.get("jsonld_types",[])); oj = json.dumps(data.get("open_graph",{}),ensure_ascii=False)
        tc = json.dumps(data.get("twitter_card",{}),ensure_ascii=False)
        hl = json.dumps(data.get("hreflang",[]),ensure_ascii=False)
        il = data.get("internal_links_count",0); el = data.get("external_links_count",0)
        ic = data.get("images_count",0); ap = data.get("a11y_alt_coverage_pct",0.0)

        # ── RULE_SET_GATE (v5) ── resolve active rule set
        active_rs = get_active_rule_set(c)
        rs_id = active_rs["rule_set_id"] if active_rs else None
        rs_name = active_rs["name"] if active_rs else "v5_initial"

        # ── AUDIT_GATE ──
        issues = []
        bj = data.get("broken_jsonld", False)
        if not title:          issues.append("TITLE_MISSING")
        elif len(title) < 15:  issues.append("TITLE_TOO_SHORT")
        if h1c == 0:           issues.append("NO_H1")
        elif h1c > 1:          issues.append("MULTI_H1")
        if not meta or not meta.strip(): issues.append("NO_META_DESCRIPTION")
        if not can:            issues.append("CANONICAL_MISSING")
        if jc == 0:            issues.append("JSONLD_MISSING")
        if bj:                 issues.append("BROKEN_JSONLD")
        if not lang:           issues.append("LANG_MISSING")
        if rob and "noindex" in rob.lower(): issues.append("ROBOTS_NOINDEX")
        if data.get("hreflang") and data.get("hreflang_inconsistent"):
            issues.append("HREFLANG_INCONSISTENT")

        # ── ISSUE_NORMALIZATION_GATE (v5) ── deterministic sort
        issues.sort(key=lambda x: ({"CRITICAL":0,"WARNING":1,"INFO":2}.get(
            next((sev for cd,sev,*_ in ISSUE_TAXONOMY if cd==x), "INFO"), 2), x))

        sc, sb = compute_score(issues)
        verdict = {"issues": issues, "score": sc}

        # ── ISSUE_HASH_GATE (v5) ── compute deterministic hash
        i_sha256 = compute_issues_sha256(issues)
        i_crit, i_warn, i_info = count_issues_by_severity(issues)
        explain_compact = build_explain_compact(issues, sc, sb, rs_name)

        # ── v6: intent detection ──
        intent_flags = detect_page_intent(final_url, title)
        tpl_family = detect_template_family(intent_flags, final_url)

        # ── v11: intent_primary ──
        intent_primary = intent_flags[0] if intent_flags else "UNKNOWN"

        # ── SAFE_INTENT_DEPTH_GATE (v11) ── restrict LOGIN/SIGNUP
        _, _, auth_restricted = check_safe_intent_depth(intent_primary, final_url)
        if auth_restricted:
            _log(c, "SAFE_INTENT", "INFO", "AUTH_SURFACE_RESTRICTED",
                 f"intent={intent_primary} url={url_n} — depth restricted",
                 job_id=job_id, domain_id=domain_id, page_id=page_id)

        # ── INSERT snapshot (v6: +intent_flags, template_family) ──
        c.execute('''INSERT INTO page_snapshot
            (page_id,job_id,fetched_at,http_status_family,fetch_ms,parse_ms,audit_ms,
             title,title_len,meta_description,meta_description_len,
             h1,h1_count,h1_hash,h2_count,robots_meta,canonical,lang,
             word_count,text_len,sha256_text,sha256_dom,
             jsonld_count,jsonld_types_json,open_graph_json,twitter_card_json,hreflang_json,
             internal_links_count,external_links_count,images_count,a11y_alt_coverage_pct,
             score_total,score_breakdown_json,
             html_artifact_sha256,headers_artifact_sha256,
             verdict_json,
             issues_sha256,issues_count_critical,issues_count_warning,issues_count_info,
             explain_compact_json,intent_flags_json,template_family)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (page_id,job_id,now,status_family,tm.get("fetch_ms"),tm.get("parse_ms"),tm.get("audit_ms"),
             title,len(title) if title else 0,meta,len(meta) if meta else 0,
             h1t,h1c,h1h,h2c,rob,can,lang,wc,tl,s_text,sha256_dom,
             jc,jt,oj,tc,hl,il,el,ic,ap,sc,json.dumps(sb),
             sha256_html, hashlib.sha256(json.dumps(ct_raw).encode()).hexdigest() if ct_raw else None,
             json.dumps(verdict,ensure_ascii=False),
             i_sha256, i_crit, i_warn, i_info,
             json.dumps(explain_compact,ensure_ascii=False),
             json.dumps(intent_flags), tpl_family))
        snap_id = c.lastrowid

        # ── snapshot_rule_binding (v5) ──
        if rs_id:
            c.execute('INSERT OR IGNORE INTO snapshot_rule_binding (snap_id,rule_set_id) VALUES (?,?)',
                      (snap_id, rs_id))

        # link issues
        for code in issues:
            c.execute('SELECT issue_id FROM issue WHERE code=?', (code,))
            r = c.fetchone()
            if r: c.execute('INSERT OR IGNORE INTO page_issue (snap_id,issue_id) VALUES (?,?)', (snap_id,r[0]))

        # ── INTEGRITY_EVAL_GATE (v12) ── check snapshot completeness
        snap_complete, integrity_reasons = evaluate_snapshot_integrity(c, snap_id, rs_id)
        if not snap_complete:
            _log(c, "INTEGRITY", "WARN", "SNAPSHOT_INCOMPLETE",
                 f"snap={snap_id} reasons={integrity_reasons}",
                 job_id=job_id, domain_id=domain_id, page_id=page_id, snap_id=snap_id)

        # ── LINEAGE_WRITE_GATE (v13) ── record data lineage edges
        if job_id:
            write_lineage_edge(c, "JOB", job_id, "SNAPSHOT", snap_id,
                               "CRAWL_TO_SNAPSHOT", job_id=job_id)
        for code in issues:
            c.execute('SELECT issue_id FROM issue WHERE code=?', (code,))
            ir = c.fetchone()
            if ir:
                write_lineage_edge(c, "SNAPSHOT", snap_id, "ISSUE", ir[0],
                                   "SNAPSHOT_TO_ISSUE", job_id=job_id)

        # ── ARTIFACT_PERSIST ──
        store_bytes = dcfg["tier"] == "A"
        if sha256_html and html_bytes:
            blob = html_bytes if (store_bytes and html_size <= ARTIFACT_POLICY["max_html_bytes"]) else None
            aid = _store_artifact(c, sha256_html, "HTML", blob, blob is not None)
            _link_artifact(c, snap_id, aid)
        if ct_raw:
            h_bytes = json.dumps(ct_raw).encode()
            h_sha = hashlib.sha256(h_bytes).hexdigest()
            aid = _store_artifact(c, h_sha, "HEADERS", h_bytes if store_bytes else None, store_bytes)
            _link_artifact(c, snap_id, aid)

        # ── FINGERPRINT_GATE (v15) ── extract HTTP header fingerprint
        if ct_raw and domain_id:
            extract_http_fingerprint(c, domain_id, ct_raw)

        # ── DELTA_GATE ──
        score_delta_val = 0
        new_issue_codes = []
        if prev:
            delta_info = _compute_delta(c, page_id, prev[0], snap_id)
            if delta_info:
                score_delta_val = delta_info.get("score_delta", 0)
                new_issue_codes = delta_info.get("added", [])

        # ── GRAPH_WRITE_GATE (v4) ──
        if edge_data:
            edge_list = build_edge_list(data, page_id, domain_id, domain_name)
            for url_s in sorted(edge_data.get("internal_links_sample", []))[:EDGE_SAMPLE_CAP]:
                edge_list.append({"to_url_norm": normalize_url(url_s), "edge_type": "INTERNAL_LINK", "to_domain_id": domain_id})
            for url_s in sorted(edge_data.get("external_links_sample", []))[:EDGE_SAMPLE_CAP]:
                edge_list.append({"to_url_norm": normalize_url(url_s), "edge_type": "EXTERNAL_LINK"})
            _write_graph_edges(c, page_id, snap_id, domain_id, edge_list, now)
            _log(c, "GRAPH_WRITE", "INFO", "EDGES_WRITTEN", f"edges={len(edge_list)}",
                 job_id=job_id, domain_id=domain_id, page_id=page_id, snap_id=snap_id)
        else:
            base_edges = build_edge_list(data, page_id, domain_id, domain_name)
            if base_edges:
                _write_graph_edges(c, page_id, snap_id, domain_id, base_edges, now)
                _log(c, "GRAPH_WRITE", "INFO", "EDGES_WRITTEN", f"edges={len(base_edges)} (base)",
                     job_id=job_id, domain_id=domain_id, page_id=page_id, snap_id=snap_id)

        # ── CLUSTERING_GATE (v4) ──
        ck = compute_cluster_key(final_url, url)
        cluster_id = _update_cluster(c, page_id, domain_id, ck, now)

        # ── ALERT_EVAL_GATE (v4) ──
        alert_fired = _evaluate_alerts(c, page_id, domain_id, snap_id, job_id,
                         score_delta=score_delta_val, new_issues=new_issue_codes,
                         cluster_id=cluster_id)

        # ── site hint update (v4) ──
        has_hreflang = bool(data.get("hreflang"))
        upsert_site_hint(c, domain_id, appears_multilingual=has_hreflang)

        # ── DETERMINISM_GATE (v5) ── check for drift if STRICT mode
        if job_id:
            c.execute('SELECT determinism_mode FROM crawl_job WHERE job_id=?', (job_id,))
            dm_row = c.fetchone()
            if dm_row and dm_row[0] == 'STRICT' and prev:
                prev_sha = None
                c.execute('SELECT issues_sha256 FROM page_snapshot WHERE snap_id=?', (prev[0],))
                pr = c.fetchone()
                if pr: prev_sha = pr[0]
                if prev_sha and prev_sha != i_sha256:
                    # Same DOM hash but different issues = non-deterministic
                    if prev[1] and sha256_dom and prev[1] == sha256_dom:
                        c.execute('''INSERT INTO drift_check
                            (page_id,snap_a_id,snap_b_id,rule_set_id,issues_sha256_a,issues_sha256_b,is_deterministic,drift_details_json)
                            VALUES (?,?,?,?,?,?,?,?)''',
                            (page_id, prev[0], snap_id, rs_id, prev_sha, i_sha256, 0,
                             json.dumps({"reason": "same_dom_different_issues"}, ensure_ascii=False)))
                        _log(c, "DETERMINISM", "WARN", "DRIFT_DETECTED",
                             f"page_id={page_id} sha_a={prev_sha[:12]} sha_b={i_sha256[:12]}",
                             job_id=job_id, domain_id=domain_id, page_id=page_id, snap_id=snap_id)

        # ── QA_SAMPLING_GATE (v5) ── flag snapshots for human review
        is_new_domain = not existing  # first time seeing this page
        _qa_sample_check(c, snap_id, job_id, page_id, domain_id,
                         is_new_domain=is_new_domain, score_delta=score_delta_val,
                         alert_fired=bool(alert_fired))

        # ── SEGMENT_ASSIGN_GATE (v6) ── assign domain to segment(s)
        segment_ids, is_outlier = _assign_segment(c, domain_id, domain_name)
        _log(c, "SEGMENT_ASSIGN", "INFO", "SEGMENT_ASSIGNED",
             f"segments={segment_ids} outlier={is_outlier}",
             job_id=job_id, domain_id=domain_id, page_id=page_id, snap_id=snap_id)

        # ── BASELINE_BUILD_GATE (v6) ── build baselines per segment (periodic, not every save)
        # Only build baseline if this is a representative page and segments are assigned
        # Baseline is built lazily — query functions trigger it when needed

        # ── RELATIVE_ALERT_GATE (v6) ── fire alerts based on segment baseline
        rel_alerts = _evaluate_relative_alert(c, domain_id, snap_id, job_id,
                                               segment_ids, sc, i_crit)

        # ── ALERT_TO_TICKET_GATE (v7) ── auto-create tickets from alerts
        tickets_created = _alert_to_ticket(c, page_id, domain_id, snap_id, job_id, rs_id)

        # ── COST_ACCOUNTING_GATE (v9) ── record costs for each stage
        if job_id:
            record_cost(c, job_id, "FETCH", 1 + (html_size / 1024.0),
                        domain_id=domain_id, page_id=page_id, snap_id=snap_id,
                        meta={"html_kb": round(html_size/1024.0, 2), "status": status_code})
            if tm.get("parse_ms"):
                record_cost(c, job_id, "PARSE", tm["parse_ms"],
                            domain_id=domain_id, page_id=page_id, snap_id=snap_id)
            if tm.get("audit_ms"):
                token_est = (wc or 0) + len(issues) * 10  # rough token estimate
                record_cost(c, job_id, "AUDIT", token_est,
                            domain_id=domain_id, page_id=page_id, snap_id=snap_id,
                            meta={"audit_complexity": "HIGH" if len(issues) > 5 else "MED" if len(issues) > 2 else "LOW",
                                  "token_estimate": token_est})
            if sha256_html and html_bytes:
                record_cost(c, job_id, "ARTIFACT", html_size / 1024.0,
                            domain_id=domain_id, page_id=page_id, snap_id=snap_id)
            if prev:
                record_cost(c, job_id, "DELTA", tm.get("parse_ms", 0) * 0.1,
                            domain_id=domain_id, page_id=page_id, snap_id=snap_id)

        # ── BUDGET_EVAL_GATE (v9) ── check budget status
        budget_status = "OK"
        if job_id:
            budget_status, spent, limit_t = evaluate_budget(c, job_id)
            if budget_status == "HARD_STOP":
                _log(c, "BUDGET", "WARN", "BUDGET_EXCEEDED",
                     f"job={job_id} spent={spent} limit={limit_t}",
                     job_id=job_id, domain_id=domain_id, page_id=page_id, snap_id=snap_id)

        # ── DOMAIN_COST_TIER_GATE (v9) ── reclassify domain cost tier
        if domain_id:
            compute_domain_cost_tier(c, domain_id)

        _log(c, "AUDIT", "INFO", "SAVED",
             f"score={sc} issues={len(issues)} cluster={cluster_id} sha={i_sha256[:12]} rule={rs_name} "
             f"intent={intent_flags} tpl={tpl_family} seg={segment_ids} tickets={tickets_created} budget={budget_status}",
             job_id=job_id, domain_id=domain_id, page_id=page_id, snap_id=snap_id)

        conn.commit()
        return True, str(page_id), "SAVED"
    finally:
        conn.close()


def _save_minimal(c, page_id, job_id, now, data, issue_codes, status_family, tm):
    verdict = {"issues": issue_codes, "score": 0, "gate_failed": True}
    c.execute('''INSERT OR IGNORE INTO page_snapshot
        (page_id,job_id,fetched_at,http_status_family,fetch_ms,title,meta_description,score_total,verdict_json)
        VALUES (?,?,?,?,?,?,?,?,?)''',
        (page_id,job_id,now,status_family,tm.get("fetch_ms"),
         data.get("page_title"),data.get("meta_description"),0,json.dumps(verdict)))
    sid = c.lastrowid
    if sid:
        for code in issue_codes:
            c.execute('SELECT issue_id FROM issue WHERE code=?', (code,))
            r = c.fetchone()
            if r: c.execute('INSERT OR IGNORE INTO page_issue (snap_id,issue_id) VALUES (?,?)', (sid,r[0]))


def _compute_delta(c, page_id, from_sid, to_sid):
    """Compute delta with v4 changed_flags. Returns delta info dict."""
    flds = ['title','meta_description','h1','canonical','robots_meta','jsonld_types_json','lang',
            'h1_count','h2_count','score_total','internal_links_count','external_links_count']
    c.execute(f"SELECT {','.join(flds)} FROM page_snapshot WHERE snap_id=?", (from_sid,))
    old = c.fetchone()
    c.execute(f"SELECT {','.join(flds)} FROM page_snapshot WHERE snap_id=?", (to_sid,))
    new = c.fetchone()
    if not old or not new: return None

    changed = {}
    # Map field changes to v4 changed_flags
    flag_map = {
        'title': 'TITLE_CHANGED', 'meta_description': 'META_CHANGED',
        'h1': 'H1_CHANGED', 'canonical': 'CANONICAL_CHANGED',
        'robots_meta': 'ROBOTS_CHANGED', 'jsonld_types_json': 'JSONLD_TYPES_CHANGED',
        'lang': 'LANG_CHANGED',
    }
    link_fields = {'internal_links_count', 'external_links_count'}

    for i, fld in enumerate(flds):
        if old[i] != new[i]:
            changed[fld] = {"from": old[i], "to": new[i]}

    # Check if link graph changed
    link_changed = any(fld in changed for fld in link_fields)
    if link_changed:
        changed["_flag_LINK_GRAPH_CHANGED"] = True

    # Build changed_flags list
    flags = []
    for fld, flag in flag_map.items():
        if fld in changed:
            flags.append(flag)
    if link_changed:
        flags.append("LINK_GRAPH_CHANGED")

    c.execute('SELECT i.code FROM page_issue pi JOIN issue i ON pi.issue_id=i.issue_id WHERE pi.snap_id=?', (from_sid,))
    oi = {r[0] for r in c.fetchall()}
    c.execute('SELECT i.code FROM page_issue pi JOIN issue i ON pi.issue_id=i.issue_id WHERE pi.snap_id=?', (to_sid,))
    ni = {r[0] for r in c.fetchall()}
    added = sorted(ni-oi); removed = sorted(oi-ni)
    si = flds.index('score_total')
    sd = (new[si] or 0) - (old[si] or 0)

    if changed or added or removed:
        c.execute('''INSERT OR IGNORE INTO snapshot_delta
            (page_id,from_snap_id,to_snap_id,changed_flags_json,issue_added_json,issue_removed_json,score_delta)
            VALUES (?,?,?,?,?,?,?)''',
            (page_id,from_sid,to_sid,
             json.dumps({"flags": flags, "details": {k:v for k,v in changed.items() if not k.startswith("_")}}, ensure_ascii=False),
             json.dumps(added),json.dumps(removed),sd))

    return {"score_delta": sd, "added": added, "removed": removed, "flags": flags}


# ═══════════════════════════════════════════════════════════════════════
# QUERY LAYER v4
# ═══════════════════════════════════════════════════════════════════════
def query_representative_leaderboard(order="DESC", limit=20):
    """Representative leaderboard (latest score_total) by domain — v4 uses is_representative."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute(f'''SELECT d.domain,d.tier,ps.score_total,p.url,ps.fetched_at,cc.cluster_key
            FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
            JOIN domain d ON p.domain_id=d.domain_id
            LEFT JOIN canonical_cluster cc ON p.cluster_id=cc.cluster_id
            WHERE p.is_representative=1
              AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
            ORDER BY ps.score_total {order} LIMIT ?''', (limit,))
        return [{"domain":r[0],"tier":r[1],"score":r[2],"url":r[3],"fetched_at":r[4],"cluster_key":r[5]} for r in c.fetchall()]
    finally:
        conn.close()

def query_top_new_criticals(job_id=None):
    """Top new CRITICAL issues (last job) grouped by issue.code."""
    conn = get_conn()
    try:
        c = conn.cursor()
        if job_id is None:
            c.execute('SELECT MAX(job_id) FROM crawl_job')
            r = c.fetchone()
            job_id = r[0] if r else None
        if not job_id:
            return []
        c.execute('''SELECT i.code,i.message,COUNT(*) as cnt
            FROM page_issue pi JOIN page_snapshot ps ON pi.snap_id=ps.snap_id
            JOIN issue i ON pi.issue_id=i.issue_id
            WHERE ps.job_id=? AND i.severity='CRITICAL'
            GROUP BY i.code ORDER BY cnt DESC''', (job_id,))
        return [{"code":r[0],"message":r[1],"count":r[2]} for r in c.fetchall()]
    finally:
        conn.close()

def query_cluster_inflation(min_size=5):
    """Canonical cluster inflation: clusters where size>=N."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT cc.cluster_id,cc.cluster_key,d.domain,cc.size,cc.representative_page_id,
            p.url,cc.updated_at
            FROM canonical_cluster cc
            JOIN domain d ON cc.domain_id=d.domain_id
            LEFT JOIN page p ON cc.representative_page_id=p.page_id
            WHERE cc.size>=? ORDER BY cc.size DESC''', (min_size,))
        return [{"cluster_id":r[0],"cluster_key":r[1],"domain":r[2],"size":r[3],
                 "rep_page_id":r[4],"rep_url":r[5],"updated_at":r[6]} for r in c.fetchall()]
    finally:
        conn.close()

def query_alert_feed(hours=24, severity=None):
    """Alert feed (last N hours) ordered by severity."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(hours=hours)).strftime('%Y-%m-%dT%H:%M:%SZ')
        if severity:
            c.execute('''SELECT ae.aid,ar.name,ae.severity,ae.message,ae.payload_json,ae.fired_at,
                d.domain,ae.page_id
                FROM alert_event ae JOIN alert_rule ar ON ae.rule_id=ar.rule_id
                LEFT JOIN domain d ON ae.domain_id=d.domain_id
                WHERE ae.fired_at>=? AND ae.severity=?
                ORDER BY CASE ae.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, ae.fired_at DESC''',
                      (cutoff, severity))
        else:
            c.execute('''SELECT ae.aid,ar.name,ae.severity,ae.message,ae.payload_json,ae.fired_at,
                d.domain,ae.page_id
                FROM alert_event ae JOIN alert_rule ar ON ae.rule_id=ar.rule_id
                LEFT JOIN domain d ON ae.domain_id=d.domain_id
                WHERE ae.fired_at>=?
                ORDER BY CASE ae.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, ae.fired_at DESC''',
                      (cutoff,))
        return [{"aid":r[0],"rule":r[1],"severity":r[2],"message":r[3],
                 "payload":json.loads(r[4] or '{}'),"fired_at":r[5],"domain":r[6],"page_id":r[7]} for r in c.fetchall()]
    finally:
        conn.close()

def query_sitemap_coverage():
    """Sitemap coverage: % of representative pages discovered via sitemap vs discovery."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain,
            SUM(CASE WHEN cf.source='SITEMAP' THEN 1 ELSE 0 END) as sitemap_count,
            SUM(CASE WHEN cf.source='DISCOVERY' THEN 1 ELSE 0 END) as discovery_count,
            SUM(CASE WHEN cf.source='SEED' THEN 1 ELSE 0 END) as seed_count,
            COUNT(*) as total
            FROM crawl_frontier cf
            LEFT JOIN domain d ON cf.domain_id=d.domain_id
            GROUP BY d.domain ORDER BY total DESC''')
        return [{"domain":r[0] or "unknown","sitemap":r[1],"discovery":r[2],"seed":r[3],"total":r[4],
                 "sitemap_pct":round(r[1]/r[4]*100,1) if r[4] else 0} for r in c.fetchall()]
    finally:
        conn.close()

# ── v3 queries retained ──
def query_score_leaderboard(order="DESC", limit=20):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute(f'''SELECT d.domain,d.tier,ps.score_total,p.url,ps.fetched_at
            FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
            JOIN domain d ON p.domain_id=d.domain_id
            WHERE ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
            ORDER BY ps.score_total {order} LIMIT ?''', (limit,))
        return [{"domain":r[0],"tier":r[1],"score":r[2],"url":r[3],"fetched_at":r[4]} for r in c.fetchall()]
    finally:
        conn.close()

def query_issue_heatmap():
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain,i.code,i.severity,COUNT(*) FROM page_issue pi
            JOIN page_snapshot ps ON pi.snap_id=ps.snap_id
            JOIN page p ON ps.page_id=p.page_id JOIN domain d ON p.domain_id=d.domain_id
            JOIN issue i ON pi.issue_id=i.issue_id
            WHERE ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
            GROUP BY d.domain,i.code ORDER BY d.domain,i.severity''')
        hm = {}
        for dom,code,sev,cnt in c.fetchall():
            hm.setdefault(dom,{})[code] = {"count":cnt,"severity":sev}
        return hm
    finally:
        conn.close()

def query_critical_rate_by_domain():
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain, d.tier,
            SUM(CASE WHEN i.severity='CRITICAL' THEN 1 ELSE 0 END) as crit,
            COUNT(DISTINCT ps.snap_id) as snaps
            FROM page_issue pi JOIN page_snapshot ps ON pi.snap_id=ps.snap_id
            JOIN page p ON ps.page_id=p.page_id JOIN domain d ON p.domain_id=d.domain_id
            JOIN issue i ON pi.issue_id=i.issue_id
            WHERE ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
            GROUP BY d.domain ORDER BY crit DESC''')
        return [{"domain":r[0],"tier":r[1],"critical_count":r[2],"snapshot_count":r[3]} for r in c.fetchall()]
    finally:
        conn.close()

def query_rising_criticals(weeks=1):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain, SUM(CASE WHEN sd.score_delta<0 THEN 1 ELSE 0 END) as drops,
            SUM(CASE WHEN json_array_length(sd.issue_added_json)>0 THEN 1 ELSE 0 END) as adds
            FROM snapshot_delta sd JOIN page p ON sd.page_id=p.page_id
            JOIN domain d ON p.domain_id=d.domain_id
            WHERE sd.created_at >= datetime('now',?)
            GROUP BY d.domain HAVING drops>0 ORDER BY drops DESC''', (f'-{weeks*7} days',))
        return [{"domain":r[0],"score_drops":r[1],"issue_additions":r[2]} for r in c.fetchall()]
    finally:
        conn.close()

def query_repeated_parse_failures(min_retries=3):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT p.url,d.domain,COUNT(*) as fail_count
            FROM page_issue pi JOIN page_snapshot ps ON pi.snap_id=ps.snap_id
            JOIN page p ON ps.page_id=p.page_id JOIN domain d ON p.domain_id=d.domain_id
            JOIN issue i ON pi.issue_id=i.issue_id
            WHERE i.code='PARSE_FAILED'
            GROUP BY p.page_id HAVING fail_count>=? ORDER BY fail_count DESC''', (min_retries,))
        return [{"url":r[0],"domain":r[1],"fail_count":r[2]} for r in c.fetchall()]
    finally:
        conn.close()

def query_304_ratio():
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain,
            SUM(CASE WHEN el.code='HTTP_304' THEN 1 ELSE 0 END) as c304,
            COUNT(*) as total
            FROM event_log el JOIN domain d ON el.domain_id=d.domain_id
            WHERE el.stage IN ('HTTP_COND_FETCH','FETCH','DEDUP','AUDIT')
            GROUP BY d.domain ORDER BY c304 DESC''')
        return [{"domain":r[0],"http_304":r[1],"total_events":r[2],
                 "ratio":round(r[1]/r[2]*100,1) if r[2] else 0} for r in c.fetchall()]
    finally:
        conn.close()

def query_score_volatility(min_snapshots=2):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain,d.tier,
            AVG(ps.score_total) as avg_s, COUNT(ps.snap_id) as n,
            MIN(ps.score_total) as mn, MAX(ps.score_total) as mx
            FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
            JOIN domain d ON p.domain_id=d.domain_id
            WHERE ps.score_total IS NOT NULL
            GROUP BY d.domain HAVING n>=? ORDER BY (mx-mn) DESC''', (min_snapshots,))
        return [{"domain":r[0],"tier":r[1],"avg_score":round(r[2],1),"snapshots":r[3],
                 "min":r[4],"max":r[5],"range":r[5]-r[4]} for r in c.fetchall()]
    finally:
        conn.close()

def get_latest_reports(limit=10):
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT ps.snap_id,d.domain,d.tier,p.url,ps.title,ps.h1_count,
            ps.score_total,ps.fetched_at,GROUP_CONCAT(i.code,', '),p.is_representative,p.cluster_id
            FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
            LEFT JOIN domain d ON p.domain_id=d.domain_id
            LEFT JOIN page_issue pi ON ps.snap_id=pi.snap_id
            LEFT JOIN issue i ON pi.issue_id=i.issue_id
            GROUP BY ps.snap_id ORDER BY ps.snap_id DESC LIMIT ?''', (limit,))
        return [{"snap_id":r[0],"domain":r[1],"tier":r[2],"url":r[3],"title":r[4],
                 "h1_count":r[5],"score":r[6],"fetched_at":r[7],"issues":r[8],
                 "is_representative":r[9],"cluster_id":r[10]} for r in c.fetchall()]
    finally:
        conn.close()

def get_domain_summary():
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain,d.tier,d.default_ttl_hours,d.sitemap_url,d.quality_floor_score,
            COUNT(DISTINCT p.page_id),
            COUNT(DISTINCT CASE WHEN p.is_representative=1 THEN p.page_id END),
            AVG(ps.score_total),MIN(ps.score_total),MAX(ps.score_total)
            FROM domain d LEFT JOIN page p ON d.domain_id=p.domain_id
            LEFT JOIN page_snapshot ps ON p.page_id=ps.page_id
              AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
            GROUP BY d.domain_id ORDER BY AVG(ps.score_total) ASC''')
        return [{"domain":r[0],"tier":r[1],"ttl":r[2],"sitemap":r[3],"quality_floor":r[4],
                 "pages":r[5],"representative_pages":r[6],
                 "avg":round(r[7],1) if r[7] else 0,"min":r[8] or 0,"max":r[9] or 0} for r in c.fetchall()]
    finally:
        conn.close()

def export_csv(output_path=None, job_id=None, view_name="INTERNAL"):
    """
    Export CSV with v8 gate enforcement:
      EXPORT_VIEW_GATE  → filter columns by view definition
      REDACTION_GATE    → apply redaction rules to text fields
      PUBLIC_EXPORT_FLOOR_GATE → cap URL samples for PUBLIC view
      AUDIT_TRAIL_GATE  → record export with policy binding + artifact hash
    """
    import csv
    if not output_path:
        suffix = f"_{view_name.lower()}" if view_name != "INTERNAL" else ""
        output_path = os.path.join(os.path.dirname(DB_PATH), f"report_export_v8{suffix}.csv")
    conn = get_conn()
    try:
        c = conn.cursor()

        # ── EXPORT_VIEW_GATE (v8) ── resolve view definition
        view = get_export_view(c, view_name)
        if not view:
            view = get_export_view(c, "INTERNAL")  # fallback
        view_id = view["view_id"] if view else None
        allowed_fields = set(view["allowed_fields"]) if view else set()

        # Full query — all columns available
        all_cols = ['domain','tier','url','title','meta_desc','h1','h1_count','h2_count',
                    'words','int_links','ext_links','images','a11y_pct','jsonld',
                    'score','fetch_ms','parse_ms','audit_ms','fetched_at',
                    'is_representative','cluster_id',
                    'issues_sha256','issues_count_critical','issues_count_warning','issues_count_info',
                    'intent_flags_json','template_family','issues']
        c.execute('''SELECT d.domain,d.tier,p.url,ps.title,ps.meta_description,ps.h1,ps.h1_count,
            ps.h2_count,ps.word_count,ps.internal_links_count,ps.external_links_count,
            ps.images_count,ps.a11y_alt_coverage_pct,ps.jsonld_count,ps.score_total,
            ps.fetch_ms,ps.parse_ms,ps.audit_ms,ps.fetched_at,
            p.is_representative,p.cluster_id,
            ps.issues_sha256,ps.issues_count_critical,ps.issues_count_warning,ps.issues_count_info,
            ps.intent_flags_json,ps.template_family,
            GROUP_CONCAT(i.code,'; ')
            FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
            LEFT JOIN domain d ON p.domain_id=d.domain_id
            LEFT JOIN page_issue pi ON ps.snap_id=pi.snap_id
            LEFT JOIN issue i ON pi.issue_id=i.issue_id
            WHERE ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
            GROUP BY ps.snap_id ORDER BY ps.score_total ASC''')
        raw_rows = c.fetchall()

        # ── PUBLIC_EXPORT_FLOOR_GATE (v8) ── cap URL samples per domain for PUBLIC view
        if view_name == "PUBLIC":
            domain_count = {}
            filtered_rows = []
            for row in raw_rows:
                dom = row[0] or "unknown"
                domain_count[dom] = domain_count.get(dom, 0) + 1
                if domain_count[dom] <= PUBLIC_URL_SAMPLE_CAP:
                    filtered_rows.append(row)
            raw_rows = filtered_rows

        # Filter columns by view
        if allowed_fields:
            col_indices = [i for i, col in enumerate(all_cols) if col in allowed_fields]
            export_cols = [all_cols[i] for i in col_indices]
        else:
            col_indices = list(range(len(all_cols)))
            export_cols = all_cols

        # ── REDACTION_GATE (v8) ── apply redaction rules to text fields
        redaction_applied = 0
        export_rows = []
        for row in raw_rows:
            new_row = []
            for idx in col_indices:
                val = row[idx]
                if isinstance(val, str) and val:
                    redacted = apply_redaction(val, scope="EXPORT")
                    if redacted != val:
                        redaction_applied = 1
                    val = redacted
                new_row.append(val)
            export_rows.append(new_row)

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(export_cols)
            w.writerows(export_rows)

        # ── AUDIT_TRAIL_GATE (v8) ── record export with policy binding + hashes
        file_bytes = open(output_path, 'rb').read()
        artifact_sha = hashlib.sha256(file_bytes).hexdigest()
        public_sha = artifact_sha if view_name == "PUBLIC" else None
        c.execute('''INSERT INTO export_job (job_id,export_type,output_path,row_count,artifact_sha256,
                     view_id,redaction_applied,public_artifact_sha256)
                     VALUES (?,?,?,?,?,?,?,?)''',
                  (job_id, 'CSV', output_path, len(export_rows), artifact_sha,
                   view_id, redaction_applied, public_sha))
        export_id = c.lastrowid
        # Bind policy to export
        bind_policy(c, 'EXPORT', export_id)
        # ── COST_ACCOUNTING_GATE (v9) ── record export cost
        if job_id:
            record_cost(c, job_id, "EXPORT", len(export_rows),
                        meta={"view": view_name, "redacted": bool(redaction_applied)})
        conn.commit()
        return output_path, len(export_rows)
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v5 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_drift_report(limit=50):
    """Drift report: pages where determinism failed (same DOM, different issues)."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT dc.check_id,p.url,d.domain,dc.issues_sha256_a,dc.issues_sha256_b,
            dc.is_deterministic,dc.drift_details_json,dc.checked_at,
            gr.name as rule_set_name
            FROM drift_check dc
            JOIN page p ON dc.page_id=p.page_id
            LEFT JOIN domain d ON p.domain_id=d.domain_id
            LEFT JOIN golden_rule gr ON dc.rule_set_id=gr.rule_set_id
            WHERE dc.is_deterministic=0
            ORDER BY dc.checked_at DESC LIMIT ?''', (limit,))
        return [{"check_id":r[0],"url":r[1],"domain":r[2],
                 "sha_a":r[3],"sha_b":r[4],"deterministic":bool(r[5]),
                 "details":json.loads(r[6] or '{}'),"checked_at":r[7],
                 "rule_set":r[8]} for r in c.fetchall()]
    finally:
        conn.close()


def query_qa_queue(status="PENDING", limit=50):
    """QA queue: snapshots awaiting human review."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT qs.sample_id,qs.reason,qs.status,qs.created_at,
            p.url,d.domain,ps.score_total,ps.issues_sha256,
            ps.issues_count_critical,ps.issues_count_warning,ps.issues_count_info
            FROM qa_sample qs
            JOIN page_snapshot ps ON qs.snap_id=ps.snap_id
            JOIN page p ON ps.page_id=p.page_id
            LEFT JOIN domain d ON p.domain_id=d.domain_id
            WHERE qs.status=?
            ORDER BY CASE qs.reason WHEN 'ALERT_FIRED' THEN 0
                WHEN 'VOLATILE' THEN 1 WHEN 'NEW_DOMAIN' THEN 2 ELSE 3 END,
                qs.created_at DESC
            LIMIT ?''', (status, limit))
        return [{"sample_id":r[0],"reason":r[1],"status":r[2],"created_at":r[3],
                 "url":r[4],"domain":r[5],"score":r[6],"issues_sha256":r[7],
                 "crit":r[8],"warn":r[9],"info":r[10]} for r in c.fetchall()]
    finally:
        conn.close()


def query_export_audit_trail(limit=20):
    """Export audit trail: all report exports with artifact hashes."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT ej.export_id,ej.export_type,ej.output_path,ej.row_count,
            ej.artifact_sha256,ej.created_at,ej.notes
            FROM export_job ej
            ORDER BY ej.created_at DESC LIMIT ?''', (limit,))
        return [{"export_id":r[0],"type":r[1],"path":r[2],"rows":r[3],
                 "sha256":r[4],"created_at":r[5],"notes":r[6]} for r in c.fetchall()]
    finally:
        conn.close()


def query_rule_set_history():
    """Rule set history: all golden_rule versions with active/frozen status."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT gr.rule_set_id,gr.name,gr.version,gr.is_active,gr.frozen_at,
            gr.created_at,gr.notes,
            (SELECT COUNT(*) FROM snapshot_rule_binding srb WHERE srb.rule_set_id=gr.rule_set_id) as snap_count
            FROM golden_rule gr
            ORDER BY gr.rule_set_id DESC''')
        return [{"rule_set_id":r[0],"name":r[1],"version":r[2],
                 "is_active":bool(r[3]),"frozen_at":r[4],"created_at":r[5],
                 "notes":r[6],"snapshot_count":r[7]} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v6 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_segment_leaderboard(segment_name=None, order="DESC", limit=10):
    """Segment leaderboard: top/bottom domains by score_total within a segment."""
    conn = get_conn()
    try:
        c = conn.cursor()
        if segment_name:
            c.execute(f'''SELECT d.domain,d.tier,ps.score_total,p.url,ps.fetched_at,s.name as segment,
                ps.intent_flags_json,ps.template_family
                FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
                JOIN domain d ON p.domain_id=d.domain_id
                JOIN domain_segment ds ON d.domain_id=ds.domain_id
                JOIN segment s ON ds.segment_id=s.segment_id
                WHERE p.is_representative=1 AND s.name=?
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
                ORDER BY ps.score_total {order} LIMIT ?''', (segment_name, limit))
        else:
            c.execute(f'''SELECT d.domain,d.tier,ps.score_total,p.url,ps.fetched_at,s.name as segment,
                ps.intent_flags_json,ps.template_family
                FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
                JOIN domain d ON p.domain_id=d.domain_id
                JOIN domain_segment ds ON d.domain_id=ds.domain_id
                JOIN segment s ON ds.segment_id=s.segment_id
                WHERE p.is_representative=1
                  AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)
                ORDER BY s.name, ps.score_total {order} LIMIT ?''', (limit * 3,))
        return [{"domain":r[0],"tier":r[1],"score":r[2],"url":r[3],"fetched_at":r[4],
                 "segment":r[5],"intent":json.loads(r[6] or '[]'),"template":r[7]} for r in c.fetchall()]
    finally:
        conn.close()


def query_baseline_view(segment_name=None, window_days=30):
    """Baseline view: p50/p75/p90 of score_total by segment."""
    conn = get_conn()
    try:
        c = conn.cursor()
        if segment_name:
            c.execute('''SELECT s.name,bs.metric_key,bs.p50,bs.p75,bs.p90,bs.window_days,bs.created_at
                FROM baseline_stat bs JOIN segment s ON bs.segment_id=s.segment_id
                WHERE s.name=? ORDER BY bs.created_at DESC''', (segment_name,))
        else:
            c.execute('''SELECT s.name,bs.metric_key,bs.p50,bs.p75,bs.p90,bs.window_days,bs.created_at
                FROM baseline_stat bs JOIN segment s ON bs.segment_id=s.segment_id
                ORDER BY s.name,bs.created_at DESC''')
        return [{"segment":r[0],"metric":r[1],"p50":r[2],"p75":r[3],"p90":r[4],
                 "window_days":r[5],"created_at":r[6]} for r in c.fetchall()]
    finally:
        conn.close()


def query_outliers():
    """Outliers list: domains flagged is_outlier=1."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain,d.tier,d.is_outlier,d.outlier_reason,
            GROUP_CONCAT(s.name,', ') as segments
            FROM domain d
            LEFT JOIN domain_segment ds ON d.domain_id=ds.domain_id
            LEFT JOIN segment s ON ds.segment_id=s.segment_id
            WHERE d.is_outlier=1
            GROUP BY d.domain_id ORDER BY d.domain''')
        return [{"domain":r[0],"tier":r[1],"is_outlier":bool(r[2]),
                 "reason":r[3],"segments":r[4]} for r in c.fetchall()]
    finally:
        conn.close()


def query_pair_report_history(limit=20):
    """Pair report history: export_job where type=PAIR_REPORT."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT ej.export_id,ej.output_path,ej.row_count,ej.artifact_sha256,
            ej.created_at,ej.notes
            FROM export_job ej WHERE ej.export_type='PAIR_REPORT'
            ORDER BY ej.created_at DESC LIMIT ?''', (limit,))
        return [{"export_id":r[0],"path":r[1],"rows":r[2],"sha256":r[3],
                 "created_at":r[4],"notes":r[5]} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v7 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_kpi_timeseries(kpi_key, scope="DOMAIN", scope_id=None, limit=30):
    """KPI time series: history of a KPI value over time."""
    conn = get_conn()
    try:
        c = conn.cursor()
        if scope_id:
            c.execute('''SELECT kd.key,kd.name,kd.direction,kv.value,kv.as_of_date,kv.scope,kv.scope_id
                FROM kpi_value kv JOIN kpi_definition kd ON kv.kpi_id=kd.kpi_id
                WHERE kd.key=? AND kv.scope=? AND kv.scope_id=?
                ORDER BY kv.as_of_date DESC LIMIT ?''', (kpi_key, scope, scope_id, limit))
        else:
            c.execute('''SELECT kd.key,kd.name,kd.direction,kv.value,kv.as_of_date,kv.scope,kv.scope_id
                FROM kpi_value kv JOIN kpi_definition kd ON kv.kpi_id=kd.kpi_id
                WHERE kd.key=? AND kv.scope=?
                ORDER BY kv.as_of_date DESC LIMIT ?''', (kpi_key, scope, limit))
        return [{"key":r[0],"name":r[1],"direction":r[2],"value":r[3],
                 "date":r[4],"scope":r[5],"scope_id":r[6]} for r in c.fetchall()]
    finally:
        conn.close()


def query_ticket_board(status=None, severity=None, limit=50):
    """Ticket board: fix_tickets with evidence counts."""
    conn = get_conn()
    try:
        c = conn.cursor()
        where = ["1=1"]
        params = []
        if status:
            where.append("ft.status=?"); params.append(status)
        if severity:
            where.append("ft.severity=?"); params.append(severity)
        params.append(limit)
        c.execute(f'''SELECT ft.tid,ft.source,ft.severity,ft.status,ft.issue_code,
            ft.opened_at,ft.closed_at,ft.note,
            d.domain,p.url,
            (SELECT COUNT(*) FROM ticket_link tl WHERE tl.tid=ft.tid) as evidence_count
            FROM fix_ticket ft
            LEFT JOIN domain d ON ft.domain_id=d.domain_id
            LEFT JOIN page p ON ft.page_id=p.page_id
            WHERE {' AND '.join(where)}
            ORDER BY CASE ft.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
                ft.opened_at DESC
            LIMIT ?''', params)
        return [{"tid":r[0],"source":r[1],"severity":r[2],"status":r[3],
                 "issue_code":r[4],"opened_at":r[5],"closed_at":r[6],"note":r[7],
                 "domain":r[8],"url":r[9],"evidence_count":r[10]} for r in c.fetchall()]
    finally:
        conn.close()


def query_ticket_evidence(tid):
    """Ticket evidence chain: all linked artifacts."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT tl.kind,tl.ref_id,tl.created_at FROM ticket_link tl
            WHERE tl.tid=? ORDER BY tl.created_at''', (tid,))
        links = []
        for kind, ref_id, created_at in c.fetchall():
            detail = None
            if kind == 'SNAPSHOT':
                c.execute('SELECT ps.score_total,ps.issues_sha256,ps.fetched_at FROM page_snapshot ps WHERE ps.snap_id=?', (ref_id,))
                r = c.fetchone()
                if r: detail = {"score": r[0], "sha": r[1], "fetched_at": r[2]}
            elif kind == 'ALERT':
                c.execute('SELECT ae.severity,ae.message,ae.fired_at FROM alert_event ae WHERE ae.aid=?', (ref_id,))
                r = c.fetchone()
                if r: detail = {"severity": r[0], "message": r[1], "fired_at": r[2]}
            elif kind == 'EXPORT':
                c.execute('SELECT ej.export_type,ej.artifact_sha256,ej.created_at FROM export_job ej WHERE ej.export_id=?', (ref_id,))
                r = c.fetchone()
                if r: detail = {"type": r[0], "sha": r[1], "created_at": r[2]}
            elif kind == 'EVENT':
                c.execute('SELECT el.stage,el.code,el.message,el.ts FROM event_log el WHERE el.eid=?', (ref_id,))
                r = c.fetchone()
                if r: detail = {"stage": r[0], "code": r[1], "message": r[2], "ts": r[3]}
            links.append({"kind": kind, "ref_id": ref_id, "created_at": created_at, "detail": detail})
        return links
    finally:
        conn.close()


def query_kpi_dashboard(scope="SEGMENT"):
    """KPI dashboard: latest value for all enabled KPIs, grouped by scope."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT kd.key,kd.name,kd.direction,kd.unit,kv.value,kv.as_of_date,
            kv.scope,kv.scope_id
            FROM kpi_value kv JOIN kpi_definition kd ON kv.kpi_id=kd.kpi_id
            WHERE kv.scope=?
              AND kv.id=(SELECT MAX(kv2.id) FROM kpi_value kv2
                         WHERE kv2.kpi_id=kv.kpi_id AND kv2.scope=kv.scope AND kv2.scope_id=kv.scope_id)
            ORDER BY kd.key,kv.scope_id''', (scope,))
        return [{"key":r[0],"name":r[1],"direction":r[2],"unit":r[3],
                 "value":r[4],"date":r[5],"scope":r[6],"scope_id":r[7]} for r in c.fetchall()]
    finally:
        conn.close()


def build_all_baselines(window_days=30):
    """Build baselines for all enabled segments. Returns dict of results."""
    conn = get_conn()
    try:
        c = conn.cursor()
        rs = get_active_rule_set(c)
        rs_id = rs["rule_set_id"] if rs else None
        c.execute('SELECT segment_id,name FROM segment WHERE is_enabled=1')
        segments = c.fetchall()
        results = {}
        for seg_id, seg_name in segments:
            count = _build_baseline(c, seg_id, rs_id, window_days)
            results[seg_name] = count
        conn.commit()
        return results
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v12 integrity + kpi_filter + data quality
# ═══════════════════════════════════════════════════════════════════════
def evaluate_snapshot_integrity(c, snap_id, rule_set_id=None):
    """
    INTEGRITY_EVAL_GATE: check snapshot completeness against all enabled integrity gates.
    Returns (is_complete:bool, reasons:list).
    """
    c.execute('''SELECT igid,name,requirements_json,severity FROM integrity_gate
        WHERE is_enabled=1 AND (rule_set_id IS NULL OR rule_set_id=?)''',
        (rule_set_id,))
    gates = c.fetchall()
    if not gates:
        return True, []

    # Get snapshot column values
    c.execute("PRAGMA table_info(page_snapshot)")
    all_cols = [r[1] for r in c.fetchall()]
    c.execute(f"SELECT {','.join(all_cols)} FROM page_snapshot WHERE snap_id=?", (snap_id,))
    row = c.fetchone()
    if not row:
        return False, ["SNAPSHOT_NOT_FOUND"]

    snap_data = dict(zip(all_cols, row))
    is_complete = True
    reasons = []

    for igid, gname, req_json, severity in gates:
        reqs = json.loads(req_json)
        missing = []

        # Check must_have fields (CRITICAL)
        for field in reqs.get("must_have", []):
            val = snap_data.get(field)
            if val is None or val == "" or val == 0:
                # Allow 0 for count fields only if explicitly 0 (not missing)
                if field.endswith("_count") and val == 0:
                    continue
                missing.append(field)

        # Check should_have fields (WARNING)
        for field in reqs.get("should_have", []):
            val = snap_data.get(field)
            if val is None:
                missing.append(field)

        status = "FAIL" if missing else "PASS"
        c.execute('''INSERT OR REPLACE INTO snapshot_integrity (snap_id,igid,status,missing_json)
            VALUES (?,?,?,?)''', (snap_id, igid, status, json.dumps(missing)))

        if status == "FAIL" and severity == "CRITICAL":
            is_complete = False
            reasons.append(f"{gname}:{','.join(missing)}")

    # Update snapshot completeness
    if not is_complete:
        reason_str = "; ".join(reasons)
        c.execute('UPDATE page_snapshot SET is_complete=0,complete_reason=? WHERE snap_id=?',
                  (reason_str, snap_id))
    else:
        c.execute('UPDATE page_snapshot SET is_complete=1,complete_reason=NULL WHERE snap_id=?',
                  (snap_id,))

    return is_complete, reasons


def get_kpi_filter_predicate(c, kpi_filter_id=None, rule_set_id=None):
    """
    KPI_FILTER_GATE: get the filter predicate for KPI computation.
    Falls back to REP_COMPLETE_ONLY if not specified.
    """
    if kpi_filter_id:
        c.execute('SELECT predicate_json FROM kpi_filter WHERE fid=? AND is_enabled=1', (kpi_filter_id,))
        row = c.fetchone()
        if row:
            return json.loads(row[0])

    # Fallback to default
    c.execute('SELECT predicate_json FROM kpi_filter WHERE name=? AND (rule_set_id IS NULL OR rule_set_id=?) AND is_enabled=1',
              ('REP_COMPLETE_ONLY', rule_set_id))
    row = c.fetchone()
    if row:
        return json.loads(row[0])

    # Hardcoded fallback
    return KPI_FILTER_TEMPLATE["predicate_json"]


def build_kpi_filter_clause(predicate):
    """Build SQL WHERE clause fragment from a kpi_filter predicate."""
    clauses = []
    params = []
    for key, val in predicate.items():
        if key == "is_representative":
            clauses.append("p.is_representative=?")
            params.append(val)
        elif key == "is_complete":
            clauses.append("ps.is_complete=?")
            params.append(val)
        elif key == "http_status_family":
            clauses.append("ps.http_status_family=?")
            params.append(val)
    return " AND ".join(clauses) if clauses else "1=1", params


def compute_data_quality_daily(scope="GLOBAL", scope_id=None):
    """
    DATA_QUALITY_DAILY_GATE: compute daily data quality metrics.
    Persists to data_quality_daily table.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        rs = get_active_rule_set(c)
        rs_id = rs["rule_set_id"] if rs else None

        # Build scope filter
        scope_clause = ""
        scope_params = []
        if scope == "DOMAIN" and scope_id:
            scope_clause = "AND p.domain_id=?"
            scope_params = [scope_id]
        elif scope == "SEGMENT" and scope_id:
            scope_clause = "AND p.domain_id IN (SELECT domain_id FROM domain_segment WHERE segment_id=?)"
            scope_params = [scope_id]

        # Total snapshots today
        c.execute(f'''SELECT COUNT(*) FROM page_snapshot ps
            JOIN page p ON ps.page_id=p.page_id
            WHERE ps.fetched_at LIKE ? {scope_clause}''',
            [f"{today}%"] + scope_params)
        total = c.fetchone()[0]
        if total == 0:
            return None

        # Pass rate (is_complete=1)
        c.execute(f'''SELECT COUNT(*) FROM page_snapshot ps
            JOIN page p ON ps.page_id=p.page_id
            WHERE ps.fetched_at LIKE ? AND ps.is_complete=1 {scope_clause}''',
            [f"{today}%"] + scope_params)
        pass_count = c.fetchone()[0]

        # Parse fail rate
        c.execute(f'''SELECT COUNT(*) FROM page_snapshot ps
            JOIN page p ON ps.page_id=p.page_id
            WHERE ps.fetched_at LIKE ? AND ps.http_status_family NOT IN ('2xx','3xx') {scope_clause}''',
            [f"{today}%"] + scope_params)
        parse_fail = c.fetchone()[0]

        # Fetch not html rate
        c.execute(f'''SELECT COUNT(*) FROM page_snapshot ps
            JOIN page p ON ps.page_id=p.page_id
            JOIN page_issue pi ON ps.snap_id=pi.snap_id
            JOIN issue i ON pi.issue_id=i.issue_id
            WHERE ps.fetched_at LIKE ? AND i.code='FETCH_NOT_HTML' {scope_clause}''',
            [f"{today}%"] + scope_params)
        not_html = c.fetchone()[0]

        pass_rate = round(pass_count / total, 4)
        incomplete_rate = round(1 - pass_rate, 4)
        parse_rate = round(parse_fail / total, 4)
        html_rate = round(not_html / total, 4)

        c.execute('''INSERT OR REPLACE INTO data_quality_daily
            (as_of_date,rule_set_id,scope,scope_id,snapshot_pass_rate,
             audit_incomplete_rate,parse_fail_rate,fetch_not_html_rate)
            VALUES (?,?,?,?,?,?,?,?)''',
            (today, rs_id, scope, scope_id, pass_rate, incomplete_rate, parse_rate, html_rate))
        conn.commit()
        return {"date": today, "total": total, "pass_rate": pass_rate,
                "incomplete_rate": incomplete_rate, "parse_fail_rate": parse_rate,
                "fetch_not_html_rate": html_rate}
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v13 lineage + sample_set + stability
# ═══════════════════════════════════════════════════════════════════════
def write_lineage_edge(c, from_kind, from_id, to_kind, to_id, edge_type, job_id=None, meta=None):
    """
    LINEAGE_WRITE_GATE: record a directed edge in the data lineage graph.
    Idempotent — duplicate edges are silently ignored.
    """
    if edge_type not in LINEAGE_EDGE_TYPES:
        return None
    c.execute('''INSERT OR IGNORE INTO lineage_edge
        (from_kind,from_id,to_kind,to_id,edge_type,job_id,meta_json)
        VALUES (?,?,?,?,?,?,?)''',
        (from_kind, from_id, to_kind, to_id, edge_type, job_id,
         json.dumps(meta, ensure_ascii=False) if meta else None))
    return c.lastrowid


def build_sample_set(name=None, strategy=None, sample_size=None,
                     rule_set_id=None, segment_id=None, refresh_days=None):
    """
    SAMPLE_SET_BUILD_GATE: create or refresh a monitoring sample set.
    Returns ssid.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        tpl = SAMPLE_SET_TEMPLATE
        sname = name or tpl["name"]
        strat = strategy or tpl["strategy"]
        sz = sample_size or tpl["sample_size"]
        rd = refresh_days or tpl["refresh_interval_days"]

        # Get or create
        c.execute('SELECT ssid FROM snapshot_sample_set WHERE name=? AND (rule_set_id IS NULL OR rule_set_id=?)',
                  (sname, rule_set_id))
        row = c.fetchone()
        now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

        if row:
            ssid = row[0]
            c.execute('''UPDATE snapshot_sample_set SET strategy=?,sample_size=?,
                segment_id=?,refresh_interval_days=?,last_refreshed_at=?,is_active=1
                WHERE ssid=?''', (strat, sz, segment_id, rd, now, ssid))
            # Clear old members on refresh
            c.execute('DELETE FROM sample_member WHERE ssid=?', (ssid,))
        else:
            c.execute('''INSERT INTO snapshot_sample_set
                (name,description,strategy,sample_size,rule_set_id,segment_id,
                 refresh_interval_days,last_refreshed_at)
                VALUES (?,?,?,?,?,?,?,?)''',
                (sname, tpl.get("description", ""), strat, sz,
                 rule_set_id, segment_id, rd, now))
            ssid = c.lastrowid

        # Populate members
        populate_sample_members(c, ssid, strat, sz, segment_id)
        conn.commit()
        return ssid
    finally:
        conn.close()


def populate_sample_members(c, ssid, strategy, sample_size, segment_id=None):
    """Populate sample set members from eligible pages."""
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

    if strategy == "STRATIFIED" and segment_id:
        # Stratified by segment: pick representative pages from segment
        c.execute('''SELECT p.page_id FROM page p
            JOIN domain_segment ds ON p.domain_id=ds.domain_id
            WHERE ds.segment_id=? AND p.is_representative=1
            ORDER BY p.last_seen_at DESC LIMIT ?''', (segment_id, sample_size))
    elif strategy == "TOP_N":
        # Top N by recency among representative pages
        c.execute('''SELECT page_id FROM page
            WHERE is_representative=1
            ORDER BY last_seen_at DESC LIMIT ?''', (sample_size,))
    else:
        # Random or default: random representative pages
        c.execute('''SELECT page_id FROM page
            WHERE is_representative=1
            ORDER BY RANDOM() LIMIT ?''', (sample_size,))

    pages = [r[0] for r in c.fetchall()]
    for pid in pages:
        c.execute('INSERT OR IGNORE INTO sample_member (ssid,page_id,reason) VALUES (?,?,?)',
                  (ssid, pid, strategy))


def compute_stability_stat(ssid=None):
    """
    STABILITY_DAILY_GATE: compute stability metrics for a sample set.
    Measures score_stddev, critical_flip_rate, issues_hash_flip_rate.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=STABILITY_WINDOW_DAYS)).strftime('%Y-%m-%dT%H:%M:%SZ')

        # Get active sample sets
        if ssid:
            c.execute('SELECT ssid,name,rule_set_id FROM snapshot_sample_set WHERE ssid=? AND is_active=1', (ssid,))
        else:
            c.execute('SELECT ssid,name,rule_set_id FROM snapshot_sample_set WHERE is_active=1')
        sets = c.fetchall()

        results = []
        for ss_id, ss_name, rs_id in sets:
            # Get members
            c.execute('SELECT page_id FROM sample_member WHERE ssid=?', (ss_id,))
            members = [r[0] for r in c.fetchall()]
            if len(members) < STABILITY_MIN_SAMPLE:
                continue

            scores = []
            crit_flips = 0
            hash_flips = 0
            member_count = 0

            for pid in members:
                # Get last 2 snapshots within window for this page
                c.execute('''SELECT snap_id,score_total,issues_sha256,issues_count_critical
                    FROM page_snapshot WHERE page_id=? AND fetched_at >= ?
                    ORDER BY fetched_at DESC LIMIT 2''', (pid, cutoff))
                snaps = c.fetchall()
                if not snaps:
                    continue

                member_count += 1
                scores.append(snaps[0][1] or 0)

                if len(snaps) == 2:
                    # Compare current vs previous
                    curr_sha = snaps[0][2]
                    prev_sha = snaps[1][2]
                    curr_crit = snaps[0][3] or 0
                    prev_crit = snaps[1][3] or 0

                    if curr_sha != prev_sha:
                        hash_flips += 1
                    if (curr_crit > 0) != (prev_crit > 0):
                        crit_flips += 1

            if member_count == 0:
                continue

            import statistics
            score_mean = statistics.mean(scores) if scores else 0
            score_stddev = statistics.stdev(scores) if len(scores) > 1 else 0
            crit_flip_rate = round(crit_flips / member_count, 4)
            hash_flip_rate = round(hash_flips / member_count, 4)
            stable_pct = round(1 - hash_flip_rate, 4)

            # Determine alert level
            alert_level = "OK"
            if hash_flip_rate > STABILITY_MAX_ISSUES_FLIP_RATE or score_stddev > STABILITY_MAX_SCORE_STDDEV:
                alert_level = "CRITICAL"
            elif hash_flip_rate > STABILITY_MAX_ISSUES_FLIP_RATE * 0.7 or score_stddev > STABILITY_MAX_SCORE_STDDEV * 0.7:
                alert_level = "WARNING"

            details = {
                "sample_name": ss_name,
                "scores_sampled": len(scores),
                "crit_flips": crit_flips,
                "hash_flips": hash_flips,
            }

            c.execute('''INSERT OR REPLACE INTO stability_stat
                (ssid,as_of_date,rule_set_id,member_count,score_mean,score_stddev,
                 critical_flip_rate,issues_hash_flip_rate,stable_pct,alert_level,details_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
                (ss_id, today, rs_id, member_count,
                 round(score_mean, 2), round(score_stddev, 2),
                 crit_flip_rate, hash_flip_rate, stable_pct,
                 alert_level, json.dumps(details, ensure_ascii=False)))

            results.append({
                "ssid": ss_id, "name": ss_name, "date": today,
                "members": member_count, "score_mean": round(score_mean, 2),
                "score_stddev": round(score_stddev, 2),
                "crit_flip_rate": crit_flip_rate, "hash_flip_rate": hash_flip_rate,
                "stable_pct": stable_pct, "alert_level": alert_level,
            })

        conn.commit()
        return results
    finally:
        conn.close()


def check_stability_alert():
    """
    STABILITY_ALERT_GATE: fire alerts for sample sets exceeding stability thresholds.
    Returns list of alerts fired.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

        c.execute('''SELECT st.stid,st.ssid,ss.name,st.score_stddev,st.critical_flip_rate,
            st.issues_hash_flip_rate,st.alert_level,st.member_count
            FROM stability_stat st
            JOIN snapshot_sample_set ss ON st.ssid=ss.ssid
            WHERE st.as_of_date=? AND st.alert_level IN ('WARNING','CRITICAL')''', (today,))

        alerts = []
        for stid, ss_id, ss_name, stddev, crit_flip, hash_flip, alert_lvl, members in c.fetchall():
            msg = (f"Stability alert [{alert_lvl}] sample={ss_name} "
                   f"stddev={stddev} crit_flip={crit_flip} hash_flip={hash_flip} members={members}")

            _log(c, "STABILITY", alert_lvl, "STABILITY_ALERT", msg)

            alerts.append({
                "stid": stid, "ssid": ss_id, "name": ss_name,
                "alert_level": alert_lvl, "score_stddev": stddev,
                "crit_flip_rate": crit_flip, "hash_flip_rate": hash_flip,
                "members": members, "message": msg,
            })

        conn.commit()
        return alerts
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v14 anomaly detection + baseline + cooldown
# ═══════════════════════════════════════════════════════════════════════
def compute_kpi_baseline_daily(scope="GLOBAL", scope_id=None):
    """
    KPI_BASELINE_DAILY_GATE: compute daily KPI baselines (mean/stddev/percentiles)
    for all metric_keys over a rolling window. Used by anomaly detectors.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        rs = get_active_rule_set(c)
        rs_id = rs["rule_set_id"] if rs else None

        results = []
        for mkey in KPI_BASELINE_METRIC_KEYS:
            window = KPI_BASELINE_WINDOW_DAYS
            cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=window)).strftime('%Y-%m-%d')

            # Collect values from kpi_value or data_quality_daily
            values = []
            if mkey in ("parse_fail_rate", "audit_incomplete_rate"):
                # From data_quality_daily
                if scope == "GLOBAL":
                    c.execute('''SELECT snapshot_pass_rate FROM data_quality_daily
                        WHERE scope='GLOBAL' AND as_of_date >= ?
                        ORDER BY as_of_date''', (cutoff,))
                    if mkey == "parse_fail_rate":
                        c.execute('''SELECT parse_fail_rate FROM data_quality_daily
                            WHERE scope=? AND (scope_id IS ? OR ? IS NULL) AND as_of_date >= ?
                            ORDER BY as_of_date''', (scope, scope_id, scope_id, cutoff))
                    else:
                        c.execute('''SELECT audit_incomplete_rate FROM data_quality_daily
                            WHERE scope=? AND (scope_id IS ? OR ? IS NULL) AND as_of_date >= ?
                            ORDER BY as_of_date''', (scope, scope_id, scope_id, cutoff))
                    values = [r[0] for r in c.fetchall() if r[0] is not None]
            else:
                # From kpi_value
                scope_filter = ""
                scope_params = []
                if scope == "DOMAIN" and scope_id:
                    scope_filter = "AND scope='DOMAIN' AND scope_id=?"
                    scope_params = [str(scope_id)]
                elif scope == "SEGMENT" and scope_id:
                    scope_filter = "AND scope='SEGMENT' AND scope_id=?"
                    scope_params = [str(scope_id)]
                else:
                    scope_filter = "AND scope='GLOBAL'"

                c.execute(f'''SELECT value FROM kpi_value
                    WHERE key=? AND as_of_date >= ? {scope_filter}
                    ORDER BY as_of_date''',
                    [mkey, cutoff] + scope_params)
                values = [r[0] for r in c.fetchall() if r[0] is not None]

            if not values:
                _log(c, "BASELINE", "INFO", "KPI_BASELINE_SKIPPED",
                     f"metric={mkey} scope={scope} no data in window={window}d")
                continue

            import statistics
            mean_val = statistics.mean(values)
            stddev_val = statistics.stdev(values) if len(values) > 1 else 0
            sorted_vals = sorted(values)
            n = len(sorted_vals)
            p50 = sorted_vals[int(n * 0.5)] if n > 0 else 0
            p75 = sorted_vals[int(n * 0.75)] if n > 0 else 0
            p90 = sorted_vals[int(n * 0.90)] if n > 0 else 0

            c.execute('''INSERT OR REPLACE INTO kpi_baseline_daily
                (as_of_date,scope,scope_id,rule_set_id,metric_key,window_days,
                 mean,stddev,p50,p75,p90)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
                (today, scope, scope_id, rs_id, mkey, window,
                 round(mean_val, 6), round(stddev_val, 6),
                 round(p50, 6), round(p75, 6), round(p90, 6)))

            results.append({
                "metric": mkey, "scope": scope, "scope_id": scope_id,
                "date": today, "window": window, "n": n,
                "mean": round(mean_val, 6), "stddev": round(stddev_val, 6),
                "p50": round(p50, 6), "p75": round(p75, 6), "p90": round(p90, 6),
            })

        conn.commit()
        return results
    finally:
        conn.close()


def _check_anomaly_cooldown(c, adid, scope, scope_id, cooldown_minutes):
    """COOLDOWN_GATE: check if same detector+scope has fired within cooldown window."""
    cutoff = (datetime.datetime.utcnow() - datetime.timedelta(minutes=cooldown_minutes)).strftime('%Y-%m-%dT%H:%M:%SZ')
    if scope_id is not None:
        c.execute('''SELECT COUNT(*) FROM anomaly_event
            WHERE adid=? AND scope=? AND scope_id=? AND ts >= ?''',
            (adid, scope, scope_id, cutoff))
    else:
        c.execute('''SELECT COUNT(*) FROM anomaly_event
            WHERE adid=? AND scope=? AND scope_id IS NULL AND ts >= ?''',
            (adid, scope, cutoff))
    return c.fetchone()[0] > 0


def evaluate_anomaly(scope="GLOBAL", scope_id=None):
    """
    ANOMALY_EVAL_GATE: evaluate all enabled anomaly detectors against latest baselines.
    Uses ZSCORE/PCTL/DELTA_RATE methods. Returns list of anomaly events created.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        rs = get_active_rule_set(c)
        rs_id = rs["rule_set_id"] if rs else None

        # Get enabled detectors matching scope
        c.execute('''SELECT adid,name,scope,metric_key,method,params_json,severity,cooldown_minutes
            FROM anomaly_detector
            WHERE is_enabled=1 AND (scope=? OR scope='GLOBAL')
            AND (rule_set_id IS NULL OR rule_set_id=?)''',
            (scope, rs_id))
        detectors = c.fetchall()

        events = []
        for adid, dname, dscope, mkey, method, params_raw, severity, cooldown in detectors:
            params = json.loads(params_raw)
            window = params.get("window_days", KPI_BASELINE_WINDOW_DAYS)

            # COOLDOWN_GATE: skip if recently fired
            effective_scope_id = scope_id if dscope != "GLOBAL" else None
            if _check_anomaly_cooldown(c, adid, dscope, effective_scope_id, cooldown):
                continue

            # Get baseline
            if effective_scope_id is not None:
                c.execute('''SELECT mean,stddev,p50,p75,p90 FROM kpi_baseline_daily
                    WHERE metric_key=? AND scope=? AND scope_id=? AND as_of_date=?
                    AND (rule_set_id IS NULL OR rule_set_id=?)
                    ORDER BY window_days DESC LIMIT 1''',
                    (mkey, dscope, effective_scope_id, today, rs_id))
            else:
                c.execute('''SELECT mean,stddev,p50,p75,p90 FROM kpi_baseline_daily
                    WHERE metric_key=? AND scope=? AND scope_id IS NULL AND as_of_date=?
                    AND (rule_set_id IS NULL OR rule_set_id=?)
                    ORDER BY window_days DESC LIMIT 1''',
                    (mkey, dscope, today, rs_id))
            baseline_row = c.fetchone()
            if not baseline_row:
                _log(c, "ANOMALY", "INFO", "ANOMALY_NO_BASELINE",
                     f"detector={dname} metric={mkey} scope={dscope}")
                continue

            bl_mean, bl_stddev, bl_p50, bl_p75, bl_p90 = baseline_row
            baseline_data = {"mean": bl_mean, "stddev": bl_stddev,
                             "p50": bl_p50, "p75": bl_p75, "p90": bl_p90}

            # Get current value (latest kpi_value or data_quality metric)
            current_val = None
            if mkey in ("parse_fail_rate", "audit_incomplete_rate"):
                c.execute('''SELECT parse_fail_rate FROM data_quality_daily
                    WHERE scope=? AND (scope_id IS ? OR ? IS NULL) AND as_of_date=?
                    ORDER BY created_at DESC LIMIT 1''',
                    (dscope, effective_scope_id, effective_scope_id, today))
                r = c.fetchone()
                if r:
                    current_val = r[0]
            else:
                sf = ""
                sp = []
                if dscope == "DOMAIN" and effective_scope_id:
                    sf = "AND scope='DOMAIN' AND scope_id=?"
                    sp = [str(effective_scope_id)]
                elif dscope == "SEGMENT" and effective_scope_id:
                    sf = "AND scope='SEGMENT' AND scope_id=?"
                    sp = [str(effective_scope_id)]
                else:
                    sf = "AND scope='GLOBAL'"
                c.execute(f'''SELECT value FROM kpi_value
                    WHERE key=? AND as_of_date=? {sf}
                    ORDER BY id DESC LIMIT 1''',
                    [mkey, today] + sp)
                r = c.fetchone()
                if r:
                    current_val = r[0]

            if current_val is None:
                continue

            # Evaluate based on method
            is_anomaly = False
            if method == "ZSCORE":
                z_threshold = params.get("z", 3.0)
                if bl_stddev > 0:
                    z_score = abs(current_val - bl_mean) / bl_stddev
                    is_anomaly = z_score >= z_threshold
                    baseline_data["z_score"] = round(z_score, 4)
            elif method == "PCTL":
                is_anomaly = current_val >= bl_p90
                baseline_data["above_p90"] = current_val >= bl_p90
            elif method == "DELTA_RATE":
                delta_threshold = params.get("delta", 0.05)
                delta = current_val - bl_mean
                is_anomaly = abs(delta) >= delta_threshold
                baseline_data["delta"] = round(delta, 6)

            if is_anomaly:
                msg = (f"Anomaly [{severity}] {dname}: {mkey}={round(current_val,4)} "
                       f"baseline_mean={round(bl_mean,4)} method={method}")

                c.execute('''INSERT INTO anomaly_event
                    (adid,scope,scope_id,rule_set_id,metric_key,value,
                     baseline_json,severity,message)
                    VALUES (?,?,?,?,?,?,?,?,?)''',
                    (adid, dscope, effective_scope_id, rs_id, mkey,
                     current_val, json.dumps(baseline_data, ensure_ascii=False),
                     severity, msg))
                aeid = c.lastrowid

                _log(c, "ANOMALY", severity, "ANOMALY_DETECTED", msg)

                events.append({
                    "aeid": aeid, "detector": dname, "metric": mkey,
                    "value": current_val, "severity": severity,
                    "method": method, "message": msg,
                })

        conn.commit()
        return events
    finally:
        conn.close()


def bridge_anomaly_to_alert(min_severity="WARNING"):
    """
    ANOMALY_TO_ALERT_BRIDGE: convert anomaly_events into alert_events.
    Only bridges anomalies at or above min_severity. Sets alert_event.anomaly_event_id.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        sev_order = {"INFO": 0, "WARNING": 1, "CRITICAL": 2}
        min_sev_val = sev_order.get(min_severity, 1)

        # Find unbridged anomaly events
        c.execute('''SELECT ae.aeid,ae.adid,ae.scope,ae.scope_id,ae.metric_key,
            ae.value,ae.severity,ae.message,ae.ts,ae.baseline_json
            FROM anomaly_event ae
            WHERE ae.aeid NOT IN (
                SELECT anomaly_event_id FROM alert_event WHERE anomaly_event_id IS NOT NULL
            )
            ORDER BY ae.ts DESC''')

        bridged = []
        for aeid, adid, scope, scope_id, mkey, val, sev, msg, ts, bl_json in c.fetchall():
            if sev_order.get(sev, 0) < min_sev_val:
                continue

            # Create alert_event
            c.execute('''INSERT INTO alert_event
                (rule_id,scope,domain_id,page_id,snap_id,severity,message,anomaly_event_id)
                VALUES (?,?,?,?,?,?,?,?)''',
                (None, scope,
                 scope_id if scope == "DOMAIN" else None,
                 None, None, sev,
                 f"ANOMALY_DETECTED: {msg}", aeid))
            alert_eid = c.lastrowid

            # Lineage edge: ANOMALY → ALERT
            write_lineage_edge(c, "ANOMALY", aeid, "ALERT", alert_eid,
                               "SNAPSHOT_TO_ALERT")

            _log(c, "ANOMALY_BRIDGE", "INFO", "ANOMALY_BRIDGED",
                 f"anomaly={aeid} → alert={alert_eid} severity={sev}")

            bridged.append({
                "anomaly_id": aeid, "alert_id": alert_eid,
                "severity": sev, "metric": mkey,
            })

        conn.commit()
        return bridged
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v15 network health + fingerprint + domain health
# ═══════════════════════════════════════════════════════════════════════
def check_resolver_cache(c, domain_id):
    """
    NETWORK_PRECHECK_GATE: check if domain is in cooldown.
    Returns (can_proceed:bool, cache_row:dict|None).
    """
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    c.execute('SELECT id,dns_ok,tls_ok,last_error,checked_at,cooldown_until FROM resolver_cache WHERE domain_id=?',
              (domain_id,))
    row = c.fetchone()
    if not row:
        return True, None

    cooldown_until = row[5]
    if cooldown_until and now < cooldown_until:
        return False, {"id": row[0], "dns_ok": bool(row[1]), "tls_ok": bool(row[2]),
                       "last_error": row[3], "checked_at": row[4], "cooldown_until": cooldown_until}

    return True, {"id": row[0], "dns_ok": bool(row[1]), "tls_ok": bool(row[2]),
                  "last_error": row[3], "checked_at": row[4], "cooldown_until": cooldown_until}


def update_resolver_cache(c, domain_id, dns_ok=True, tls_ok=True, last_ip=None, last_error=None):
    """Persist DNS/TLS check result. Sets cooldown if failed."""
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    cooldown = None
    if not dns_ok or not tls_ok:
        cooldown = (datetime.datetime.utcnow() + datetime.timedelta(minutes=RESOLVER_COOLDOWN_MINUTES)).strftime('%Y-%m-%dT%H:%M:%SZ')
        # Mark domain as DEGRADED
        c.execute("UPDATE domain SET health_tier='DEGRADED',health_note=? WHERE domain_id=?",
                  (last_error or "DNS/TLS failure", domain_id))

    ip_json = json.dumps(last_ip, ensure_ascii=False) if last_ip else None
    c.execute('''INSERT INTO resolver_cache (domain_id,dns_ok,tls_ok,last_ip_json,last_error,checked_at,cooldown_until)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(domain_id) DO UPDATE SET
        dns_ok=excluded.dns_ok,tls_ok=excluded.tls_ok,last_ip_json=excluded.last_ip_json,
        last_error=excluded.last_error,checked_at=excluded.checked_at,cooldown_until=excluded.cooldown_until''',
        (domain_id, int(dns_ok), int(tls_ok), ip_json, last_error, now, cooldown))


def extract_http_fingerprint(c, domain_id, headers):
    """
    FINGERPRINT_GATE: extract and persist HTTP header fingerprint.
    Returns fingerprint sha256.
    """
    if not headers:
        return None

    h_lower = {k.lower(): v for k, v in headers.items()} if isinstance(headers, dict) else {}
    server = h_lower.get("server", "")
    powered = h_lower.get("x-powered-by", "")
    cdn = h_lower.get("x-cdn", h_lower.get("cf-ray", h_lower.get("x-cache", "")))
    cache_ctrl = h_lower.get("cache-control", "")
    vary = h_lower.get("vary", "")
    etag = 1 if "etag" in h_lower else 0
    hsts = 1 if "strict-transport-security" in h_lower else 0

    # Compute fingerprint hash over normalized header subset
    fp_str = f"{server}|{powered}|{cdn}|{cache_ctrl}|{vary}|{etag}|{hsts}"
    fp_sha = hashlib.sha256(fp_str.encode()).hexdigest()

    c.execute('''INSERT OR IGNORE INTO http_fingerprint
        (domain_id,sha256,server,powered_by,cdn_hint,cache_control,vary,etag_present,hsts_present)
        VALUES (?,?,?,?,?,?,?,?,?)''',
        (domain_id, fp_sha, server or None, powered or None, cdn or None,
         cache_ctrl or None, vary or None, etag, hsts))

    return fp_sha


def compute_domain_health_daily(domain_id=None):
    """
    DOMAIN_HEALTH_DAILY_GATE: compute daily health metrics per domain.
    Updates domain.health_tier based on thresholds.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        rs = get_active_rule_set(c)
        rs_id = rs["rule_set_id"] if rs else None

        # Get domains to process
        if domain_id:
            c.execute('SELECT domain_id,domain FROM domain WHERE domain_id=?', (domain_id,))
        else:
            c.execute('SELECT domain_id,domain FROM domain')
        domains = c.fetchall()

        results = []
        for did, dname in domains:
            # Fetch success rate from snapshots today
            c.execute('''SELECT COUNT(*) FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                WHERE p.domain_id=? AND ps.fetched_at LIKE ?''', (did, f"{today}%"))
            total = c.fetchone()[0]
            if total == 0:
                continue

            c.execute('''SELECT COUNT(*) FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                WHERE p.domain_id=? AND ps.fetched_at LIKE ?
                AND ps.http_status_family IN ('2xx','3xx')''', (did, f"{today}%"))
            success = c.fetchone()[0]

            c.execute('''SELECT COUNT(*) FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                WHERE p.domain_id=? AND ps.fetched_at LIKE ?
                AND ps.http_status_family='3xx' ''', (did, f"{today}%"))
            http_304 = c.fetchone()[0]

            c.execute('''SELECT AVG(ps.fetch_ms) FROM page_snapshot ps
                JOIN page p ON ps.page_id=p.page_id
                WHERE p.domain_id=? AND ps.fetched_at LIKE ? AND ps.fetch_ms IS NOT NULL''',
                (did, f"{today}%"))
            avg_ms_row = c.fetchone()
            avg_ms = avg_ms_row[0] if avg_ms_row and avg_ms_row[0] else 0

            # DNS/TLS rates from resolver_cache
            c.execute('SELECT dns_ok,tls_ok FROM resolver_cache WHERE domain_id=?', (did,))
            rc = c.fetchone()
            dns_rate = 1.0 if (not rc or rc[0]) else 0.0
            tls_rate = 1.0 if (not rc or rc[1]) else 0.0

            fsr = round(success / total, 4) if total > 0 else 1.0
            r304 = round(http_304 / total, 4) if total > 0 else 0

            c.execute('''INSERT OR REPLACE INTO domain_health_daily
                (domain_id,as_of_date,rule_set_id,dns_ok_rate,tls_ok_rate,
                 fetch_success_rate,http_304_ratio,avg_fetch_ms)
                VALUES (?,?,?,?,?,?,?,?)''',
                (did, today, rs_id, dns_rate, tls_rate, fsr, r304, round(avg_ms, 2)))

            # Determine health tier
            thresholds = HEALTH_THRESHOLDS
            health_tier = "GOOD"
            health_note = None

            if (fsr < thresholds["BAD"]["fetch_success_rate_lt"] or
                tls_rate < thresholds["BAD"]["tls_ok_rate_lt"]):
                health_tier = "BAD"
                health_note = f"fsr={fsr} tls={tls_rate}"
            elif (fsr < thresholds["DEGRADED"]["fetch_success_rate_lt"] or
                  avg_ms > thresholds["DEGRADED"]["avg_fetch_ms_gt"]):
                health_tier = "DEGRADED"
                health_note = f"fsr={fsr} avg_ms={round(avg_ms,0)}"

            c.execute('UPDATE domain SET health_tier=?,health_note=? WHERE domain_id=?',
                      (health_tier, health_note, did))

            results.append({
                "domain_id": did, "domain": dname, "date": today,
                "health_tier": health_tier, "fsr": fsr, "r304": r304,
                "avg_ms": round(avg_ms, 2), "dns": dns_rate, "tls": tls_rate,
            })

        conn.commit()
        return results
    finally:
        conn.close()


def check_health_alerts():
    """
    HEALTH_ALERT_GATE: fire alerts for domains with BAD health or sustained DEGRADED.
    Creates alert_event + fix_ticket for BAD domains.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        yesterday = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')

        alerts = []

        # BAD domains: immediate alert
        c.execute('''SELECT d.domain_id,d.domain,d.health_tier,d.health_note
            FROM domain d WHERE d.health_tier='BAD' ''')
        for did, dname, tier, note in c.fetchall():
            msg = f"Domain health BAD: {dname} — {note or 'fetch/TLS failure'}"

            c.execute('''INSERT INTO alert_event (scope,domain_id,severity,message)
                VALUES ('DOMAIN',?,?,?)''', (did, "CRITICAL", msg))
            alert_eid = c.lastrowid

            # Auto-create ticket
            c.execute('''INSERT INTO fix_ticket (source,severity,title,description_json,owner)
                VALUES ('ALERT','CRITICAL',?,?,?)''',
                (f"Domain health BAD: {dname}",
                 json.dumps({"domain_id": did, "tier": tier, "note": note}, ensure_ascii=False),
                 "SYSTEM"))
            tid = c.lastrowid
            c.execute('''INSERT OR IGNORE INTO ticket_link (ticket_id,kind,ref_id)
                VALUES (?,'ALERT',?)''', (tid, alert_eid))

            _log(c, "HEALTH_ALERT", "CRITICAL", "DOMAIN_HEALTH_BAD",
                 msg, domain_id=did)

            alerts.append({"domain_id": did, "domain": dname, "tier": "BAD",
                           "alert_id": alert_eid, "ticket_id": tid})

        # DEGRADED for 2+ days: sustained alert
        c.execute('''SELECT d.domain_id,d.domain,d.health_note
            FROM domain d
            WHERE d.health_tier='DEGRADED'
            AND d.domain_id IN (
                SELECT domain_id FROM domain_health_daily
                WHERE as_of_date=? AND fetch_success_rate < 0.95
            )
            AND d.domain_id IN (
                SELECT domain_id FROM domain_health_daily
                WHERE as_of_date=? AND fetch_success_rate < 0.95
            )''', (today, yesterday))
        for did, dname, note in c.fetchall():
            msg = f"Domain sustained DEGRADED (2d): {dname} — {note or 'slow/partial'}"
            c.execute('''INSERT INTO alert_event (scope,domain_id,severity,message)
                VALUES ('DOMAIN',?,?,?)''', (did, "WARNING", msg))

            _log(c, "HEALTH_ALERT", "WARNING", "DOMAIN_HEALTH_DEGRADED",
                 msg, domain_id=did)

            alerts.append({"domain_id": did, "domain": dname, "tier": "DEGRADED",
                           "alert_id": c.lastrowid})

        conn.commit()
        return alerts
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v11 pair_fixed + coverage + safe_intent
# ═══════════════════════════════════════════════════════════════════════
def add_pair_fixed_page(pair_id, intent_flag, url):
    """Register a fixed page for a comparison pair at a given intent."""
    conn = get_conn()
    try:
        c = conn.cursor()
        un = normalize_url(url)
        prio = PRIORITY_MODEL["boosts"].get("PAIR_FIXED", 100)
        c.execute('INSERT OR IGNORE INTO pair_fixed_page (pair_id,intent_flag,url_norm,priority) VALUES (?,?,?,?)',
                  (pair_id, intent_flag, un, prio))
        conn.commit()
        return c.lastrowid
    finally:
        conn.close()


def enqueue_pair_fixed_pages(pair_id, job_id=None):
    """
    PAIR_FIXED_ENQUEUE_GATE: enqueue all fixed pages for a pair into frontier
    with high priority and PAIR_FIXED source link.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT id,intent_flag,url_norm,priority FROM pair_fixed_page WHERE pair_id=?', (pair_id,))
        fixed = c.fetchall()
        if not fixed:
            _log(c, "PAIR_FIXED", "WARN", "FIX_PAIR_PAGES_MISSING",
                 f"pair={pair_id} has no fixed pages")
            # Fallback: use domain root as HOME
            c.execute('SELECT left_domain_id,right_domain_id FROM comparison_pair WHERE pid=?', (pair_id,))
            pr = c.fetchone()
            if pr:
                for did in [pr[0], pr[1]]:
                    if did:
                        c.execute('SELECT domain FROM domain WHERE domain_id=?', (did,))
                        dr = c.fetchone()
                        if dr:
                            root_url = f"https://{dr[0]}/"
                            c.execute('INSERT OR IGNORE INTO pair_fixed_page (pair_id,intent_flag,url_norm,priority) VALUES (?,?,?,?)',
                                      (pair_id, 'HOME', normalize_url(root_url), 100))
            conn.commit()
            c.execute('SELECT id,intent_flag,url_norm,priority FROM pair_fixed_page WHERE pair_id=?', (pair_id,))
            fixed = c.fetchall()

        # Get PAIR_FIXED ingest source
        c.execute("SELECT sid FROM ingest_source WHERE kind='PAIR_FIXED' LIMIT 1")
        src = c.fetchone()
        source_sid = src[0] if src else None

        enqueued = 0
        for pfid, intent, url_n, prio in fixed:
            # SAFE_INTENT_DEPTH_GATE: restrict LOGIN/SIGNUP depth
            depth = 0 if intent in AUTH_SURFACE_INTENTS else 1
            c.execute('''INSERT OR IGNORE INTO crawl_frontier
                (url,url_norm,priority,depth,source,intent_hint,source_sid_primary)
                VALUES (?,?,?,?,?,?,?)''',
                (url_n, url_n, prio, depth, 'PAIR_FIXED', intent, source_sid))
            if c.rowcount > 0:
                fid = c.lastrowid
                if source_sid:
                    c.execute('INSERT OR IGNORE INTO frontier_source_link (fid,sid) VALUES (?,?)',
                              (fid, source_sid))
                enqueued += 1

        conn.commit()
        return enqueued
    finally:
        conn.close()


def compute_coverage_matrix(scope="DOMAIN", scope_id=None, rule_set_id=None):
    """
    INTENT_COVERAGE_GATE: compute coverage for a domain/segment/pair.
    Persists to coverage_matrix table.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')

        if not rule_set_id:
            rs = get_active_rule_set(c)
            rule_set_id = rs["rule_set_id"] if rs else None

        if scope == "DOMAIN" and scope_id:
            for intent in PAGE_INTENT_FLAGS:
                c.execute('''SELECT COUNT(*), SUM(CASE WHEN p.is_representative=1 THEN 1 ELSE 0 END)
                    FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
                    WHERE p.domain_id=? AND ps.intent_flags_json LIKE ?
                    AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                    (scope_id, f'%"{intent}"%'))
                row = c.fetchone()
                seen, rep_seen = row[0] or 0, row[1] or 0
                cov = 1.0 if seen > 0 else 0.0
                c.execute('''INSERT OR REPLACE INTO coverage_matrix
                    (scope,scope_id,intent_flag,rule_set_id,as_of_date,pages_seen,rep_pages_seen,coverage_pct)
                    VALUES (?,?,?,?,?,?,?,?)''',
                    ("DOMAIN", scope_id, intent, rule_set_id, today, seen, rep_seen, cov))

        elif scope == "PAIR" and scope_id:
            c.execute('SELECT left_domain_id,right_domain_id FROM comparison_pair WHERE pid=?', (scope_id,))
            pair = c.fetchone()
            if pair:
                for intent in PAIR_FIXED_INTENTS:
                    both_have = True
                    for did in [pair[0], pair[1]]:
                        if did:
                            c.execute('''SELECT COUNT(*) FROM page_snapshot ps JOIN page p ON ps.page_id=p.page_id
                                WHERE p.domain_id=? AND ps.intent_flags_json LIKE ?
                                AND ps.snap_id=(SELECT MAX(s2.snap_id) FROM page_snapshot s2 WHERE s2.page_id=ps.page_id)''',
                                (did, f'%"{intent}"%'))
                            if c.fetchone()[0] == 0:
                                both_have = False
                    cov = 1.0 if both_have else 0.0
                    c.execute('''INSERT OR REPLACE INTO coverage_matrix
                        (scope,scope_id,intent_flag,rule_set_id,as_of_date,pages_seen,rep_pages_seen,coverage_pct)
                        VALUES (?,?,?,?,?,?,?,?)''',
                        ("PAIR", scope_id, intent, rule_set_id, today, 1 if both_have else 0, 0, cov))

        conn.commit()
    finally:
        conn.close()


def check_coverage_gaps(scope="DOMAIN", scope_id=None, job_id=None):
    """
    COVERAGE_GAP_ALERT_GATE: fire alerts + tickets for coverage gaps.
    Only checks HOME, PRICING, DOCS intents.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        today = datetime.datetime.utcnow().strftime('%Y-%m-%d')
        rs = get_active_rule_set(c)
        rs_id = rs["rule_set_id"] if rs else None

        if scope == "DOMAIN" and scope_id:
            min_pct = COVERAGE_MIN_DOMAIN_PCT
        elif scope == "PAIR" and scope_id:
            min_pct = COVERAGE_MIN_PAIR_PCT
        else:
            return 0

        gaps = 0
        for intent in COVERAGE_REQUIRED_INTENTS:
            c.execute('''SELECT coverage_pct FROM coverage_matrix
                WHERE scope=? AND scope_id=? AND intent_flag=? AND as_of_date=?
                ORDER BY id DESC LIMIT 1''',
                (scope, scope_id, intent, today))
            row = c.fetchone()
            cov = row[0] if row else 0.0
            if cov < min_pct:
                # Fire alert
                c.execute('''INSERT INTO alert_event (scope,severity,message,snap_id,page_id,domain_id,cluster_id,job_id)
                    VALUES (?,?,?,?,?,?,?,?)''',
                    (scope, 'WARNING', f'COVERAGE_GAP: {scope}={scope_id} intent={intent} coverage={cov}',
                     None, None, scope_id if scope == "DOMAIN" else None, None, job_id))
                aid = c.lastrowid
                # Create ticket
                c.execute('''INSERT INTO fix_ticket (source,domain_id,issue_code,rule_set_id,severity)
                    VALUES (?,?,?,?,?)''',
                    ('ALERT', scope_id if scope == "DOMAIN" else None,
                     f'COVERAGE_GAP_{intent}', rs_id, 'WARNING'))
                tid = c.lastrowid
                c.execute('INSERT OR IGNORE INTO ticket_link (tid,kind,ref_id) VALUES (?,?,?)',
                          (tid, 'ALERT', aid))
                c.execute('UPDATE alert_event SET ticket_id=? WHERE aid=?', (tid, aid))
                gaps += 1

        conn.commit()
        return gaps
    finally:
        conn.close()


def check_safe_intent_depth(intent_primary, url):
    """
    SAFE_INTENT_DEPTH_GATE: restrict LOGIN/SIGNUP pages.
    Returns (max_depth, max_pages, restricted:bool).
    """
    if intent_primary in AUTH_SURFACE_INTENTS:
        return 0, 1, True
    return None, None, False


def rotate_rule_set(new_name, version=None, scoring=None, taxonomy=None, penalties=None, notes=None,
                    release_gate_id=None):
    """
    Rotate to a new golden_rule.
    v10: ONE_SWITCH_GATE — only one active rule_set at a time.
    If release_gate_id provided, links it; otherwise creates rule_set as inactive (pending replay).
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

        # ── ONE_SWITCH_GATE (v10) ── verify no split-brain
        c.execute("SELECT COUNT(*) FROM golden_rule WHERE is_active=1")
        active_count = c.fetchone()[0]
        if active_count > 1:
            _log(c, "RELEASE", "ERROR", "RULE_SET_SPLIT_BRAIN",
                 f"multiple active rule_sets detected: {active_count}")
            conn.commit()
            raise ValueError(f"RULE_SET_SPLIT_BRAIN: {active_count} active rule_sets")

        # Determine if we should activate immediately (has release_gate PASS) or create as inactive
        activate = False
        if release_gate_id:
            c.execute('SELECT status FROM release_gate WHERE gid=?', (release_gate_id,))
            rg = c.fetchone()
            if rg and rg[0] == 'PASS':
                activate = True
            else:
                _log(c, "RELEASE", "WARN", "RELEASE_GATE_NOT_PASS",
                     f"gate={release_gate_id} status={rg[0] if rg else 'NOT_FOUND'}")

        if activate:
            # Freeze all currently active
            c.execute("UPDATE golden_rule SET is_active=0,frozen_at=? WHERE is_active=1", (now,))

        c.execute('''INSERT INTO golden_rule (name,version,scoring_json,issue_taxonomy_json,penalties_json,is_active,notes,release_gate_id)
                     VALUES (?,?,?,?,?,?,?,?)''',
                  (new_name, version or 1,
                   json.dumps(scoring or SCORING, ensure_ascii=False),
                   json.dumps(taxonomy or ISSUE_TAXONOMY, ensure_ascii=False),
                   json.dumps(penalties or SCORING["penalties"], ensure_ascii=False),
                   1 if activate else 0, notes, release_gate_id))
        new_id = c.lastrowid
        conn.commit()
        return new_id
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v10 replay + release gate
# ═══════════════════════════════════════════════════════════════════════
def create_replay_plan(from_rule_set_id, to_rule_set_id, name=None,
                       segment_id=None, sample_size=None):
    """Create a replay plan for regression testing between two rule sets."""
    conn = get_conn()
    try:
        c = conn.cursor()
        ss = sample_size or REPLAY_DEFAULT_SAMPLE
        plan_name = name or f"replay_{from_rule_set_id}_to_{to_rule_set_id}"
        c.execute('''INSERT INTO replay_plan (name,from_rule_set_id,to_rule_set_id,segment_id,sample_size)
                     VALUES (?,?,?,?,?)''',
                  (plan_name, from_rule_set_id, to_rule_set_id, segment_id, ss))
        rid = c.lastrowid
        conn.commit()
        return rid
    finally:
        conn.close()


def populate_replay_items(rid):
    """
    REPLAY_SAMPLE_GATE: select fixed sample of snapshots with stored HTML artifacts.
    Prefers representative pages; filters by segment if specified.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT from_rule_set_id,segment_id,sample_size FROM replay_plan WHERE rid=?', (rid,))
        plan = c.fetchone()
        if not plan:
            raise ValueError(f"replay_plan {rid} not found")
        from_rs, seg_id, sample_size = plan

        # Build query: snapshots that have HTML artifacts stored
        query = '''SELECT DISTINCT ps.snap_id, sa.artifact_sha256
            FROM page_snapshot ps
            JOIN snapshot_artifact sa ON ps.snap_id=sa.snap_id
            JOIN artifact_store ast ON sa.artifact_id=ast.artifact_id
            JOIN page p ON ps.page_id=p.page_id
            JOIN snapshot_rule_binding srb ON ps.snap_id=srb.snap_id
            WHERE srb.rule_set_id=? AND ast.artifact_type='HTML' AND ast.stored_bytes=1'''
        params = [from_rs]

        if seg_id:
            query += ' AND p.domain_id IN (SELECT domain_id FROM domain_segment WHERE segment_id=?)'
            params.append(seg_id)

        # Prefer representative pages first, then random
        query += ' ORDER BY p.is_representative DESC, RANDOM() LIMIT ?'
        params.append(sample_size)

        c.execute(query, params)
        rows = c.fetchall()

        added = 0
        for snap_id, html_sha in rows:
            c.execute('INSERT OR IGNORE INTO replay_item (rid,snap_id,html_sha256) VALUES (?,?,?)',
                      (rid, snap_id, html_sha))
            if c.rowcount > 0:
                added += 1

        # Check minimum sample
        if added < REPLAY_MIN_SAMPLE:
            _log(c, "REPLAY", "WARN", "REPLAY_SAMPLE_SHORT",
                 f"rid={rid} got={added} min={REPLAY_MIN_SAMPLE}")
            if added == 0:
                c.execute("UPDATE replay_plan SET status='FAILED' WHERE rid=?", (rid,))
                conn.commit()
                return 0

        conn.commit()
        return added
    finally:
        conn.close()


def execute_replay(rid):
    """
    REPLAY_EXEC_GATE: offline replay — no network, only re-audit stored HTML
    with the to_rule_set scoring/taxonomy.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT to_rule_set_id,status FROM replay_plan WHERE rid=?', (rid,))
        plan = c.fetchone()
        if not plan:
            raise ValueError(f"replay_plan {rid} not found")
        to_rs_id, plan_status = plan
        if plan_status == 'FAILED':
            return {"status": "FAILED", "reason": "plan already failed"}

        c.execute("UPDATE replay_plan SET status='RUNNING' WHERE rid=?", (rid,))

        # Load target rule_set scoring + taxonomy
        c.execute('SELECT scoring_json,issue_taxonomy_json,penalties_json FROM golden_rule WHERE rule_set_id=?',
                  (to_rs_id,))
        rs_row = c.fetchone()
        if not rs_row:
            c.execute("UPDATE replay_plan SET status='FAILED' WHERE rid=?", (rid,))
            conn.commit()
            return {"status": "FAILED", "reason": f"rule_set {to_rs_id} not found"}
        to_scoring = json.loads(rs_row[0])
        to_taxonomy = json.loads(rs_row[1])
        to_penalties = json.loads(rs_row[2])

        # Get items
        c.execute('SELECT id,snap_id,html_sha256 FROM replay_item WHERE rid=? AND status=?',
                  (rid, 'PENDING'))
        items = c.fetchall()

        done = 0
        failed = 0
        for item_id, snap_id, html_sha in items:
            # Get original snapshot data for comparison
            c.execute('''SELECT ps.issues_sha256,ps.score_total,ps.title,ps.meta_description,
                ps.h1,ps.h1_count,ps.canonical,ps.robots_meta,ps.lang,ps.jsonld_count
                FROM page_snapshot ps WHERE ps.snap_id=?''', (snap_id,))
            orig = c.fetchone()
            if not orig:
                c.execute("UPDATE replay_item SET status='FAILED' WHERE id=?", (item_id,))
                failed += 1
                continue

            orig_sha, orig_score = orig[0], orig[1]
            title, meta, h1, h1c, can, rob, lang, jc = orig[2], orig[3], orig[4], orig[5], orig[6], orig[7], orig[8], orig[9]

            # Re-audit with new taxonomy
            new_issues = []
            for code, severity, family, penalty, message in to_taxonomy:
                if code == "TITLE_MISSING" and not title: new_issues.append(code)
                elif code == "TITLE_TOO_SHORT" and title and len(title) < 15: new_issues.append(code)
                elif code == "NO_H1" and h1c == 0: new_issues.append(code)
                elif code == "MULTI_H1" and h1c and h1c > 1: new_issues.append(code)
                elif code == "NO_META_DESCRIPTION" and (not meta or not meta.strip()): new_issues.append(code)
                elif code == "CANONICAL_MISSING" and not can: new_issues.append(code)
                elif code == "JSONLD_MISSING" and (jc is None or jc == 0): new_issues.append(code)
                elif code == "LANG_MISSING" and not lang: new_issues.append(code)
                elif code == "ROBOTS_NOINDEX" and rob and "noindex" in rob.lower(): new_issues.append(code)

            new_issues.sort()
            new_sha = compute_issues_sha256(new_issues)

            # Compute new score with target penalties
            new_score = to_scoring.get("base", 100)
            for iss in new_issues:
                pen = to_penalties.get(iss, 0)
                new_score -= pen
            new_score = max(to_scoring.get("floor", 0), min(to_scoring.get("ceiling", 100), new_score))

            # Diff
            orig_issues_list = []
            c.execute('''SELECT i.code FROM page_issue pi JOIN issue i ON pi.issue_id=i.issue_id
                WHERE pi.snap_id=?''', (snap_id,))
            orig_issues_list = sorted([r[0] for r in c.fetchall()])

            added = sorted(set(new_issues) - set(orig_issues_list))
            removed = sorted(set(orig_issues_list) - set(new_issues))
            s_delta = new_score - (orig_score or 0)

            c.execute('''INSERT OR REPLACE INTO replay_result
                (rid,snap_id,to_rule_set_id,issues_sha256_new,score_total_new,
                 issue_added_json,issue_removed_json,score_delta)
                VALUES (?,?,?,?,?,?,?,?)''',
                (rid, snap_id, to_rs_id, new_sha, new_score,
                 json.dumps(added), json.dumps(removed), s_delta))

            c.execute("UPDATE replay_item SET status='DONE' WHERE id=?", (item_id,))

            # Cost accounting for replay audit
            c.execute('SELECT job_id FROM page_snapshot WHERE snap_id=?', (snap_id,))
            jrow = c.fetchone()
            if jrow and jrow[0]:
                record_cost(c, jrow[0], "AUDIT", len(new_issues) * 10,
                            meta={"replay_rid": rid, "replay": True})

            done += 1

        now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        final_status = 'DONE' if failed == 0 else ('FAILED' if done == 0 else 'DONE')
        c.execute("UPDATE replay_plan SET status=?,finished_at=? WHERE rid=?",
                  (final_status, now, rid))
        conn.commit()
        return {"status": final_status, "done": done, "failed": failed}
    finally:
        conn.close()


def compute_replay_stats(rid):
    """
    REPLAY_STATS_GATE: aggregate replay results into release evidence.
    Returns stats dict suitable for release_gate evidence_json.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT COUNT(*) FROM replay_result WHERE rid=?', (rid,))
        total = c.fetchone()[0]
        if total == 0:
            return {"error": "no replay results"}

        # Non-determinism rate: items where issues_sha256 changed but score same
        # (proxy: count items where score_delta != 0)
        c.execute('SELECT COUNT(*) FROM replay_result WHERE rid=? AND score_delta=0 AND issues_sha256_new IS NOT NULL', (rid,))
        identical = c.fetchone()[0]
        non_det_rate = round(1.0 - (identical / total), 4) if total > 0 else 0

        # New CRITICAL rate: % of items with added CRITICAL issues
        c.execute("SELECT issue_added_json FROM replay_result WHERE rid=?", (rid,))
        new_crit_count = 0
        for (added_json,) in c.fetchall():
            added = json.loads(added_json)
            crit_codes = {cd for cd, sev, *_ in ISSUE_TAXONOMY if sev == "CRITICAL"}
            if any(a in crit_codes for a in added):
                new_crit_count += 1
        new_crit_rate = round(new_crit_count / total, 4) if total > 0 else 0

        # Score P50 shift
        c.execute('SELECT score_delta FROM replay_result WHERE rid=? ORDER BY score_delta', (rid,))
        deltas = [r[0] for r in c.fetchall()]
        p50_idx = len(deltas) // 2
        score_p50_shift = deltas[p50_idx] if deltas else 0

        # Top added/removed codes
        add_counts = {}
        remove_counts = {}
        c.execute("SELECT issue_added_json,issue_removed_json FROM replay_result WHERE rid=?", (rid,))
        for added_j, removed_j in c.fetchall():
            for code in json.loads(added_j):
                add_counts[code] = add_counts.get(code, 0) + 1
            for code in json.loads(removed_j):
                remove_counts[code] = remove_counts.get(code, 0) + 1
        top_added = sorted(add_counts.items(), key=lambda x: -x[1])[:5]
        top_removed = sorted(remove_counts.items(), key=lambda x: -x[1])[:5]

        stats = {
            "total_items": total,
            "identical_items": identical,
            "non_determinism_rate": non_det_rate,
            "new_critical_rate_increase": new_crit_rate,
            "score_p50_shift": score_p50_shift,
            "top_added_codes": top_added,
            "top_removed_codes": top_removed,
        }
        return stats
    finally:
        conn.close()


def evaluate_release_gate(rid, criteria=None):
    """
    RELEASE_GATE_EVAL: Pass/Fail judgment for rule_set upgrade.
    Returns (gid, status).
    """
    criteria = criteria or RELEASE_CRITERIA_TEMPLATE
    stats = compute_replay_stats(rid)
    if "error" in stats:
        return None, "FAIL"

    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('SELECT from_rule_set_id,to_rule_set_id FROM replay_plan WHERE rid=?', (rid,))
        plan = c.fetchone()
        if not plan:
            return None, "FAIL"
        from_rs, to_rs = plan

        # Evaluate criteria
        passed = True
        if stats["non_determinism_rate"] > criteria["non_determinism_rate_max"]:
            passed = False
        if stats["new_critical_rate_increase"] > criteria["new_critical_rate_increase_max"]:
            passed = False
        shift_range = criteria["score_p50_shift_range"]
        if not (shift_range[0] <= stats["score_p50_shift"] <= shift_range[1]):
            passed = False

        # QA review check (from qa_sample table)
        c.execute('''SELECT COUNT(*) FROM qa_sample WHERE status='REVIEWED' ''')
        reviewed = c.fetchone()[0]
        c.execute('''SELECT COUNT(*) FROM qa_sample WHERE status='REJECTED' ''')
        rejected = c.fetchone()[0]
        if reviewed < criteria["qa_review_min"]:
            passed = False
        if reviewed > 0 and (rejected / reviewed) > criteria["qa_reject_rate_max"]:
            passed = False

        stats["qa_reviewed"] = reviewed
        stats["qa_rejected"] = rejected

        now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        status = "PASS" if passed else "FAIL"

        c.execute('''INSERT INTO release_gate (kind,from_version,to_version,criteria_json,status,evidence_json,decided_at)
                     VALUES (?,?,?,?,?,?,?)''',
                  ('RULE_SET', str(from_rs), str(to_rs),
                   json.dumps(criteria, ensure_ascii=False),
                   status, json.dumps(stats, ensure_ascii=False), now))
        gid = c.lastrowid

        # Link gate to target rule_set
        c.execute('UPDATE golden_rule SET release_gate_id=? WHERE rule_set_id=?', (gid, to_rs))

        if status == "PASS":
            _log(c, "RELEASE", "INFO", "RELEASE_GATE_PASS",
                 f"rid={rid} from={from_rs} to={to_rs} gid={gid}")
        else:
            _log(c, "RELEASE", "WARN", "RELEASE_GATE_FAIL",
                 f"rid={rid} from={from_rs} to={to_rs} gid={gid} stats={json.dumps(stats)}")

        conn.commit()
        return gid, status
    finally:
        conn.close()


def activate_rule_set_via_gate(to_rule_set_id, release_gate_id):
    """
    ONE_SWITCH_GATE: activate a rule_set only if release_gate is PASS.
    Single atomic switch — freeze old, activate new.
    """
    conn = get_conn()
    try:
        c = conn.cursor()
        # Verify gate is PASS
        c.execute('SELECT status FROM release_gate WHERE gid=?', (release_gate_id,))
        rg = c.fetchone()
        if not rg or rg[0] != 'PASS':
            _log(c, "RELEASE", "ERROR", "RULE_SET_SPLIT_BRAIN",
                 f"attempted activate rs={to_rule_set_id} but gate={release_gate_id} status={rg[0] if rg else 'NOT_FOUND'}")
            conn.commit()
            return False

        # ONE_SWITCH: verify exactly one active currently
        c.execute("SELECT COUNT(*) FROM golden_rule WHERE is_active=1")
        active_count = c.fetchone()[0]
        if active_count > 1:
            _log(c, "RELEASE", "ERROR", "RULE_SET_SPLIT_BRAIN",
                 f"multiple active rule_sets: {active_count}")
            conn.commit()
            return False

        now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        # Freeze all active
        c.execute("UPDATE golden_rule SET is_active=0,frozen_at=? WHERE is_active=1", (now,))
        # Activate target
        c.execute("UPDATE golden_rule SET is_active=1,release_gate_id=? WHERE rule_set_id=?",
                  (release_gate_id, to_rule_set_id))

        _log(c, "RELEASE", "INFO", "RULE_SET_SWITCHED",
             f"activated rs={to_rule_set_id} via gate={release_gate_id}")
        conn.commit()
        return True
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v8 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_policy_audit(limit=20):
    """Policy audit: all policy bindings with their policy versions."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT pb.id,pb.kind,pb.ref_id,pb.bound_at,
            p.key,p.version,p.is_active
            FROM policy_binding pb
            JOIN policy p ON pb.policy_id=p.policy_id
            ORDER BY pb.bound_at DESC LIMIT ?''', (limit,))
        return [{"id":r[0],"kind":r[1],"ref_id":r[2],"bound_at":r[3],
                 "policy_key":r[4],"policy_version":r[5],
                 "policy_active":bool(r[6])} for r in c.fetchall()]
    finally:
        conn.close()


def query_public_exports(limit=20):
    """Public exports: all exports using PUBLIC view with artifact hashes."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT ej.export_id,ej.export_type,ej.output_path,ej.row_count,
            ej.artifact_sha256,ej.public_artifact_sha256,ej.redaction_applied,
            ej.created_at,ev.name as view_name
            FROM export_job ej
            LEFT JOIN export_view ev ON ej.view_id=ev.view_id
            WHERE ev.name='PUBLIC' OR ej.public_artifact_sha256 IS NOT NULL
            ORDER BY ej.created_at DESC LIMIT ?''', (limit,))
        return [{"export_id":r[0],"type":r[1],"path":r[2],"rows":r[3],
                 "sha256":r[4],"public_sha256":r[5],"redacted":bool(r[6]),
                 "created_at":r[7],"view":r[8]} for r in c.fetchall()]
    finally:
        conn.close()


def query_export_violations(limit=20):
    """Export violations: exports missing policy binding or with no view assignment."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT ej.export_id,ej.export_type,ej.output_path,ej.row_count,
            ej.created_at,ej.view_id,
            (SELECT pb.policy_id FROM policy_binding pb WHERE pb.kind='EXPORT' AND pb.ref_id=ej.export_id) as bound_policy
            FROM export_job ej
            WHERE ej.view_id IS NULL
               OR NOT EXISTS (SELECT 1 FROM policy_binding pb WHERE pb.kind='EXPORT' AND pb.ref_id=ej.export_id)
            ORDER BY ej.created_at DESC LIMIT ?''', (limit,))
        return [{"export_id":r[0],"type":r[1],"path":r[2],"rows":r[3],
                 "created_at":r[4],"view_id":r[5],"bound_policy":r[6],
                 "violation": "NO_VIEW" if r[5] is None else "NO_POLICY"} for r in c.fetchall()]
    finally:
        conn.close()


def query_redaction_coverage():
    """Redaction coverage: all active redaction rules with match statistics."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT rr.rid,rr.name,rr.pattern,rr.action,rr.scope,rr.is_enabled,rr.created_at,
            (SELECT COUNT(*) FROM export_job ej WHERE ej.redaction_applied=1) as exports_redacted
            FROM redaction_rule rr
            ORDER BY rr.is_enabled DESC, rr.rid''')
        return [{"rid":r[0],"name":r[1],"pattern":r[2],"action":r[3],
                 "scope":r[4],"enabled":bool(r[5]),"created_at":r[6],
                 "exports_redacted":r[7]} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v9 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_job_cost_breakdown(job_id=None, limit=20):
    """Job cost breakdown by stage (sum cost_total group by stage)."""
    conn = get_conn()
    try:
        c = conn.cursor()
        if job_id:
            c.execute('''SELECT cl.stage, COUNT(*) as entries, SUM(cl.units) as total_units,
                cl.unit_type, SUM(cl.cost_total) as total_cost, cl.currency
                FROM cost_ledger cl WHERE cl.job_id=?
                GROUP BY cl.stage ORDER BY total_cost DESC''', (job_id,))
        else:
            c.execute('''SELECT cl.stage, COUNT(*) as entries, SUM(cl.units) as total_units,
                cl.unit_type, SUM(cl.cost_total) as total_cost, cl.currency
                FROM cost_ledger cl
                GROUP BY cl.stage ORDER BY total_cost DESC LIMIT ?''', (limit,))
        return [{"stage":r[0],"entries":r[1],"total_units":round(r[2],2),
                 "unit_type":r[3],"total_cost":round(r[4],8),"currency":r[5]} for r in c.fetchall()]
    finally:
        conn.close()


def query_expensive_domains(days=30, limit=20):
    """Top expensive domains (avg cost per snapshot last 30d)."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT d.domain, d.cost_tier, COUNT(DISTINCT cl.snap_id) as snapshots,
            SUM(cl.cost_total) as total_cost,
            CASE WHEN COUNT(DISTINCT cl.snap_id)>0
                 THEN SUM(cl.cost_total)/COUNT(DISTINCT cl.snap_id) ELSE 0 END as avg_per_snap
            FROM cost_ledger cl
            JOIN domain d ON cl.domain_id=d.domain_id
            WHERE cl.ts >= ?
            GROUP BY cl.domain_id ORDER BY avg_per_snap DESC LIMIT ?''', (cutoff, limit))
        return [{"domain":r[0],"cost_tier":r[1],"snapshots":r[2],
                 "total_cost":round(r[3],8),"avg_per_snap":round(r[4],8)} for r in c.fetchall()]
    finally:
        conn.close()


def query_budget_stops(limit=20):
    """Budget stops: jobs where budget_status != OK."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT cj.job_id, cj.seed, cj.budget_status, cj.budget_spent, cj.budget_currency,
            cj.budget_last_calc_at, cj.started_at, cj.finished_at,
            bp.name as budget_name, bp.limit_total
            FROM crawl_job cj
            LEFT JOIN budget_binding bb ON cj.job_id=bb.job_id
            LEFT JOIN budget_policy bp ON bb.bid=bp.bid
            WHERE cj.budget_status IS NOT NULL AND cj.budget_status != 'OK'
            ORDER BY cj.budget_last_calc_at DESC LIMIT ?''', (limit,))
        return [{"job_id":r[0],"seed":r[1],"status":r[2],"spent":r[3],
                 "currency":r[4],"calc_at":r[5],"started":r[6],"finished":r[7],
                 "budget_name":r[8],"limit":r[9]} for r in c.fetchall()]
    finally:
        conn.close()


def query_cost_vs_quality(limit=50):
    """Cost vs quality: scatter (avg cost per snapshot vs SCORE_P50) by domain."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain, d.cost_tier, d.tier,
            COALESCE((SELECT AVG(cl2.cost_total) FROM cost_ledger cl2
                      WHERE cl2.domain_id=d.domain_id AND cl2.snap_id IS NOT NULL), 0) as avg_cost,
            COALESCE((SELECT kv.value FROM kpi_value kv
                      JOIN kpi_definition kd ON kv.kpi_id=kd.kpi_id
                      WHERE kd.key='SCORE_P50' AND kv.scope='DOMAIN'
                        AND kv.scope_id=CAST(d.domain_id AS TEXT)
                      ORDER BY kv.id DESC LIMIT 1), 0) as score_p50
            FROM domain d
            ORDER BY avg_cost DESC LIMIT ?''', (limit,))
        return [{"domain":r[0],"cost_tier":r[1],"quality_tier":r[2],
                 "avg_cost":round(r[3],8),"score_p50":round(r[4],2)} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v10 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_replay_summary(limit=20):
    """Replay summary: avg score_delta + top added CRITICAL codes by replay_plan."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT rp.rid,rp.name,rp.from_rule_set_id,rp.to_rule_set_id,rp.status,
            rp.sample_size,rp.created_at,rp.finished_at,
            COUNT(rr.id) as result_count,
            AVG(rr.score_delta) as avg_delta,
            MIN(rr.score_delta) as min_delta,
            MAX(rr.score_delta) as max_delta
            FROM replay_plan rp
            LEFT JOIN replay_result rr ON rp.rid=rr.rid
            GROUP BY rp.rid ORDER BY rp.created_at DESC LIMIT ?''', (limit,))
        return [{"rid":r[0],"name":r[1],"from_rs":r[2],"to_rs":r[3],"status":r[4],
                 "sample_size":r[5],"created":r[6],"finished":r[7],
                 "results":r[8],"avg_delta":round(r[9],2) if r[9] else 0,
                 "min_delta":r[10] or 0,"max_delta":r[11] or 0} for r in c.fetchall()]
    finally:
        conn.close()


def query_release_history(limit=20):
    """Release history: release_gate ordered by decided_at desc."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT gid,kind,from_version,to_version,status,
            evidence_json,criteria_json,created_at,decided_at
            FROM release_gate ORDER BY decided_at DESC LIMIT ?''', (limit,))
        return [{"gid":r[0],"kind":r[1],"from":r[2],"to":r[3],"status":r[4],
                 "evidence":json.loads(r[5]),"criteria":json.loads(r[6]),
                 "created":r[7],"decided":r[8]} for r in c.fetchall()]
    finally:
        conn.close()


def query_rule_set_lineage(limit=20):
    """Rule-set lineage: golden_rule with release_gate_id."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT gr.rule_set_id,gr.name,gr.version,gr.is_active,gr.frozen_at,
            gr.created_at,gr.release_gate_id,
            rg.status as gate_status,rg.decided_at as gate_decided
            FROM golden_rule gr
            LEFT JOIN release_gate rg ON gr.release_gate_id=rg.gid
            ORDER BY gr.rule_set_id DESC LIMIT ?''', (limit,))
        return [{"rs_id":r[0],"name":r[1],"version":r[2],"active":bool(r[3]),
                 "frozen_at":r[4],"created":r[5],"gate_id":r[6],
                 "gate_status":r[7],"gate_decided":r[8]} for r in c.fetchall()]
    finally:
        conn.close()


def query_split_brain_incidents(limit=50):
    """Split-brain incidents: event_log where code='RULE_SET_SPLIT_BRAIN'."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT eid,stage,severity,code,message,ts
            FROM event_log WHERE code='RULE_SET_SPLIT_BRAIN'
            ORDER BY ts DESC LIMIT ?''', (limit,))
        return [{"eid":r[0],"stage":r[1],"severity":r[2],"code":r[3],
                 "message":r[4],"ts":r[5]} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v11 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_pair_coverage_gaps(limit=50):
    """Pair coverage gaps: coverage_matrix where scope=PAIR and coverage_pct<0.9."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT cm.id,cm.scope_id as pair_id,cm.intent_flag,cm.coverage_pct,
            cm.pages_seen,cm.as_of_date,
            cp.left_domain_id,cp.right_domain_id
            FROM coverage_matrix cm
            LEFT JOIN comparison_pair cp ON cm.scope_id=cp.pid
            WHERE cm.scope='PAIR' AND cm.coverage_pct < ?
            ORDER BY cm.coverage_pct ASC LIMIT ?''', (COVERAGE_MIN_PAIR_PCT, limit))
        return [{"id":r[0],"pair_id":r[1],"intent":r[2],"coverage":r[3],
                 "pages_seen":r[4],"date":r[5],
                 "left_domain":r[6],"right_domain":r[7]} for r in c.fetchall()]
    finally:
        conn.close()


def query_domain_intent_coverage(limit=50):
    """Domain intent coverage: ordered by coverage_pct asc."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT cm.scope_id as domain_id,d.domain,cm.intent_flag,
            cm.coverage_pct,cm.pages_seen,cm.rep_pages_seen,cm.as_of_date
            FROM coverage_matrix cm
            LEFT JOIN domain d ON cm.scope_id=d.domain_id
            WHERE cm.scope='DOMAIN'
            ORDER BY cm.coverage_pct ASC, cm.as_of_date DESC LIMIT ?''', (limit,))
        return [{"domain_id":r[0],"domain":r[1],"intent":r[2],
                 "coverage":r[3],"pages":r[4],"rep_pages":r[5],"date":r[6]} for r in c.fetchall()]
    finally:
        conn.close()


def query_pairs_missing_pricing(limit=50):
    """Fixed pages audit: pairs missing PRICING fixed page."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT cp.pid,cp.left_domain_id,cp.right_domain_id,cp.created_at
            FROM comparison_pair cp
            WHERE cp.pid NOT IN (
                SELECT pfp.pair_id FROM pair_fixed_page pfp WHERE pfp.intent_flag='PRICING'
            ) LIMIT ?''', (limit,))
        return [{"pair_id":r[0],"left":r[1],"right":r[2],"created":r[3]} for r in c.fetchall()]
    finally:
        conn.close()


def query_auth_surface_hits(days=7, limit=50):
    """Auth surface hits: AUTH_SURFACE_RESTRICTED events last N days."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT eid,stage,message,ts,domain_id,page_id
            FROM event_log WHERE code='AUTH_SURFACE_RESTRICTED' AND ts >= ?
            ORDER BY ts DESC LIMIT ?''', (cutoff, limit))
        return [{"eid":r[0],"stage":r[1],"message":r[2],"ts":r[3],
                 "domain_id":r[4],"page_id":r[5]} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v12 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_integrity_failures(limit=50):
    """Integrity failures: snapshots that failed completeness checks."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT si.id,si.snap_id,ig.name,si.status,si.missing_json,si.created_at,
            p.url,d.domain,ps.score_total,ps.is_complete,ps.complete_reason
            FROM snapshot_integrity si
            JOIN integrity_gate ig ON si.igid=ig.igid
            JOIN page_snapshot ps ON si.snap_id=ps.snap_id
            JOIN page p ON ps.page_id=p.page_id
            LEFT JOIN domain d ON p.domain_id=d.domain_id
            WHERE si.status='FAIL'
            ORDER BY si.created_at DESC LIMIT ?''', (limit,))
        return [{"id":r[0],"snap_id":r[1],"gate":r[2],"status":r[3],
                 "missing":json.loads(r[4]),"checked_at":r[5],
                 "url":r[6],"domain":r[7],"score":r[8],
                 "complete":bool(r[9]),"reason":r[10]} for r in c.fetchall()]
    finally:
        conn.close()


def query_data_quality_trend(days=30, scope="GLOBAL", scope_id=None):
    """Data quality trend: daily pass rate over time."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
        if scope_id:
            c.execute('''SELECT as_of_date,snapshot_pass_rate,audit_incomplete_rate,
                parse_fail_rate,fetch_not_html_rate
                FROM data_quality_daily
                WHERE scope=? AND scope_id=? AND as_of_date >= ?
                ORDER BY as_of_date''', (scope, scope_id, cutoff))
        else:
            c.execute('''SELECT as_of_date,snapshot_pass_rate,audit_incomplete_rate,
                parse_fail_rate,fetch_not_html_rate
                FROM data_quality_daily
                WHERE scope=? AND scope_id IS NULL AND as_of_date >= ?
                ORDER BY as_of_date''', (scope, cutoff))
        return [{"date":r[0],"pass_rate":r[1],"incomplete_rate":r[2],
                 "parse_fail":r[3],"not_html":r[4]} for r in c.fetchall()]
    finally:
        conn.close()


def query_kpi_filter_coverage():
    """KPI filter coverage: which KPIs have filters assigned."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT kd.kpi_id,kd.key,kd.name,kd.kpi_filter_id,
            kf.name as filter_name,kf.predicate_json
            FROM kpi_definition kd
            LEFT JOIN kpi_filter kf ON kd.kpi_filter_id=kf.fid
            ORDER BY kd.kpi_id''')
        return [{"kpi_id":r[0],"key":r[1],"name":r[2],"filter_id":r[3],
                 "filter_name":r[4],
                 "predicate":json.loads(r[5]) if r[5] else None} for r in c.fetchall()]
    finally:
        conn.close()


def query_incomplete_snapshot_rate(days=7):
    """Incomplete snapshot rate: % of recent snapshots with is_complete=0."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('SELECT COUNT(*) FROM page_snapshot WHERE fetched_at >= ?', (cutoff,))
        total = c.fetchone()[0]
        c.execute('SELECT COUNT(*) FROM page_snapshot WHERE fetched_at >= ? AND is_complete=0', (cutoff,))
        incomplete = c.fetchone()[0]
        return {"total": total, "incomplete": incomplete,
                "rate": round(incomplete / total, 4) if total > 0 else 0}
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v13 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_lineage_graph(from_kind=None, from_id=None, depth=3, limit=100):
    """Lineage graph: trace data flow from a given node (BFS up to depth)."""
    conn = get_conn()
    try:
        c = conn.cursor()
        if from_kind and from_id:
            visited = set()
            queue = [(from_kind, from_id, 0)]
            edges = []
            while queue and len(edges) < limit:
                fk, fi, d = queue.pop(0)
                key = (fk, fi)
                if key in visited or d > depth:
                    continue
                visited.add(key)
                c.execute('''SELECT lid,from_kind,from_id,to_kind,to_id,edge_type,job_id,created_at
                    FROM lineage_edge WHERE from_kind=? AND from_id=?''', (fk, fi))
                for r in c.fetchall():
                    edges.append({"lid":r[0],"from_kind":r[1],"from_id":r[2],
                                  "to_kind":r[3],"to_id":r[4],"edge_type":r[5],
                                  "job_id":r[6],"created_at":r[7]})
                    queue.append((r[3], r[4], d + 1))
            return edges
        else:
            c.execute('''SELECT lid,from_kind,from_id,to_kind,to_id,edge_type,job_id,created_at
                FROM lineage_edge ORDER BY created_at DESC LIMIT ?''', (limit,))
            return [{"lid":r[0],"from_kind":r[1],"from_id":r[2],
                     "to_kind":r[3],"to_id":r[4],"edge_type":r[5],
                     "job_id":r[6],"created_at":r[7]} for r in c.fetchall()]
    finally:
        conn.close()


def query_sample_set_status(limit=20):
    """Sample set status: all active sample sets with member counts."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT ss.ssid,ss.name,ss.strategy,ss.sample_size,ss.rule_set_id,
            ss.segment_id,ss.refresh_interval_days,ss.last_refreshed_at,ss.is_active,
            (SELECT COUNT(*) FROM sample_member sm WHERE sm.ssid=ss.ssid) as actual_members,
            (SELECT st.alert_level FROM stability_stat st WHERE st.ssid=ss.ssid
             ORDER BY st.as_of_date DESC LIMIT 1) as latest_alert
            FROM snapshot_sample_set ss
            WHERE ss.is_active=1
            ORDER BY ss.created_at DESC LIMIT ?''', (limit,))
        return [{"ssid":r[0],"name":r[1],"strategy":r[2],"target_size":r[3],
                 "rule_set_id":r[4],"segment_id":r[5],"refresh_days":r[6],
                 "last_refresh":r[7],"active":bool(r[8]),"actual_members":r[9],
                 "latest_alert":r[10] or "OK"} for r in c.fetchall()]
    finally:
        conn.close()


def query_stability_trend(ssid=None, days=30):
    """Stability trend: daily stability metrics for a sample set."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
        if ssid:
            c.execute('''SELECT st.stid,st.ssid,ss.name,st.as_of_date,st.member_count,
                st.score_mean,st.score_stddev,st.critical_flip_rate,
                st.issues_hash_flip_rate,st.stable_pct,st.alert_level
                FROM stability_stat st
                JOIN snapshot_sample_set ss ON st.ssid=ss.ssid
                WHERE st.ssid=? AND st.as_of_date >= ?
                ORDER BY st.as_of_date''', (ssid, cutoff))
        else:
            c.execute('''SELECT st.stid,st.ssid,ss.name,st.as_of_date,st.member_count,
                st.score_mean,st.score_stddev,st.critical_flip_rate,
                st.issues_hash_flip_rate,st.stable_pct,st.alert_level
                FROM stability_stat st
                JOIN snapshot_sample_set ss ON st.ssid=ss.ssid
                WHERE st.as_of_date >= ?
                ORDER BY st.as_of_date DESC LIMIT 100''', (cutoff,))
        return [{"stid":r[0],"ssid":r[1],"name":r[2],"date":r[3],"members":r[4],
                 "score_mean":r[5],"score_stddev":r[6],"crit_flip":r[7],
                 "hash_flip":r[8],"stable_pct":r[9],"alert":r[10]} for r in c.fetchall()]
    finally:
        conn.close()


def query_unstable_pages(ssid, threshold_flips=2, days=30, limit=50):
    """Unstable pages: sample members with most issues_sha256 changes."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT sm.page_id,p.url,p.domain,
            COUNT(DISTINCT ps.issues_sha256) as distinct_hashes,
            COUNT(ps.snap_id) as snapshot_count,
            MIN(ps.score_total) as min_score,
            MAX(ps.score_total) as max_score,
            AVG(ps.score_total) as avg_score
            FROM sample_member sm
            JOIN page p ON sm.page_id=p.page_id
            LEFT JOIN page_snapshot ps ON p.page_id=ps.page_id AND ps.fetched_at >= ?
            WHERE sm.ssid=?
            GROUP BY sm.page_id
            HAVING distinct_hashes >= ?
            ORDER BY distinct_hashes DESC LIMIT ?''', (cutoff, ssid, threshold_flips, limit))
        return [{"page_id":r[0],"url":r[1],"domain":r[2],
                 "distinct_hashes":r[3],"snapshots":r[4],
                 "min_score":r[5],"max_score":r[6],
                 "avg_score":round(r[7],2) if r[7] else 0} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v14 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_anomaly_feed(days=14, limit=50):
    """Anomaly feed: recent anomaly events ordered by severity then ts."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT ae.aeid,ae.adid,ad.name as detector_name,ae.scope,ae.scope_id,
            ae.metric_key,ae.value,ae.baseline_json,ae.severity,ae.message,ae.ts
            FROM anomaly_event ae
            JOIN anomaly_detector ad ON ae.adid=ad.adid
            WHERE ae.ts >= ?
            ORDER BY CASE ae.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
                     ae.ts DESC
            LIMIT ?''', (cutoff, limit))
        return [{"aeid":r[0],"adid":r[1],"detector":r[2],"scope":r[3],
                 "scope_id":r[4],"metric":r[5],"value":r[6],
                 "baseline":json.loads(r[7]) if r[7] else {},
                 "severity":r[8],"message":r[9],"ts":r[10]} for r in c.fetchall()]
    finally:
        conn.close()


def query_top_anomaly_detectors(days=30, limit=20):
    """Top anomaly detectors by fired count in last N days."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT ad.adid,ad.name,ad.scope,ad.metric_key,ad.method,ad.severity,
            COUNT(ae.aeid) as fire_count,
            MAX(ae.ts) as last_fired
            FROM anomaly_detector ad
            LEFT JOIN anomaly_event ae ON ad.adid=ae.adid AND ae.ts >= ?
            GROUP BY ad.adid
            ORDER BY fire_count DESC LIMIT ?''', (cutoff, limit))
        return [{"adid":r[0],"name":r[1],"scope":r[2],"metric":r[3],
                 "method":r[4],"severity":r[5],"fire_count":r[6],
                 "last_fired":r[7]} for r in c.fetchall()]
    finally:
        conn.close()


def query_kpi_baseline_view(metric_key="CRITICAL_RATE", scope="GLOBAL", days=30):
    """Baseline view: kpi_baseline_daily trend for a given metric."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
        c.execute('''SELECT id,as_of_date,scope,scope_id,metric_key,window_days,
            mean,stddev,p50,p75,p90
            FROM kpi_baseline_daily
            WHERE metric_key=? AND scope=? AND as_of_date >= ?
            ORDER BY as_of_date''', (metric_key, scope, cutoff))
        return [{"id":r[0],"date":r[1],"scope":r[2],"scope_id":r[3],
                 "metric":r[4],"window":r[5],
                 "mean":r[6],"stddev":r[7],
                 "p50":r[8],"p75":r[9],"p90":r[10]} for r in c.fetchall()]
    finally:
        conn.close()


def query_anomaly_bridged_alerts(limit=50):
    """Alerts bridged from anomaly: alert_event where anomaly_event_id is not null."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT ale.eid,ale.severity,ale.message,ale.ts,ale.anomaly_event_id,
            ae.adid,ad.name as detector_name,ae.metric_key,ae.value,ae.scope
            FROM alert_event ale
            JOIN anomaly_event ae ON ale.anomaly_event_id=ae.aeid
            JOIN anomaly_detector ad ON ae.adid=ad.adid
            WHERE ale.anomaly_event_id IS NOT NULL
            ORDER BY ale.ts DESC LIMIT ?''', (limit,))
        return [{"alert_id":r[0],"severity":r[1],"message":r[2],"ts":r[3],
                 "anomaly_id":r[4],"adid":r[5],"detector":r[6],
                 "metric":r[7],"value":r[8],"scope":r[9]} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
# v15 starter queries
# ═══════════════════════════════════════════════════════════════════════
def query_worst_domains_by_health(days=7, limit=20):
    """Worst domains by fetch_success_rate in last N days."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
        c.execute('''SELECT d.domain_id,d.domain,d.health_tier,d.health_note,
            AVG(dhd.fetch_success_rate) as avg_fsr,
            AVG(dhd.avg_fetch_ms) as avg_ms,
            AVG(dhd.dns_ok_rate) as avg_dns,
            AVG(dhd.tls_ok_rate) as avg_tls,
            COUNT(dhd.id) as days_measured
            FROM domain d
            LEFT JOIN domain_health_daily dhd ON d.domain_id=dhd.domain_id AND dhd.as_of_date >= ?
            GROUP BY d.domain_id
            HAVING days_measured > 0
            ORDER BY avg_fsr ASC LIMIT ?''', (cutoff, limit))
        return [{"domain_id":r[0],"domain":r[1],"tier":r[2],"note":r[3],
                 "avg_fsr":round(r[4],4),"avg_ms":round(r[5],1),
                 "avg_dns":round(r[6],4),"avg_tls":round(r[7],4),
                 "days":r[8]} for r in c.fetchall()]
    finally:
        conn.close()


def query_health_tier_transitions(limit=50):
    """Health tier transitions: domains recently changed to BAD."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute('''SELECT d.domain_id,d.domain,d.health_tier,d.health_note,
            (SELECT dhd.fetch_success_rate FROM domain_health_daily dhd
             WHERE dhd.domain_id=d.domain_id ORDER BY dhd.as_of_date DESC LIMIT 1) as latest_fsr,
            (SELECT dhd.as_of_date FROM domain_health_daily dhd
             WHERE dhd.domain_id=d.domain_id ORDER BY dhd.as_of_date DESC LIMIT 1) as latest_date
            FROM domain d
            WHERE d.health_tier IN ('BAD','DEGRADED')
            ORDER BY d.health_tier ASC, d.domain LIMIT ?''', (limit,))
        return [{"domain_id":r[0],"domain":r[1],"tier":r[2],"note":r[3],
                 "latest_fsr":r[4],"latest_date":r[5]} for r in c.fetchall()]
    finally:
        conn.close()


def query_fingerprint_changes(days=30, limit=30):
    """Fingerprint changes: domains with most distinct fingerprints (potential infra changes)."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT hf.domain_id,d.domain,
            COUNT(DISTINCT hf.sha256) as distinct_fps,
            COUNT(hf.id) as total_fps,
            MAX(hf.created_at) as last_fp
            FROM http_fingerprint hf
            JOIN domain d ON hf.domain_id=d.domain_id
            WHERE hf.created_at >= ?
            GROUP BY hf.domain_id
            HAVING distinct_fps > 1
            ORDER BY distinct_fps DESC LIMIT ?''', (cutoff, limit))
        return [{"domain_id":r[0],"domain":r[1],"distinct_fps":r[2],
                 "total_fps":r[3],"last_fp":r[4]} for r in c.fetchall()]
    finally:
        conn.close()


def query_cooldown_hits(days=14, limit=50):
    """Cooldown hits: DOMAIN_IN_COOLDOWN events from event_log."""
    conn = get_conn()
    try:
        c = conn.cursor()
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        c.execute('''SELECT eid,domain_id,stage,message,ts,network_stage
            FROM event_log
            WHERE code='DOMAIN_IN_COOLDOWN' AND ts >= ?
            ORDER BY ts DESC LIMIT ?''', (cutoff, limit))
        return [{"eid":r[0],"domain_id":r[1],"stage":r[2],
                 "message":r[3],"ts":r[4],"network_stage":r[5]} for r in c.fetchall()]
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    init_db()
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM issue")
        ic = c.fetchone()[0]
        tables = ['domain','crawl_job','page','page_snapshot','issue','page_issue',
                  'snapshot_delta','crawl_frontier','artifact_store','snapshot_artifact',
                  'http_cache','job_metric','event_log',
                  'url_graph_edge','canonical_cluster','cluster_member','site_hint',
                  'alert_rule','alert_event',
                  'golden_rule','snapshot_rule_binding','qa_sample','drift_check','export_job',
                  'segment','domain_segment','baseline_stat','comparison_pair',
                  'kpi_definition','kpi_value','fix_ticket','ticket_link',
                  'policy','policy_binding','redaction_rule','export_view',
                  'cost_ledger','budget_policy','budget_binding',
                  'replay_plan','replay_item','replay_result','release_gate',
                  'ingest_source','frontier_source_link','pair_fixed_page','coverage_matrix',
                  'integrity_gate','snapshot_integrity','kpi_filter','data_quality_daily',
                  'lineage_edge','snapshot_sample_set','sample_member','stability_stat',
                  'anomaly_detector','anomaly_event','kpi_baseline_daily',
                  'resolver_cache','http_fingerprint','domain_health_daily']
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing = {r[0] for r in c.fetchall()}
        ok = [t for t in tables if t in existing]

        c.execute("SELECT COUNT(*) FROM alert_rule")
        ar = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM golden_rule")
        gr = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM segment")
        sg = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM kpi_definition")
        kc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM policy")
        pc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM budget_policy")
        bc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM ingest_source")
        isc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM integrity_gate")
        igc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM kpi_filter")
        kfc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM snapshot_sample_set")
        ssc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM lineage_edge")
        lec = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM anomaly_detector")
        adc = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM anomaly_event")
        aec = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM http_fingerprint")
        hfc = c.fetchone()[0]

        rs = get_active_rule_set(c)
        pol = get_active_policy(c)
        bgt = get_active_budget(c)
    finally:
        conn.close()

    print(f"[DB] Schema v15 ready: {DB_PATH}")
    print(f"[DB] Tables: {len(ok)}/{len(tables)} — {', '.join(ok)}")
    print(f"[DB] Issue codes: {ic} | Alert rules: {ar} | Golden rules: {gr} | Segments: {sg} | KPIs: {kc}")
    print(f"[DB] Policies: {pc} | Budget: {bc} | Ingest: {isc} | Integrity gates: {igc} | KPI filters: {kfc}")
    print(f"[DB] Sample sets: {ssc} | Lineage edges: {lec} | Anomaly detectors: {adc} | Anomaly events: {aec}")
    print(f"[DB] Fingerprints: {hfc}")
    print(f"[DB] Active rule set: {rs['name']} (id={rs['rule_set_id']})" if rs else "[DB] No active rule set")
    print(f"[DB] Active policy: {pol['key']} v{pol['version']} (id={pol['policy_id']})" if pol else "[DB] No active policy")
    print(f"[DB] Active budget: {bgt['name']} v{bgt['version']} limit={bgt['limit_total']}{bgt['currency']}" if bgt else "[DB] No active budget")
    print(f"[DB] Gates: v14(58) + NETWORK_PRECHECK → FINGERPRINT → DOMAIN_HEALTH_DAILY → HEALTH_ALERT = 62 total")

    reports = get_latest_reports(5)
    print(f"\n[REPORTS] {len(reports)} snapshots")
    for r in reports:
        rep_flag = " [REP]" if r.get('is_representative') else ""
        print(f"  {(r['domain'] or '?'):30s} score={r['score']}  cluster={r.get('cluster_id','?')}{rep_flag}  issues={r['issues']}")

    summary = get_domain_summary()
    print(f"\n[DOMAINS] {len(summary)}")
    for s in summary:
        print(f"  {s['domain']:30s} tier={s['tier']} pages={s['pages']} rep={s['representative_pages']} avg={s['avg']} sitemap={s.get('sitemap','none')}")
