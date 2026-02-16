import sys
import json

def calculate_net_revenue(data):
    revenue = data.get("revenue", 0)
    cost = data.get("cost", 0)

    gross_profit = revenue - cost

    tax_rate = 0.20 if revenue > 10000 else 0.05
    tax_amount = revenue * tax_rate
    net_profit = gross_profit - tax_amount

    return {
        "status": "success",
        "input_revenue": revenue,
        "tax_rate_applied": f"{tax_rate*100}%",
        "net_profit": round(net_profit, 2),
        "module": "Core_Logic_System/Finance"
    }

if __name__ == "__main__":
    try:
        input_args = sys.argv[1] if len(sys.argv) > 1 else '{"revenue": 15000, "cost": 5000}'
        data = json.loads(input_args)
        result = calculate_net_revenue(data)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
