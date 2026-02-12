"""
稽核與異常通報腳本（L4）
微軟提供之 Email 通報參考實作。
實際 SEOBAIKE 異常通報透過 Edge Function + webhook。
"""

import datetime
import smtplib
from email.mime.text import MIMEText


def send_incident_report(subject, body, to_emails):
    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = 'audit@company.com'
    msg['To'] = ', '.join(to_emails)
    with smtplib.SMTP('smtp.company.com') as server:
        server.login('audit@company.com', 'password')
        server.sendmail('audit@company.com', to_emails, msg.as_string())


def report_incident(event_type, details):
    timestamp = datetime.datetime.utcnow().isoformat()
    subject = f'異常通報：{event_type}'
    body = f'時間：{timestamp}\n事件類型：{event_type}\n詳情：{details}'
    to_emails = ['compliance@company.com', 'aml@company.com']
    send_incident_report(subject, body, to_emails)


# 範例：通報一次 AML 系統異常
if __name__ == '__main__':
    report_incident('AML 系統異常', '交易監控模組無法連接資料庫，請即時處理。')
