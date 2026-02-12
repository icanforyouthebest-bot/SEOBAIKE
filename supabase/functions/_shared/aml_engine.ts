type Transaction = {
  id: string;
  amount_cents: number;
  created_at: string;
  [key: string]: unknown;
};

type AmlRule = {
  id: string;
  code: string;
  threshold_amount: number | null;
  threshold_count: number | null;
  time_window_hours: number | null;
  severity: string;
};

type AmlAlert = {
  rule_id: string;
  count: number;
  transactions: Transaction[];
};

export function evaluateAmlRules(
  transactions: Transaction[],
  rules: AmlRule[]
): AmlAlert[] {
  const alerts: AmlAlert[] = [];

  for (const rule of rules) {
    const matched = transactions.filter((t) => {
      if (rule.threshold_amount && t.amount_cents >= rule.threshold_amount)
        return true;

      return false;
    });

    if (matched.length > 0) {
      alerts.push({
        rule_id: rule.id,
        count: matched.length,
        transactions: matched
      });
    }
  }

  return alerts;
}
