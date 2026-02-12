"""
SCA/SBOM 掃描腳本（L4）
微軟提供之軟體組成分析與 SBOM 生成參考。
"""

import subprocess


def run_sca_scan():
    print("執行 OpenSCA 掃描...")
    subprocess.run(['opensca-cli', '--path', '.', '--output', 'sca_report.html'])


def run_sbom_generation():
    print("生成 SBOM...")
    subprocess.run(['sbom-tool', 'generate', '--input', '.', '--output', 'sbom.json'])


if __name__ == '__main__':
    run_sca_scan()
    run_sbom_generation()
