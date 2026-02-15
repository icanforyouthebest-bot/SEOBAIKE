"""
SEOBAIKE 任務監工 — 第三層：模擬執行 + 監控 + 重試
創辦人指令：五層任務鏈
"""
import json
import random  # unsafe-random-ok: simulation only (latency, tokens, success rate)
import time
from datetime import datetime


def simulate_execution(task):
    """模擬 AI 執行任務"""
    api = task.get("external_api")
    priority = task.get("priority", "medium")

    # 根據優先級和 API 類型決定成功率
    base_success_rate = 0.85
    if priority == "high":
        base_success_rate = 0.90
    elif priority == "low":
        base_success_rate = 0.80

    if api in ["seobaike-gpu", "seobaike-guardrails"]:
        base_success_rate = 0.95  # SEOBAIKE GPU 指揮官級最穩定
    elif api in ["seobaike-ai-text"]:
        base_success_rate = 0.90

    # 模擬延遲
    latency_ms = random.randint(200, 8000)
    if api and "seobaike-gpu" in api:
        latency_ms = random.randint(100, 3000)  # SEOBAIKE GPU 最快

    # 模擬 token 消耗
    tokens_used = random.randint(
        int(task.get("estimated_tokens", 1000) * 0.5),
        int(task.get("estimated_tokens", 1000) * 1.5),
    )

    success = random.random() < base_success_rate
    error_msg = None if success else random.choice([
        "API 超時", "Token 配額不足", "模型回應格式錯誤",
        "網路連線中斷", "認證失敗", "Rate limit exceeded",
    ])

    return {
        "success": success,
        "latency_ms": latency_ms,
        "tokens_used": tokens_used,
        "error": error_msg,
    }


def execute_all_tasks():
    with open("tasks/assignment_report.json", "r", encoding="utf-8") as f:
        report = json.load(f)

    all_results = []
    total_tokens = 0
    total_time_ms = 0
    success_count = 0
    fail_count = 0
    retry_success = 0
    retry_fail = 0
    error_log = []

    for legion_name, tasks in report["assignments"].items():
        for task in tasks:
            # 第一次執行
            result = simulate_execution(task)
            total_tokens += result["tokens_used"]
            total_time_ms += result["latency_ms"]

            if result["success"]:
                success_count += 1
                status = "success"
            else:
                # 重試一次
                retry_result = simulate_execution(task)
                total_tokens += retry_result["tokens_used"]
                total_time_ms += retry_result["latency_ms"]

                if retry_result["success"]:
                    retry_success += 1
                    success_count += 1
                    status = "success_after_retry"
                    result = retry_result
                else:
                    retry_fail += 1
                    fail_count += 1
                    status = "failed"
                    error_log.append({
                        "task_id": task["task_id"],
                        "task_number": task["task_number"],
                        "description": task["description"],
                        "assigned_to": legion_name,
                        "first_error": result["error"],
                        "retry_error": retry_result["error"],
                        "timestamp": datetime.now().isoformat(),
                    })

            all_results.append({
                "task_id": task["task_id"],
                "task_number": task["task_number"],
                "description": task["description"],
                "assigned_to": legion_name,
                "status": status,
                "latency_ms": result["latency_ms"],
                "tokens_used": result["tokens_used"],
                "error": result.get("error"),
                "executed_at": datetime.now().isoformat(),
            })

    execution_report = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "executor": "SEOBAIKE monitor_tasks.py",
            "patent": "TW-115100981",
        },
        "summary": {
            "total_tasks": len(all_results),
            "success": success_count,
            "failed": fail_count,
            "retry_success": retry_success,
            "retry_failed": retry_fail,
            "success_rate": round(success_count / len(all_results) * 100, 1),
            "total_tokens": total_tokens,
            "total_time_ms": total_time_ms,
            "avg_latency_ms": round(total_time_ms / len(all_results)),
        },
        "results": all_results,
        "error_log": error_log,
    }

    with open("tasks/execution_report.json", "w", encoding="utf-8") as f:
        json.dump(execution_report, f, ensure_ascii=False, indent=2)

    s = execution_report["summary"]
    print("=== 任務執行監控完成 ===")
    print(f"總任務: {s['total_tasks']}")
    print(f"成功: {s['success']} | 失敗: {s['failed']}")
    print(f"重試成功: {s['retry_success']} | 重試仍失敗: {s['retry_failed']}")
    print(f"成功率: {s['success_rate']}%")
    print(f"總 Token: {s['total_tokens']:,}")
    print(f"總耗時: {s['total_time_ms']:,}ms")
    print(f"平均延遲: {s['avg_latency_ms']}ms")
    print(f"錯誤記錄: {len(error_log)} 筆")
    print(f"輸出: tasks/execution_report.json")


if __name__ == "__main__":
    execute_all_tasks()
