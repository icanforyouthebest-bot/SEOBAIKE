export interface RiskFactor {
  region: string;
  industry: string;
  transactionPattern: string;
  isPEP: boolean;
  hasNegativeNews: boolean;
  crossBorder: boolean;
}

export function calculateRiskScore(factor: RiskFactor): number {
  let score = 0;
  if (["高風險地區A", "高風險地區B"].includes(factor.region)) score += 30;
  if (factor.industry === "現金密集型") score += 20;
  if (factor.transactionPattern === "頻繁大額") score += 20;
  if (factor.isPEP) score += 30;
  if (factor.hasNegativeNews) score += 20;
  if (factor.crossBorder) score += 10;
  return score;
}

export function riskLevel(score: number): "Low" | "Medium" | "High" {
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}
