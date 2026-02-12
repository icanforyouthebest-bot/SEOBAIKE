export enum TwLawCode {
  AML = "AML_TW",
  CONSUMER = "CONSUMER_PROTECTION_TW",
  E_INVOICE = "E_INVOICE_TW",
  ELECTRONIC_PAYMENT = "E_PAYMENT_TW"
}

export type ComplianceContext = {
  merchantStatus: string;
  kycStatus?: string;
  hasEInvoice?: boolean;
  highRiskFlags?: number;
};

export type ComplianceResult = {
  passed: boolean;
  level: "ok" | "warning" | "block";
  reasons: { law: TwLawCode; message: string }[];
};

export function checkTwCompliance(ctx: ComplianceContext): ComplianceResult {
  const reasons: { law: TwLawCode; message: string }[] = [];
  let level: ComplianceResult["level"] = "ok";

  if (ctx.merchantStatus !== "active") {
    reasons.push({
      law: TwLawCode.AML,
      message: "商家未通過完整 KYC 或未處於可營運狀態"
    });
    level = "block";
  }

  if (ctx.kycStatus && ctx.kycStatus !== "approved") {
    reasons.push({
      law: TwLawCode.AML,
      message: "KYC 狀態非核准"
    });
    level = "block";
  }

  if (!ctx.hasEInvoice) {
    reasons.push({
      law: TwLawCode.E_INVOICE,
      message: "未啟用電子發票或發票流程未對齊"
    });
    if (level !== "block") level = "warning";
  }

  if ((ctx.highRiskFlags ?? 0) > 0) {
    reasons.push({
      law: TwLawCode.AML,
      message: "存在高風險標記，需人工覆核"
    });
    if (level !== "block") level = "warning";
  }

  const passed = level !== "block";

  return { passed, level, reasons };
}
