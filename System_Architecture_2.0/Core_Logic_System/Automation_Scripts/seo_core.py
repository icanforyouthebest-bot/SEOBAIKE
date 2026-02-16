import sys
import json
import itertools

def generate_content_matrix(data):
    root_keyword = data.get("root_keyword", "")
    modifiers = data.get("modifiers", [])
    locations = data.get("locations", [])

    generated_titles = []

    if not locations:
        locations = ["全台"]

    for loc in locations:
        for mod in modifiers:
            title = f"{loc}{root_keyword} - {mod}懶人包 (2026最新版)"
            slug = f"{loc}-{root_keyword}-{mod}"

            item = {
                "h1_title": title,
                "slug": slug,
                "meta_description": f"正在尋找{loc}的{root_keyword}嗎？這裡整理了最完整的{mod}資訊...",
                "category": root_keyword
            }
            generated_titles.append(item)

    return {
        "status": "success",
        "module": "Core_Logic_System/SEO_Engine",
        "total_generated": len(generated_titles),
        "matrix_sample": generated_titles[:3]
    }

if __name__ == "__main__":
    try:
        default_input = {
            "root_keyword": "手沖咖啡",
            "modifiers": ["推薦", "課程", "器具"],
            "locations": ["台北", "台中", "高雄"]
        }

        input_args = sys.argv[1] if len(sys.argv) > 1 else json.dumps(default_input)
        data = json.loads(input_args)

        result = generate_content_matrix(data)
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
