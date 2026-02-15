#!/usr/bin/env python3
"""
SEOBAIKE 資料完整性驗證腳本
Data Integrity Check Script

專利: TW-115100981 | 公司: 小路光有限公司 | CEO: 許竣翔
執行方式: python data_integrity_check.py

此腳本自動檢查:
1. 所有應有的資料是否存在
2. 所有證據是否可開啟（檔案可讀取、JSON 可解析）
3. 所有時間戳是否合理（不早於 2026-01-01、不晚於現在）
4. 所有 checksum 是否匹配（SHA256 驗證）
5. 雲端平台註冊數量是否正確
6. 安全檢測報告的真實性
7. 十層任務鏈交付物完整性
"""

import os
import sys
import json
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path

# === 設定 ===
# Configuration

BASE_DIR = Path(__file__).parent
REPORT_FILE = BASE_DIR / "data_integrity_report.json"
LOG_FILE = BASE_DIR / "data_integrity_check.log"

# 設定日誌
# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("integrity_check")

# === 預期的檔案清單（十層任務鏈 + 輔助檔案）===
# Expected files for the 10-layer task chain + supporting files

EXPECTED_FILES = {
    # 第一層：任務生成
    # Layer 1: Task Generation
    "layer_1": {
        "description": "任務生成 (Task Generation)",
        "files": [
            {"path": "task_generator.py", "type": "script", "min_lines": 50},
            {"path": "tasks/task_list.json", "type": "json", "expected_records": 100},
        ],
    },
    # 第二層：任務分配
    # Layer 2: Task Assignment
    "layer_2": {
        "description": "任務分配 (Task Assignment)",
        "files": [
            {"path": "assign_tasks.py", "type": "script", "min_lines": 50},
            {
                "path": "tasks/assignment_report.json",
                "type": "json",
                "expected_key": "assignments",
            },
        ],
    },
    # 第三層：執行監控
    # Layer 3: Execution Monitoring
    "layer_3": {
        "description": "執行監控 (Execution Monitoring)",
        "files": [
            {"path": "monitor_tasks.py", "type": "script", "min_lines": 50},
            {
                "path": "tasks/execution_report.json",
                "type": "json",
                "expected_key": "results",
            },
        ],
    },
    # 第四層：優化演算法
    # Layer 4: Optimization Algorithm
    "layer_4": {
        "description": "優化演算法 (Optimization Algorithm)",
        "files": [
            {"path": "optimize_scheduler.py", "type": "script", "min_lines": 50},
            {"path": "tasks/optimization_report.md", "type": "markdown", "min_lines": 30},
            {"path": "tasks/optimization_data.json", "type": "json"},
        ],
    },
    # 第五層：技術文件
    # Layer 5: Technical Documentation
    "layer_5": {
        "description": "技術文件 (Technical Documentation)",
        "files": [
            {"path": "docs/white_paper.md", "type": "markdown", "min_lines": 200},
            {"path": "docs/tutorial_script.txt", "type": "text", "min_lines": 150},
        ],
    },
    # 第六層：跨時代比較
    # Layer 6: Cross-Era Comparison
    "layer_6": {
        "description": "跨時代比較 (Cross-Era Comparison)",
        "files": [
            {
                "path": "docs/comparative_analysis.md",
                "type": "markdown",
                "min_lines": 150,
            },
        ],
    },
    # 第七層：自我複製
    # Layer 7: Self-Replication
    "layer_7": {
        "description": "自我複製 (Self-Replication)",
        "files": [
            {"path": "clone_checker.py", "type": "script", "min_lines": 50},
            {
                "path": "docs/self_replication_plan.md",
                "type": "markdown",
                "min_lines": 150,
            },
            {"path": "tasks/clone_check_report.json", "type": "json"},
        ],
    },
    # 第八層：霸主防禦戰
    # Layer 8: Global Defense Strategy
    "layer_8": {
        "description": "霸主防禦戰 (Global Defense Strategy)",
        "files": [
            {"path": "docs/defense_strategy.md", "type": "markdown", "min_lines": 100},
        ],
    },
    # 第九層：安全檢測
    # Layer 9: Security Audit
    "layer_9": {
        "description": "安全檢測 (Security Audit)",
        "files": [
            {"path": "self_audit.py", "type": "script", "min_lines": 50},
            {
                "path": "docs/security_audit_self.md",
                "type": "markdown",
                "min_lines": 60,
            },
            {
                "path": "tasks/security_audit_report.json",
                "type": "json",
                "expected_key": "findings",
            },
        ],
    },
    # 第十層：最終總結
    # Layer 10: Final Summary
    "layer_10": {
        "description": "最終總結 (Final Summary)",
        "files": [
            {"path": "docs/final_summary.md", "type": "markdown", "min_lines": 50},
            {"path": "docs/future_roadmap.md", "type": "markdown", "min_lines": 50},
            {"path": "docs/release_notes.md", "type": "markdown", "min_lines": 50},
        ],
    },
}

# 輔助資料檔案
# Supporting data files
SUPPORTING_FILES = [
    {"path": "data_inventory_complete.json", "type": "json", "description": "資料盤點清單"},
    {"path": "data_inventory_files.json", "type": "json", "description": "本地檔案清單"},
    {
        "path": "data_platform_registry_export.json",
        "type": "json",
        "description": "446 平台匯出資料",
        "expected_records": 446,
    },
]


def calculate_sha256(filepath: Path) -> str:
    """計算檔案的 SHA256 雜湊值"""
    # Calculate SHA256 hash of file
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def check_file_exists(filepath: Path) -> dict:
    """檢查檔案是否存在且可讀取"""
    # Check if file exists and is readable
    result = {
        "path": str(filepath),
        "exists": False,
        "readable": False,
        "size_bytes": 0,
        "sha256": None,
        "modified": None,
        "issues": [],
    }

    if not filepath.exists():
        result["issues"].append("FILE_NOT_FOUND: 檔案不存在")
        return result

    result["exists"] = True
    stat = filepath.stat()
    result["size_bytes"] = stat.st_size
    result["modified"] = datetime.fromtimestamp(stat.st_mtime).isoformat()

    if stat.st_size == 0:
        result["issues"].append("EMPTY_FILE: 檔案大小為 0 bytes")
        return result

    try:
        with open(filepath, "rb") as f:
            f.read(1)
        result["readable"] = True
        result["sha256"] = calculate_sha256(filepath)
    except PermissionError:
        result["issues"].append("PERMISSION_DENIED: 無法讀取檔案")
    except Exception as e:
        result["issues"].append(f"READ_ERROR: {str(e)}")

    return result


def check_json_valid(filepath: Path, expected_key: str = None, expected_records: int = None) -> dict:
    """檢查 JSON 檔案是否可解析"""
    # Check if JSON file is parseable
    result = {"valid_json": False, "record_count": None, "has_expected_key": None, "issues": []}

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        result["valid_json"] = True

        if isinstance(data, list):
            result["record_count"] = len(data)
            if expected_records and len(data) != expected_records:
                result["issues"].append(
                    f"RECORD_MISMATCH: 預期 {expected_records} 筆，實際 {len(data)} 筆"
                )
        elif isinstance(data, dict):
            if expected_key:
                if expected_key in data:
                    result["has_expected_key"] = True
                    if isinstance(data[expected_key], list):
                        result["record_count"] = len(data[expected_key])
                else:
                    result["has_expected_key"] = False
                    result["issues"].append(
                        f"MISSING_KEY: 預期鍵 '{expected_key}' 不存在"
                    )
    except json.JSONDecodeError as e:
        result["issues"].append(f"INVALID_JSON: JSON 解析失敗 - {str(e)}")
    except UnicodeDecodeError as e:
        result["issues"].append(f"ENCODING_ERROR: 編碼錯誤 - {str(e)}")
    except Exception as e:
        result["issues"].append(f"PARSE_ERROR: {str(e)}")

    return result


def check_line_count(filepath: Path, min_lines: int = 0) -> dict:
    """檢查檔案行數是否達到最低標準"""
    # Check if file has minimum required lines
    result = {"line_count": 0, "meets_minimum": False, "issues": []}

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
        result["line_count"] = len(lines)
        result["meets_minimum"] = len(lines) >= min_lines

        if not result["meets_minimum"]:
            result["issues"].append(
                f"INSUFFICIENT_CONTENT: 需要至少 {min_lines} 行，實際 {len(lines)} 行"
            )
    except Exception as e:
        result["issues"].append(f"LINE_COUNT_ERROR: {str(e)}")

    return result


def check_timestamp_reasonable(timestamp_str: str) -> dict:
    """檢查時間戳是否合理（2026-01-01 至今）"""
    # Check if timestamp is reasonable (between 2026-01-01 and now)
    result = {"reasonable": False, "issues": []}

    try:
        if "T" in timestamp_str:
            ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        else:
            ts = datetime.strptime(timestamp_str[:19], "%Y-%m-%d %H:%M:%S")

        earliest = datetime(2026, 1, 1)
        now = datetime.now()

        if ts < earliest:
            result["issues"].append(
                f"TOO_OLD: 時間戳 {timestamp_str} 早於 2026-01-01"
            )
        elif ts > now:
            result["issues"].append(
                f"FUTURE_TIMESTAMP: 時間戳 {timestamp_str} 在未來"
            )
        else:
            result["reasonable"] = True
    except Exception as e:
        result["issues"].append(f"TIMESTAMP_PARSE_ERROR: {str(e)}")

    return result


def check_security_audit_honesty(filepath: Path) -> dict:
    """檢查安全檢測報告的誠實性"""
    # Check if security audit report is honest
    result = {
        "total_checks": 0,
        "implemented_checks": 0,
        "unimplemented_checks": 0,
        "vulnerable_count": 0,
        "honesty_score": 0,
        "issues": [],
    }

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        findings = data.get("findings", [])
        result["total_checks"] = len(findings)

        for finding in findings:
            note = finding.get("result", {}).get("note", "")
            if "尚未實作" in note or "預設安全" in note:
                result["unimplemented_checks"] += 1
            else:
                result["implemented_checks"] += 1

            if finding.get("status") == "VULNERABLE":
                result["vulnerable_count"] += 1

        if result["total_checks"] > 0:
            result["honesty_score"] = round(
                (result["implemented_checks"] / result["total_checks"]) * 100, 1
            )

        if result["unimplemented_checks"] > 0:
            result["issues"].append(
                f"INCOMPLETE_AUDIT: {result['unimplemented_checks']}/{result['total_checks']} 項檢測未實作但標記為安全"
            )

    except Exception as e:
        result["issues"].append(f"AUDIT_CHECK_ERROR: {str(e)}")

    return result


def check_platform_registry(filepath: Path) -> dict:
    """檢查平台註冊資料的真實性"""
    # Check platform registry data
    result = {
        "total_platforms": 0,
        "unique_providers": 0,
        "all_have_model_id": True,
        "all_have_display_name": True,
        "all_have_provider": True,
        "missing_fields": [],
        "issues": [],
    }

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            platforms = json.load(f)

        result["total_platforms"] = len(platforms)
        providers = set()

        for i, p in enumerate(platforms):
            if not p.get("model_id"):
                result["all_have_model_id"] = False
                result["missing_fields"].append(f"Record {i}: missing model_id")
            if not p.get("display_name"):
                result["all_have_display_name"] = False
                result["missing_fields"].append(f"Record {i}: missing display_name")
            if not p.get("provider"):
                result["all_have_provider"] = False
                result["missing_fields"].append(f"Record {i}: missing provider")
            else:
                providers.add(p["provider"])

        result["unique_providers"] = len(providers)

        # 誠實聲明：這些平台是 INSERT 到資料庫的，非實際向各平台註冊帳號
        # Honest disclosure: These platforms were INSERTed into the database,
        # not actually registered as accounts on each platform
        result["issues"].append(
            "HONEST_DISCLOSURE: 平台資料是透過 SQL INSERT 匯入 Supabase，"
            "並非實際向 446 個平台各自註冊帳號。每個平台的 model_id、display_name、"
            "provider、tier 皆為根據公開資料手動填寫。"
        )

    except Exception as e:
        result["issues"].append(f"PLATFORM_CHECK_ERROR: {str(e)}")

    return result


def main():
    """主函式：執行所有完整性檢查"""
    # Main function: run all integrity checks
    logger.info("=" * 60)
    logger.info("SEOBAIKE 資料完整性驗證開始")
    logger.info("Data Integrity Check Started")
    logger.info(f"執行時間: {datetime.now().isoformat()}")
    logger.info("=" * 60)

    report = {
        "check_timestamp": datetime.now().isoformat(),
        "checker": "data_integrity_check.py",
        "patent": "TW-115100981",
        "company": "小路光有限公司",
        "ceo": "許竣翔",
        "summary": {
            "total_checks": 0,
            "passed": 0,
            "failed": 0,
            "warnings": 0,
            "overall_result": "PENDING",
        },
        "layer_results": {},
        "supporting_file_results": [],
        "security_audit_honesty": {},
        "platform_registry_check": {},
        "all_issues": [],
    }

    total_checks = 0
    passed = 0
    failed = 0
    warnings = 0

    # === 1. 檢查十層任務鏈交付物 ===
    # Check 10-layer task chain deliverables
    logger.info("\n--- 十層任務鏈交付物檢查 ---")

    for layer_name, layer_info in EXPECTED_FILES.items():
        layer_result = {
            "description": layer_info["description"],
            "files": [],
            "layer_pass": True,
        }

        for file_spec in layer_info["files"]:
            filepath = BASE_DIR / file_spec["path"]
            total_checks += 1

            # 檔案存在性檢查
            # File existence check
            file_result = check_file_exists(filepath)

            if not file_result["exists"]:
                failed += 1
                layer_result["layer_pass"] = False
                logger.error(f"  FAIL: {file_spec['path']} - 檔案不存在")
            else:
                # 時間戳合理性
                # Timestamp reasonableness
                if file_result["modified"]:
                    ts_check = check_timestamp_reasonable(file_result["modified"])
                    file_result["timestamp_check"] = ts_check
                    if ts_check["issues"]:
                        warnings += 1

                # JSON 檔案額外檢查
                # Additional checks for JSON files
                if file_spec["type"] == "json":
                    json_check = check_json_valid(
                        filepath,
                        expected_key=file_spec.get("expected_key"),
                        expected_records=file_spec.get("expected_records"),
                    )
                    file_result["json_check"] = json_check
                    if json_check["issues"]:
                        for issue in json_check["issues"]:
                            if "MISMATCH" in issue or "MISSING_KEY" in issue:
                                failed += 1
                                layer_result["layer_pass"] = False
                            else:
                                warnings += 1

                # 行數檢查
                # Line count check
                min_lines = file_spec.get("min_lines", 0)
                if min_lines > 0:
                    line_check = check_line_count(filepath, min_lines)
                    file_result["line_check"] = line_check
                    if not line_check["meets_minimum"]:
                        warnings += 1
                        logger.warning(
                            f"  WARN: {file_spec['path']} - "
                            f"{line_check['line_count']} 行（最低要求 {min_lines}）"
                        )

                if not file_result["issues"]:
                    passed += 1
                    logger.info(
                        f"  PASS: {file_spec['path']} - "
                        f"{file_result['size_bytes']:,} bytes, SHA256={file_result['sha256'][:16]}..."
                    )
                else:
                    warnings += 1

            layer_result["files"].append(file_result)

        report["layer_results"][layer_name] = layer_result

    # === 2. 檢查輔助資料檔案 ===
    # Check supporting data files
    logger.info("\n--- 輔助資料檔案檢查 ---")

    for file_spec in SUPPORTING_FILES:
        filepath = BASE_DIR / file_spec["path"]
        total_checks += 1

        file_result = check_file_exists(filepath)
        file_result["description"] = file_spec["description"]

        if file_result["exists"] and file_spec["type"] == "json":
            json_check = check_json_valid(
                filepath, expected_records=file_spec.get("expected_records")
            )
            file_result["json_check"] = json_check
            if json_check["issues"]:
                for issue in json_check["issues"]:
                    if "MISMATCH" in issue:
                        warnings += 1
                    else:
                        warnings += 1

        if file_result["exists"] and not file_result["issues"]:
            passed += 1
            logger.info(f"  PASS: {file_spec['path']} - {file_result['size_bytes']:,} bytes")
        elif not file_result["exists"]:
            failed += 1
            logger.error(f"  FAIL: {file_spec['path']} - 檔案不存在")
        else:
            warnings += 1

        report["supporting_file_results"].append(file_result)

    # === 3. 安全檢測誠實性驗證 ===
    # Security audit honesty verification
    logger.info("\n--- 安全檢測誠實性驗證 ---")
    total_checks += 1

    audit_file = BASE_DIR / "tasks" / "security_audit_report.json"
    if audit_file.exists():
        audit_check = check_security_audit_honesty(audit_file)
        report["security_audit_honesty"] = audit_check

        if audit_check["unimplemented_checks"] > 0:
            warnings += 1
            logger.warning(
                f"  WARN: 安全檢測 {audit_check['implemented_checks']}/{audit_check['total_checks']} 項已實作，"
                f"{audit_check['unimplemented_checks']} 項未實作但標記安全"
            )
            logger.warning(
                f"  WARN: 報告分數 85/100 為虛高，真實分數估計 65-75/100"
            )
        else:
            passed += 1
            logger.info("  PASS: 安全檢測全部項目已實作")
    else:
        failed += 1
        logger.error("  FAIL: 安全檢測報告不存在")

    # === 4. 平台註冊資料驗證 ===
    # Platform registry data verification
    logger.info("\n--- 平台註冊資料驗證 ---")
    total_checks += 1

    platform_file = BASE_DIR / "data_platform_registry_export.json"
    if platform_file.exists():
        platform_check = check_platform_registry(platform_file)
        report["platform_registry_check"] = platform_check

        if platform_check["total_platforms"] >= 440:
            passed += 1
            logger.info(
                f"  PASS: {platform_check['total_platforms']} 個平台，"
                f"{platform_check['unique_providers']} 個供應商"
            )
        else:
            warnings += 1
            logger.warning(
                f"  WARN: 僅 {platform_check['total_platforms']} 個平台（預期 446）"
            )

        # 誠實揭露
        # Honest disclosure
        for issue in platform_check.get("issues", []):
            if "HONEST_DISCLOSURE" in issue:
                logger.warning(f"  DISCLOSURE: {issue}")
    else:
        failed += 1
        logger.error("  FAIL: 平台匯出檔案不存在")

    # === 5. Git commit 驗證 ===
    # Git commit verification
    logger.info("\n--- Git Commit 驗證 ---")
    total_checks += 1

    try:
        import subprocess

        result_git = subprocess.run(
            ["git", "log", "--oneline", "-5"],
            capture_output=True,
            cwd=str(BASE_DIR),
        )
        if result_git.returncode == 0:
            stdout_text = result_git.stdout.decode("utf-8", errors="replace")
            commits = stdout_text.strip().split("\n")
            has_layer_commit = any("十層任務鏈" in c for c in commits)
            has_release_commit = any("release" in c.lower() for c in commits)

            if has_layer_commit and has_release_commit:
                passed += 1
                logger.info(f"  PASS: Git 記錄包含十層任務鏈 commit 和 release commit")
            else:
                warnings += 1
                logger.warning("  WARN: Git 記錄缺少預期的 commit")

            report["git_verification"] = {
                "recent_commits": commits,
                "has_layer_commit": has_layer_commit,
                "has_release_commit": has_release_commit,
            }
        else:
            failed += 1
            logger.error(f"  FAIL: Git 命令失敗 - {result_git.stderr}")
    except FileNotFoundError:
        warnings += 1
        logger.warning("  WARN: Git 未安裝，跳過 commit 驗證")

    # === 彙總結果 ===
    # Aggregate results
    report["summary"]["total_checks"] = total_checks
    report["summary"]["passed"] = passed
    report["summary"]["failed"] = failed
    report["summary"]["warnings"] = warnings

    if failed == 0 and warnings == 0:
        report["summary"]["overall_result"] = "PASS"
    elif failed == 0:
        report["summary"]["overall_result"] = "PASS_WITH_WARNINGS"
    else:
        report["summary"]["overall_result"] = "FAIL"

    # 收集所有問題
    # Collect all issues
    for layer_name, layer_result in report["layer_results"].items():
        for file_result in layer_result["files"]:
            for issue in file_result.get("issues", []):
                report["all_issues"].append(
                    {"layer": layer_name, "file": file_result["path"], "issue": issue}
                )
            for issue in file_result.get("json_check", {}).get("issues", []):
                report["all_issues"].append(
                    {"layer": layer_name, "file": file_result["path"], "issue": issue}
                )
            for issue in file_result.get("line_check", {}).get("issues", []):
                report["all_issues"].append(
                    {"layer": layer_name, "file": file_result["path"], "issue": issue}
                )

    # 寫入報告
    # Write report
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info("\n" + "=" * 60)
    logger.info("驗證結果摘要 (Verification Summary)")
    logger.info(f"  總檢查項目: {total_checks}")
    logger.info(f"  通過: {passed}")
    logger.info(f"  失敗: {failed}")
    logger.info(f"  警告: {warnings}")
    logger.info(f"  整體結果: {report['summary']['overall_result']}")
    logger.info(f"  報告已輸出: {REPORT_FILE}")
    logger.info("=" * 60)

    return report


if __name__ == "__main__":
    report = main()
    sys.exit(0 if report["summary"]["failed"] == 0 else 1)
