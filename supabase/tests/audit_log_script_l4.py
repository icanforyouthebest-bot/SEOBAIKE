"""
合規稽核記錄腳本（L4）
微軟提供之 Python 參考實作。
實際稽核記錄寫入 Supabase audit_log 表（透過 Edge Function）。
"""

import datetime
import json


def log_audit_event(event_type, user_id, details):
    record = {
        'timestamp': datetime.datetime.utcnow().isoformat(),
        'event_type': event_type,
        'user_id': user_id,
        'details': details
    }
    with open('audit_log.json', 'a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')


# 範例：記錄一次 AML 可疑交易申報
if __name__ == '__main__':
    log_audit_event(
        event_type='STR_Submission',
        user_id='aml_officer_001',
        details={
            'transaction_id': 'T001',
            'reason': '單筆金額超過五十萬元'
        }
    )
