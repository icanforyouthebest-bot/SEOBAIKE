import mujoco
import mujoco.viewer
import time
import math
import requests
import sys
import subprocess
sys.stdout.reconfigure(encoding='utf-8')

# NVIDIA NIM AI strategy
ROUTER = "https://seobaike-ai-router.azurewebsites.net/api/route"

print("=== SEOBAIKE Physical AI - Finance Robot Demo ===")
print("Patent 115100981 | Commander: Hsu Chun-Hsiang\n")

# Ask AI for physical strategy
try:
    payload = {"messages": [{"role": "user", "content": "給一個金融機構機械臂處理文件的力回饋策略，包含抓取力道、移動速度、安全距離。用數字回答，50字。"}], "provider": "gemma", "max_tokens": 100}
    resp = requests.post(ROUTER, json=payload, timeout=30)
    strategy = resp.json().get("result", {}).get("content", "default strategy")
    print(f"AI Strategy: {strategy}\n")
except:
    print("AI offline, using default strategy\n")

# Advanced robot arm model - document handling arm for bank
model = mujoco.MjModel.from_xml_string("""
<mujoco model="seobaike_finance_arm">
  <option gravity="0 0 -9.81" timestep="0.002"/>

  <asset>
    <material name="steel" rgba="0.6 0.6 0.65 1"/>
    <material name="blue" rgba="0.1 0.3 0.8 1"/>
    <material name="red" rgba="0.8 0.1 0.1 1"/>
    <material name="green" rgba="0.1 0.7 0.2 1"/>
    <material name="gold" rgba="0.85 0.65 0.13 1"/>
    <material name="paper" rgba="0.95 0.95 0.9 1"/>
  </asset>

  <worldbody>
    <light diffuse="0.9 0.9 0.9" pos="0 0 4" dir="0 0 -1"/>
    <light diffuse="0.3 0.3 0.4" pos="2 2 3" dir="-1 -1 -1"/>

    <!-- Floor (bank counter) -->
    <geom name="counter" type="box" size="1.5 1 0.02" pos="0 0 0.4" material="steel"/>
    <geom name="floor" type="plane" size="3 3 0.1" rgba="0.2 0.2 0.25 1"/>

    <!-- Document stack (to pick up) -->
    <body name="doc1" pos="-0.5 0 0.44">
      <freejoint/>
      <geom type="box" size="0.1 0.07 0.005" mass="0.05" material="paper"/>
    </body>
    <body name="doc2" pos="-0.5 0.02 0.45">
      <freejoint/>
      <geom type="box" size="0.1 0.07 0.005" mass="0.05" rgba="0.9 0.9 0.85 1"/>
    </body>

    <!-- Scanner zone (target) -->
    <geom name="scanner" type="box" size="0.15 0.1 0.03" pos="0.5 0 0.43" material="green"/>

    <!-- Cash box -->
    <geom name="cashbox" type="box" size="0.12 0.08 0.06" pos="0 -0.4 0.46" material="gold"/>

    <!-- Robot base -->
    <body name="base" pos="0 0.3 0.42">
      <geom type="cylinder" size="0.08 0.03" material="steel"/>

      <!-- Turret -->
      <body name="turret" pos="0 0 0.06">
        <joint name="base_rotate" type="hinge" axis="0 0 1" range="-180 180" damping="8"/>
        <geom type="cylinder" size="0.06 0.04" material="blue"/>

        <!-- Upper arm -->
        <body name="upper_arm" pos="0 0 0.08">
          <joint name="shoulder" type="hinge" axis="0 1 0" range="-90 90" damping="5"/>
          <geom type="capsule" size="0.035 0.18" material="blue"/>

          <!-- Forearm -->
          <body name="forearm" pos="0 0 0.36">
            <joint name="elbow" type="hinge" axis="0 1 0" range="-130 0" damping="4"/>
            <geom type="capsule" size="0.03 0.14" material="blue"/>

            <!-- Wrist -->
            <body name="wrist_body" pos="0 0 0.28">
              <joint name="wrist" type="hinge" axis="1 0 0" range="-90 90" damping="2"/>
              <geom type="cylinder" size="0.025 0.02" material="steel"/>

              <!-- Gripper left -->
              <body name="grip_l" pos="-0.03 0 0.04">
                <joint name="grip_left" type="slide" axis="1 0 0" range="-0.01 0.03" damping="1"/>
                <geom type="box" size="0.008 0.015 0.03" material="red"/>
              </body>
              <!-- Gripper right -->
              <body name="grip_r" pos="0.03 0 0.04">
                <joint name="grip_right" type="slide" axis="1 0 0" range="-0.03 0.01" damping="1"/>
                <geom type="box" size="0.008 0.015 0.03" material="red"/>
              </body>
            </body>
          </body>
        </body>
      </body>
    </body>
  </worldbody>

  <actuator>
    <motor joint="base_rotate" ctrlrange="-30 30" gear="1"/>
    <motor joint="shoulder" ctrlrange="-40 40" gear="1"/>
    <motor joint="elbow" ctrlrange="-40 40" gear="1"/>
    <motor joint="wrist" ctrlrange="-15 15" gear="1"/>
    <motor joint="grip_left" ctrlrange="-5 5" gear="1"/>
    <motor joint="grip_right" ctrlrange="-5 5" gear="1"/>
  </actuator>
</mujoco>
""")

data = mujoco.MjData(model)

print("MuJoCo window launching... Bank document handling robot")
print("6-axis arm + gripper | 30 second demo\n")

with mujoco.viewer.launch_passive(model, data) as viewer:
    start = time.time()
    while viewer.is_running() and time.time() - start < 30:
        t = time.time() - start

        # Phase 1: Rotate to document stack (0-5s)
        if t < 5:
            data.ctrl[0] = -15 * math.sin(t * 0.6)  # base rotate
            data.ctrl[1] = 20 * math.sin(t * 0.8)    # shoulder down
            data.ctrl[2] = -15 * math.sin(t * 0.5)   # elbow
            data.ctrl[4] = 2   # gripper open
            data.ctrl[5] = -2
        # Phase 2: Grab document (5-10s)
        elif t < 10:
            data.ctrl[0] = -10
            data.ctrl[1] = 25
            data.ctrl[2] = -20
            data.ctrl[3] = 5 * math.sin((t-5) * 2)
            data.ctrl[4] = -3  # gripper close
            data.ctrl[5] = 3
        # Phase 3: Move to scanner (10-20s)
        elif t < 20:
            phase = (t - 10) / 10
            data.ctrl[0] = -10 + 25 * phase  # rotate to scanner
            data.ctrl[1] = 25 - 10 * phase
            data.ctrl[2] = -20 + 5 * phase
            data.ctrl[3] = 3 * math.sin(t * 1.5)
            data.ctrl[4] = -3  # keep gripping
            data.ctrl[5] = 3
        # Phase 4: Release at scanner (20-25s)
        elif t < 25:
            data.ctrl[0] = 15
            data.ctrl[1] = 15
            data.ctrl[2] = -15
            data.ctrl[4] = 2   # gripper open
            data.ctrl[5] = -2
        # Phase 5: Return home (25-30s)
        else:
            phase = (t - 25) / 5
            data.ctrl[0] = 15 * (1 - phase)
            data.ctrl[1] = 15 * (1 - phase)
            data.ctrl[2] = -15 * (1 - phase)
            data.ctrl[4] = 0
            data.ctrl[5] = 0

        mujoco.mj_step(model, data)
        viewer.sync()
        time.sleep(0.002)

print("\n=== Physical AI Demo Complete ===")
print("Bank document robot: pick -> move -> scan -> return")
print("Patent 115100981 | SEOBAIKE Physical AI")
