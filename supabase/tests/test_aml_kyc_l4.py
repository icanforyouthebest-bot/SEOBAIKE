"""
AML/KYC 單元測試（L4）
對應 TypeScript shared modules:
  - _shared/aml_monitoring.ts (monitorTransaction)
  - _shared/kyc_verification.ts (verifyCustomerIdentity)
此為微軟提供之測試規格，實際模組為 TypeScript。
"""

import unittest
from aml_l3_transaction_monitoring_rule import monitorTransaction, Transaction
from kyc_l3_verification_rule import verifyCustomerIdentity, CustomerIdentity


class TestAML(unittest.TestCase):
    def test_large_transaction(self):
        tx = Transaction(
            transactionId='T001',
            customerId='C001',
            amount=600000,
            currency='TWD',
            date='2026-02-11',
            type='Deposit',
            channel='Branch'
        )
        result = monitorTransaction(tx)
        self.assertTrue(result.suspicious)
        self.assertEqual(result.reason, '單筆金額超過五十萬元')


class TestKYC(unittest.TestCase):
    def test_identity_missing(self):
        identity = CustomerIdentity(
            name='',
            idNumber='A123456789',
            birthDate='1990-01-01',
            nationality='TW',
            address='台北市',
            documentType='ID',
            documentNumber='',
            documentExpiry='2027-01-01'
        )
        result = verifyCustomerIdentity(identity)
        self.assertFalse(result.passed)
        self.assertEqual(result.reason, '缺少必要身份資料')


if __name__ == '__main__':
    unittest.main()
