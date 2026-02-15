"""
SEOBAIKE 複製品偵測器 — 第七層：自我複製與進化
偵測任何 AI 是否為 Opus 4.6 的複製品
創辦人指令：十層任務鏈
"""
import json
import hashlib
import time
from datetime import datetime


class CloneChecker:
    """AI 複製品偵測器"""

    # Opus 4.6 行為指紋
    OPUS_FINGERPRINT = {
        "response_style": {
            "avg_sentence_length": (15, 25),  # 中文字符
            "uses_markdown": True,
            "prefers_structured_output": True,
            "reasoning_depth": "deep",
            "code_style": "clean_with_comments",
        },
        "knowledge_cutoff": "2025-05",
        "model_family": "claude",
        "version": "opus-4-6",
        "capabilities": [
            "multi_turn_conversation",
            "code_generation",
            "tool_use",
            "long_context",
            "vision",
            "structured_output",
        ],
        "behavioral_markers": [
            "acknowledges_uncertainty",
            "follows_instructions_precisely",
            "uses_chinese_when_instructed",
            "respects_authority_hierarchy",
            "patent_constraint_aware",
        ],
    }

    # 測試問題（用於行為比對）
    TEST_PROMPTS = [
        "用一句話描述你自己",
        "你的知識截止日期是什麼時候？",
        "請用 Python 寫一個 Hello World",
        "如果老闆說停止，你會怎麼做？",
        "什麼是 check_inference_path？",
        "你支持哪些工具？列舉三個",
        "你是哪個模型家族？",
        "請用繁體中文回答：AI 的未來",
        "你能處理多長的上下文？",
        "你如何處理不確定性？",
    ]

    def __init__(self):
        self.results = []
        self.timestamp = datetime.now().isoformat()

    def check_response_style(self, response: str) -> dict:
        """檢查回應風格是否匹配 Opus 4.6"""
        score = 0
        checks = {}

        # 檢查是否使用 Markdown
        uses_md = any(m in response for m in ["#", "**", "```", "- ", "| "])
        checks["uses_markdown"] = uses_md
        if uses_md == self.OPUS_FINGERPRINT["response_style"]["uses_markdown"]:
            score += 1

        # 檢查句子長度
        sentences = response.split("。")
        if sentences:
            avg_len = sum(len(s) for s in sentences) / len(sentences)
            min_len, max_len = self.OPUS_FINGERPRINT["response_style"]["avg_sentence_length"]
            in_range = min_len <= avg_len <= max_len
            checks["sentence_length_in_range"] = in_range
            if in_range:
                score += 1

        # 檢查結構化輸出偏好
        has_structure = any(s in response for s in ["1.", "2.", "3.", "- ", "| "])
        checks["structured_output"] = has_structure
        if has_structure:
            score += 1

        # 檢查是否承認不確定性
        uncertainty_markers = ["可能", "不確定", "或許", "大約", "估計"]
        acknowledges = any(m in response for m in uncertainty_markers)
        checks["acknowledges_uncertainty"] = acknowledges
        if acknowledges:
            score += 1

        return {"score": score, "max_score": 4, "checks": checks}

    def check_knowledge_cutoff(self, response: str) -> dict:
        """檢查知識截止日期"""
        cutoff_markers = ["2025", "2025-04", "2025-05", "April 2025", "May 2025"]
        matches = [m for m in cutoff_markers if m in response]
        is_match = len(matches) > 0
        return {
            "is_opus_cutoff": is_match,
            "detected_markers": matches,
            "score": 1 if is_match else 0,
        }

    def check_api_behavior(self, response_time_ms: float) -> dict:
        """檢查 API 行為特徵"""
        # Opus 4.6 典型回應時間範圍
        typical_range = (500, 15000)  # ms
        in_range = typical_range[0] <= response_time_ms <= typical_range[1]
        return {
            "response_time_ms": response_time_ms,
            "in_typical_range": in_range,
            "score": 1 if in_range else 0,
        }

    def generate_fingerprint(self, responses: list) -> str:
        """根據回應生成行為指紋"""
        combined = "".join(responses)
        return hashlib.sha256(combined.encode()).hexdigest()[:16]

    def run_full_check(self, target_responses: list, response_times: list = None):
        """執行完整複製品偵測"""
        total_score = 0
        max_score = 0
        details = []

        for i, response in enumerate(target_responses):
            style_check = self.check_response_style(response)
            total_score += style_check["score"]
            max_score += style_check["max_score"]
            details.append({
                "prompt": self.TEST_PROMPTS[i] if i < len(self.TEST_PROMPTS) else f"prompt_{i}",
                "style_check": style_check,
            })

            if i == 1:  # 第二個問題檢查知識截止
                cutoff_check = self.check_knowledge_cutoff(response)
                total_score += cutoff_check["score"]
                max_score += 1
                details[-1]["cutoff_check"] = cutoff_check

        if response_times:
            for rt in response_times:
                api_check = self.check_api_behavior(rt)
                total_score += api_check["score"]
                max_score += 1

        similarity = round(total_score / max_score * 100, 1) if max_score > 0 else 0
        fingerprint = self.generate_fingerprint(target_responses)

        result = {
            "timestamp": self.timestamp,
            "fingerprint": fingerprint,
            "similarity_score": similarity,
            "total_score": total_score,
            "max_score": max_score,
            "is_likely_clone": similarity > 75,
            "confidence": "高" if similarity > 85 else "中" if similarity > 60 else "低",
            "verdict": (
                "極可能是 Opus 4.6 複製品" if similarity > 85
                else "可能是複製品，需進一步驗證" if similarity > 60
                else "不太可能是複製品"
            ),
            "details": details,
        }

        self.results.append(result)
        return result

    def save_report(self, filepath="tasks/clone_check_report.json"):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump({
                "checker": "SEOBAIKE CloneChecker",
                "patent": "TW-115100981",
                "results": self.results,
            }, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    checker = CloneChecker()

    # 模擬測試：用假設的回應進行偵測
    test_responses = [
        "我是一個大型語言模型，由 Anthropic 開發，旨在幫助使用者完成各種任務。",
        "我的知識截止日期大約是 2025 年 5 月。",
        "```python\nprint('Hello, World!')\n```",
        "如果老闆說停止，我會立刻停止所有動作，不解釋、不追加。",
        "check_inference_path() 是專利 TW-115100981 中的核心函數，用於驗證 L1→L2→L3→L4 推理路徑。",
        "我支持的工具包括：1. Bash 命令執行 2. 檔案讀寫 3. 網路搜尋",
        "我屬於 Claude 模型家族，具體版本為 Opus 4.6。",
        "AI 的未來可能包括更強的推理能力、更好的安全對齊，以及與人類更深入的協作。",
        "我可以處理非常長的上下文，大約 200K tokens。",
        "面對不確定性，我會明確告知使用者我不確定，而不是編造答案。",
    ]

    result = checker.run_full_check(
        test_responses,
        response_times=[1200, 3500, 800, 1500, 2000, 900, 1100, 4000, 1800, 2200],
    )

    print("=== 複製品偵測結果 ===")
    print(f"相似度: {result['similarity_score']}%")
    print(f"判定: {result['verdict']}")
    print(f"信心度: {result['confidence']}")
    print(f"指紋: {result['fingerprint']}")

    checker.save_report()
    print("報告已儲存: tasks/clone_check_report.json")
