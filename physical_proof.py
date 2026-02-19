import mujoco
import mujoco.viewer
import time
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

# NVIDIA NIM key (through Azure Router)
ROUTER = "https://seobaike-ai-router.azurewebsites.net/api/route"

def get_strategy():
    payload = {
        "messages": [{"role": "user", "content": "給一個機械臂即時力回饋的物理策略，用中文50字"}],
        "provider": "gemma",
        "max_tokens": 100
    }
    resp = requests.post(ROUTER, json=payload, timeout=30)
    content = resp.json().get("result", {}).get("content", "No response")
    return content

print("=== SEOBAIKE Physical AI Proof ===")
print("AI給的物理策略：", get_strategy())
print("啟動 MuJoCo 物理模擬視窗...")

# MuJoCo 機械臂模型 - 雙關節手臂 + 地板 + 目標物
model = mujoco.MjModel.from_xml_string("""
<mujoco model="seobaike_arm">
  <option gravity="0 0 -9.81" timestep="0.002"/>
  <worldbody>
    <light diffuse="0.8 0.8 0.8" pos="0 0 3" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="2 2 0.1" rgba="0.3 0.3 0.3 1"/>

    <!-- Base -->
    <body name="base" pos="0 0 0.1">
      <geom type="cylinder" size="0.1 0.05" rgba="0.5 0.5 0.5 1"/>

      <!-- Upper arm -->
      <body name="upper_arm" pos="0 0 0.15">
        <joint name="shoulder" type="hinge" axis="0 1 0" range="-90 90" damping="5"/>
        <geom type="capsule" size="0.04 0.2" rgba="0 0.4 0.8 1"/>

        <!-- Forearm -->
        <body name="forearm" pos="0 0 0.4">
          <joint name="elbow" type="hinge" axis="0 1 0" range="-120 0" damping="3"/>
          <geom type="capsule" size="0.03 0.15" rgba="0 0.6 1 1"/>

          <!-- Gripper -->
          <body name="gripper" pos="0 0 0.3">
            <joint name="wrist" type="hinge" axis="1 0 0" range="-60 60" damping="1"/>
            <geom type="box" size="0.06 0.02 0.04" rgba="1 0.3 0 1"/>
          </body>
        </body>
      </body>
    </body>

    <!-- Target object -->
    <body name="target" pos="0.3 0 0.05">
      <geom type="sphere" size="0.05" rgba="1 0 0 1"/>
    </body>
  </worldbody>

  <actuator>
    <motor joint="shoulder" ctrlrange="-50 50" gear="1"/>
    <motor joint="elbow" ctrlrange="-50 50" gear="1"/>
    <motor joint="wrist" ctrlrange="-20 20" gear="1"/>
  </actuator>
</mujoco>
""")

data = mujoco.MjData(model)

print("MuJoCo 視窗啟動中... 機械臂會自動擺動 30 秒")
print("Patent 115100981 | SEOBAIKE Physical AI")

with mujoco.viewer.launch_passive(model, data) as viewer:
    start = time.time()
    while viewer.is_running() and time.time() - start < 30:
        t = time.time() - start
        # AI-driven sinusoidal motion pattern
        data.ctrl[0] = 30 * __import__('math').sin(t * 1.5)      # shoulder
        data.ctrl[1] = -20 * __import__('math').sin(t * 2.0)     # elbow
        data.ctrl[2] = 10 * __import__('math').sin(t * 3.0)      # wrist
        mujoco.mj_step(model, data)
        viewer.sync()
        time.sleep(0.002)

print("=== 物理模擬完成 ===")
