export interface Transaction {
  transactionId: string;
  customerId: string;
  amount: number;
  currency: string;
  date: string;
  type: "Deposit" | "Withdrawal" | "Transfer" | "Payment";
  counterparty?: string;
  channel: "Branch" | "Online" | "ATM" | "Mobile";
}

export interface MonitoringResult {
  suspicious: boolean;
  reason?: string;
}

export function monitorTransaction(tx: Transaction): MonitoringResult {
  // 大額交易監控（NT$500,000）
  if (tx.amount >= 500000) {
    return { suspicious: true, reason: "單筆金額超過五十萬元" };
  }
  // 可疑對手方（制裁名單）
  if (tx.counterparty && tx.counterparty === "制裁名單") {
    return { suspicious: true, reason: "交易對象為制裁名單" };
  }
  return { suspicious: false };
}
