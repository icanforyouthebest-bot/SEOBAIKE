import json
import sys

class MockVectorDB:
    def __init__(self):
        self.knowledge_base = [
            {"id": 1, "content": "SEO百科業務規則：所有 Python 腳本必須包含錯誤處理。"},
            {"id": 2, "content": "財務規範：單筆支出超過 10,000 元需經由 Finance Agent 核准。"},
            {"id": 3, "content": "架構原則：禁止 Master Agent 直接執行運算，必須委派給 Core Logic。"},
            {"id": 4, "content": "部署流程：每週五下午 5 點禁止進行生產環境更新。"}
        ]

    def search(self, query):
        results = []
        for item in self.knowledge_base:
            score = 0
            if query in item["content"]:
                score = 0.95
            if score > 0:
                results.append({"id": item["id"], "content": item["content"], "score": score})
        return results

if __name__ == "__main__":
    try:
        query = sys.argv[1] if len(sys.argv) > 1 else "財務"
        db = MockVectorDB()
        results = db.search(query)
        response = {
            "status": "success",
            "query": query,
            "engine": "NVIDIA_Simulated_Vector_Engine",
            "results": results
        }
        print(json.dumps(response, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
