"""
seo_deep_analyzer v15 — Network-isolated, fingerprinted, health-monitored crawler
Features: conditional fetch (304), timing instrumentation, retry/backoff,
          frontier-based crawl, job metrics, full SEO audit,
          edge emission, cluster support, issues_sha256 determinism,
          QA sampling, drift detection, export tracking,
          page intent detection, segment assignment, baseline comparison,
          KPI computation at job finish, auto-ticket from alerts,
          policy binding at job/ticket/export, export views (PUBLIC/INTERNAL),
          redaction rules (MASK/DROP/HASH), public export floor cap,
          cost ledger per stage, budget binding + soft/hard stop,
          domain cost tier (A/B/C) auto-classification,
          replay regression testing, release gate (PASS/FAIL),
          one-switch rule_set activation, split-brain detection,
          ingest source tracking, pair fixed pages, coverage matrix,
          coverage gap alerts, LOGIN/SIGNUP depth restriction,
          snapshot integrity checks, KPI filter predicates,
          daily data quality dashboard,
          data lineage graph (CRAWL→SNAPSHOT→ISSUE/ARTIFACT/KPI/ALERT),
          fixed monitoring sample sets (STRATIFIED/RANDOM/TOP_N),
          stability metrics (score_stddev, critical_flip_rate, issues_hash_flip_rate),
          stability alerting (OK/WARNING/CRITICAL thresholds),
          anomaly detectors (ZSCORE/PCTL/DELTA_RATE methods),
          KPI baseline daily (mean/stddev/p50/p75/p90 rolling window),
          anomaly→alert bridge (anomaly_event_id on alert_event),
          cooldown gate (per-detector deduplication),
          DNS/TLS resolver cache with cooldown isolation,
          HTTP header fingerprinting (server/CDN/cache/HSTS),
          domain health daily (fetch_success/304_ratio/avg_ms),
          health tier classification (GOOD/DEGRADED/BAD) + auto-alerting.
"""
import requests
from bs4 import BeautifulSoup
import sys, json, re, os, hashlib, time
from collections import Counter
from urllib.parse import urlparse

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from Domain_Knowledge_DB import seo_database

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ═══════════════════════════════════════════════════════════════════════
# Extraction helpers
# ═══════════════════════════════════════════════════════════════════════
def _extract_og(soup):
    og = {}
    for tag in soup.find_all('meta', attrs={'property': re.compile(r'^og:')}):
        og[tag.get('property','').replace('og:','')] = tag.get('content','')
    return og

def _extract_twitter_card(soup):
    tc = {}
    for tag in soup.find_all('meta', attrs={'name': re.compile(r'^twitter:')}):
        tc[tag.get('name','').replace('twitter:','')] = tag.get('content','')
    return tc

def _extract_hreflang(soup):
    return [{"lang": t.get('hreflang',''), "href": t.get('href','')}
            for t in soup.find_all('link', attrs={'rel': 'alternate', 'hreflang': True})]

def _extract_jsonld(soup):
    scripts = soup.find_all('script', attrs={'type': 'application/ld+json'})
    types, broken, count = [], False, 0
    for s in scripts:
        count += 1
        try:
            raw = s.string
            if not raw: broken = True; continue
            ld = json.loads(raw)
            if isinstance(ld, dict):
                if '@type' in ld: types.append(ld['@type'])
                if '@graph' in ld and isinstance(ld['@graph'], list):
                    for item in ld['@graph']:
                        if isinstance(item, dict) and '@type' in item: types.append(item['@type'])
            elif isinstance(ld, list):
                for item in ld:
                    if isinstance(item, dict) and '@type' in item: types.append(item['@type'])
        except (json.JSONDecodeError, TypeError):
            broken = True
    return types, count, broken

def _dom_hash(soup):
    return hashlib.sha256("|".join(t.name for t in soup.find_all(True)).encode()).hexdigest()

def _collect_links(soup, domain):
    """Collect links and return counts + samples for edge emission (v4)."""
    internal = []
    external = []
    for a in soup.find_all('a', href=True):
        h = a['href']
        if h.startswith(('#','javascript:','mailto:')): continue
        if h.startswith('http'):
            ld = (urlparse(h).hostname or "").lower()
            if ld == domain or ld.endswith('.'+domain):
                internal.append(h)
            else:
                external.append(h)
        else:
            internal.append(h)
    # Sort for determinism, cap at 50 per spec
    int_sample = sorted(set(internal))[:50]
    ext_sample = sorted(set(external))[:50]
    return len(internal), len(external), int_sample, ext_sample

def _a11y_alt(soup):
    imgs = soup.find_all('img')
    if not imgs: return 0.0, 0
    ok = sum(1 for i in imgs if i.get('alt','').strip())
    return round(ok/len(imgs)*100, 1), len(imgs)


# ═══════════════════════════════════════════════════════════════════════
# Core analyzer v4
# ═══════════════════════════════════════════════════════════════════════
def analyze_competitor_url(url, job_id=None, http_hints=None):
    """Full analysis with timing + edge emission. http_hints = {"etag":..., "last_modified":...}"""
    timings = {}
    try:
        # ── FETCH with conditional headers ──
        req_headers = dict(HEADERS)
        if http_hints:
            if http_hints.get("etag"):
                req_headers["If-None-Match"] = http_hints["etag"]
            if http_hints.get("last_modified"):
                req_headers["If-Modified-Since"] = http_hints["last_modified"]

        t0 = time.time()
        response = requests.get(url, headers=req_headers, timeout=15, allow_redirects=True)
        timings["fetch_ms"] = int((time.time() - t0) * 1000)
        response.encoding = 'utf-8'
        raw_html = response.text
        resp_headers = dict(response.headers)
        status_code = response.status_code

        # Redirect chain
        redirect_chain = [{"status": r.status_code, "url": r.url} for r in response.history]
        final_url = response.url

        # ── 304 fast path ──
        if status_code == 304:
            data = {"target_url": url, "final_url": final_url, "status_code": 304,
                    "redirect_chain": redirect_chain, "page_title": None, "meta_description": None}
            ok, pid, st = seo_database.save_analysis(data, job_id=job_id, headers=resp_headers, timings=timings)
            print(f"[304] page_id={pid} — not modified")
            return {"status": "success", "data": {"target_url": url, "db_status": st, "db_page_id": pid, "http_304": True}}

        # ── Error status ──
        if status_code >= 400:
            data = {"target_url": url, "final_url": final_url, "redirect_chain": redirect_chain,
                    "status_code": status_code, "page_title": None, "meta_description": None}
            ok, pid, st = seo_database.save_analysis(data, job_id=job_id, raw_html=raw_html, headers=resp_headers, timings=timings)
            return {"status": "error", "code": status_code, "page_id": pid, "db_status": st}

        # ── PARSE ──
        t1 = time.time()
        soup = BeautifulSoup(raw_html, 'html.parser')
        page_domain = (urlparse(final_url).hostname or "").lower()

        title = soup.title.string.strip() if soup.title and soup.title.string else None
        meta_tag = soup.find('meta', attrs={'name': 'description'})
        meta_desc = meta_tag['content'].strip() if meta_tag and meta_tag.get('content') else None

        h1_list = [t.get_text(strip=True) for t in soup.find_all('h1')]
        h2_tags = soup.find_all('h2')
        h3_tags = soup.find_all('h3')

        can_tag = soup.find('link', attrs={'rel': 'canonical'})
        canonical = can_tag['href'] if can_tag and can_tag.get('href') else None
        rob_tag = soup.find('meta', attrs={'name': 'robots'})
        robots_meta = rob_tag['content'] if rob_tag and rob_tag.get('content') else None
        html_tag = soup.find('html')
        lang = html_tag.get('lang') if html_tag else None

        og = _extract_og(soup); tc = _extract_twitter_card(soup)
        hreflang = _extract_hreflang(soup)
        jt, jc, bj = _extract_jsonld(soup)
        sha256_dom = _dom_hash(soup)

        # v4: collect links + edge samples
        il, el, int_sample, ext_sample = _collect_links(soup, page_domain)
        a11y_pct, img_count = _a11y_alt(soup)

        for s in soup(["script","style"]): s.extract()
        text = soup.get_text()
        tl = len(text)
        sha256_text = hashlib.sha256(text.encode()).hexdigest()
        words = [w for w in re.findall(r'\w+', text.lower()) if len(w) > 2]
        wc = len(words)
        top_words = Counter(words).most_common(10)
        timings["parse_ms"] = int((time.time() - t1) * 1000)

        # hreflang consistency
        hreflang_bad = False
        if hreflang:
            norm = seo_database.normalize_url(final_url)
            if not any(seo_database.normalize_url(h['href']) == norm for h in hreflang):
                hreflang_bad = True

        t2 = time.time()
        analysis = {
            "target_url": url, "final_url": final_url, "redirect_chain": redirect_chain,
            "status_code": status_code,
            "page_title": title, "meta_description": meta_desc,
            "canonical": canonical, "robots_meta": robots_meta, "lang": lang,
            "structure": {"h1_count": len(h1_list), "h1_content": h1_list,
                         "h2_count": len(h2_tags), "h2_sample": [t.get_text(strip=True) for t in h2_tags[:5]],
                         "h3_count": len(h3_tags)},
            "word_count": wc, "text_len": tl, "sha256_text": sha256_text, "sha256_dom": sha256_dom,
            "jsonld_types": jt, "jsonld_count": jc, "broken_jsonld": bj,
            "open_graph": og, "twitter_card": tc,
            "hreflang": hreflang, "hreflang_inconsistent": hreflang_bad,
            "internal_links_count": il, "external_links_count": el,
            "images_count": img_count, "a11y_alt_coverage_pct": a11y_pct,
            "keyword_dominance": top_words,
        }

        # v4: edge emission data
        edge_data = {
            "internal_links_sample": int_sample,
            "external_links_sample": ext_sample,
            "canonical_url_norm": seo_database.normalize_url(canonical) if canonical else None,
            "hreflang_map": {h["lang"]: h["href"] for h in hreflang} if hreflang else None,
        }

        timings["audit_ms"] = int((time.time() - t2) * 1000)

        # ── SAVE (v4 pipeline with graph+cluster+alert gates) ──
        ok, pid, st = seo_database.save_analysis(analysis, job_id=job_id, raw_html=raw_html,
                                                  headers=resp_headers, timings=timings,
                                                  edge_data=edge_data)
        print(f"[DB] page_id={pid} status={st} fetch={timings['fetch_ms']}ms parse={timings['parse_ms']}ms")
        analysis["db_status"] = st; analysis["db_page_id"] = pid
        analysis["timings"] = timings
        analysis["edge_data"] = edge_data
        return {"status": "success", "data": analysis}

    except requests.exceptions.Timeout:
        return {"status": "error", "msg": "timeout", "transient": True}
    except requests.exceptions.ConnectionError as e:
        return {"status": "error", "msg": str(e), "transient": True}
    except Exception as e:
        return {"status": "error", "msg": str(e), "transient": False}


# ═══════════════════════════════════════════════════════════════════════
# Batch crawl v4
# ═══════════════════════════════════════════════════════════════════════
def batch_crawl(urls, rate_limit_ms=1000):
    seo_database.init_db()
    job_id = seo_database.start_job(seed=urls[0], mode="SEED_ONLY",
                                     settings={"urls": urls, "count": len(urls)})
    print(f"[JOB] Started job_id={job_id} with {len(urls)} URLs")

    metrics = {"success": 0, "failed": 0, "skipped": 0, "http_304": 0,
               "total_fetch_ms": 0, "total_parse_ms": 0}
    results = []
    for i, url in enumerate(urls):
        print(f"[CRAWL {i+1}/{len(urls)}] {url}")
        result = analyze_competitor_url(url, job_id=job_id)
        results.append(result)

        st = result.get("data", {}).get("db_status", "ERROR")
        if st == "SAVED": metrics["success"] += 1
        elif st == "HTTP_304": metrics["http_304"] += 1
        elif st in ("DEDUP_SKIPPED",): metrics["skipped"] += 1
        else: metrics["failed"] += 1

        tm = result.get("data", {}).get("timings", {})
        metrics["total_fetch_ms"] += tm.get("fetch_ms", 0)
        metrics["total_parse_ms"] += tm.get("parse_ms", 0)

        if i < len(urls) - 1:
            time.sleep(rate_limit_ms / 1000.0)

    n = len(urls)
    metrics["avg_fetch_ms"] = metrics["total_fetch_ms"] / n if n else 0
    metrics["avg_parse_ms"] = metrics["total_parse_ms"] / n if n else 0
    del metrics["total_fetch_ms"]; del metrics["total_parse_ms"]

    seo_database.finish_job(job_id, metrics=metrics)
    print(f"[JOB] Finished job_id={job_id} | ok={metrics['success']} fail={metrics['failed']} skip={metrics['skipped']} 304={metrics['http_304']}")
    return job_id, results


# ═══════════════════════════════════════════════════════════════════════
# Frontier crawl with retry v4
# ═══════════════════════════════════════════════════════════════════════
def frontier_crawl(limit=10, rate_limit_ms=1000):
    seo_database.init_db()
    items = seo_database.frontier_next(limit=limit)
    if not items:
        print("[FRONTIER] No pending URLs"); return []

    job_id = seo_database.start_job(seed="frontier", mode="FRONTIER",
                                     settings={"batch": limit})
    print(f"[FRONTIER] Processing {len(items)} URLs, job_id={job_id}")

    metrics = {"success": 0, "failed": 0, "skipped": 0, "retried": 0, "http_304": 0,
               "total_fetch_ms": 0}
    results = []
    for i, item in enumerate(items):
        print(f"[CRAWL {i+1}/{len(items)}] {item['url']} (retry={item['retry_count']} source={item.get('source','?')})")
        try:
            result = analyze_competitor_url(item['url'], job_id=job_id,
                                            http_hints=item.get('http_hints'))
            st = result.get("data", {}).get("db_status", result.get("db_status", "ERROR"))
            transient = result.get("transient", False)

            if result.get("status") == "error" and transient:
                seo_database.frontier_retry(item['fid'], error=result.get("msg"))
                metrics["retried"] += 1
            else:
                seo_database.frontier_done(item['fid'], status="DONE")
                if st == "SAVED": metrics["success"] += 1
                elif st == "HTTP_304": metrics["http_304"] += 1
                elif st == "DEDUP_SKIPPED": metrics["skipped"] += 1
                else: metrics["failed"] += 1

            tm = result.get("data", {}).get("timings", {})
            metrics["total_fetch_ms"] += tm.get("fetch_ms", 0)
            results.append(result)
        except Exception as e:
            seo_database.frontier_retry(item['fid'], error=str(e))
            metrics["retried"] += 1
            results.append({"status": "error", "msg": str(e)})

        if i < len(items) - 1:
            time.sleep(rate_limit_ms / 1000.0)

    n = len(items)
    metrics["avg_fetch_ms"] = metrics["total_fetch_ms"] / n if n else 0
    del metrics["total_fetch_ms"]

    seo_database.finish_job(job_id, metrics=metrics)
    print(f"[FRONTIER] Done job_id={job_id} | ok={metrics['success']} fail={metrics['failed']} retry={metrics['retried']} 304={metrics['http_304']}")
    return results


# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--frontier":
        lim = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        frontier_crawl(limit=lim)
    elif len(sys.argv) > 2:
        jid, res = batch_crawl(sys.argv[1:])
        print(f"\n[BATCH] job_id={jid}, crawled={len(res)}")
        for r in res:
            d = r.get("data", {})
            print(f"  {d.get('db_status','ERR'):15s} {d.get('target_url','?')}")
    else:
        seo_database.init_db()
        url = sys.argv[1] if len(sys.argv) > 1 else "https://www.python.org"
        result = analyze_competitor_url(url)
        if result.get("status") == "success":
            d = result["data"]
            ed = d.get("edge_data", {})
            print(json.dumps({
                "url": d["target_url"], "final_url": d["final_url"],
                "title": d["page_title"], "score": d.get("db_status"),
                "h1_count": d["structure"]["h1_count"], "h2_count": d["structure"]["h2_count"],
                "word_count": d["word_count"], "jsonld": d["jsonld_types"],
                "og_keys": list(d["open_graph"].keys()),
                "internal_links": d["internal_links_count"],
                "external_links": d["external_links_count"],
                "int_sample_count": len(ed.get("internal_links_sample", [])),
                "ext_sample_count": len(ed.get("external_links_sample", [])),
                "images": d["images_count"], "a11y_pct": d["a11y_alt_coverage_pct"],
                "timings": d.get("timings", {}),
                "page_id": d["db_page_id"], "db_status": d["db_status"],
            }, ensure_ascii=False, indent=2))
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
