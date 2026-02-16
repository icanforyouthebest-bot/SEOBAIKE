import sys
import os
import subprocess
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = {
    "1": ("Grok 智能指令 (Grok Brain)", os.path.join(BASE_DIR, "Grok_Command_Center", "grok_brain.py")),
    "2": ("自動化工作流 (DAG Scheduler)", os.path.join(BASE_DIR, "Workflow_Engine", "DAG_Scheduler", "simple_scheduler.py")),
    "3": ("跨代理協作 (Orchestrator)", os.path.join(BASE_DIR, "Grok_Command_Center", "orchestrator.py")),
    "4": ("人工審核台 (Review Console)", os.path.join(BASE_DIR, "Execution_Layer", "Human_Feedback", "console_review.py")),
    "5": ("模型自我訓練 (GPU Training)", os.path.join(BASE_DIR, "NVIDIA_Infra", "GPU_Config", "train_model.py")),
    "6": ("系統健檢 (System Status)", os.path.join(BASE_DIR, "system_status.py")),
}

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    print("+" + "-" * 58 + "+")
    print("|   SEOBAIKE SYSTEM ARCHITECTURE 2.0 - COMMAND CENTER    |")
    print("+" + "-" * 58 + "+")
    print("   [核心狀態]: ONLINE   [代理數量]: 7   [GPU]: READY")
    print("-" * 58)

def run_module(script_path):
    print(f"\n>> 正在啟動模組: {os.path.basename(script_path)}...")
    time.sleep(0.5)
    try:
        subprocess.run([sys.executable, script_path], check=True)
        input("\n[按 Enter 鍵返回主選單]")
    except subprocess.CalledProcessError:
        print("\n!!! 模組執行發生錯誤 !!!")
        input("[按 Enter 鍵返回主選單]")
    except KeyboardInterrupt:
        print("\n操作已取消。")

def main():
    while True:
        clear_screen()
        print_header()

        for key, (name, _) in SCRIPTS.items():
            print(f"   [{key}] {name}")
        print("   [Q] 關機 (Shutdown)")

        print("-" * 58)
        choice = input("請輸入指令編號: ").strip().upper()

        if choice == "Q":
            print("\n系統正在關閉... Goodbye.")
            break

        if choice in SCRIPTS:
            _, script_path = SCRIPTS[choice]
            run_module(script_path)
        else:
            pass

if __name__ == "__main__":
    main()
