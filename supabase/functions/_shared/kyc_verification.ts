export interface CustomerIdentity {
  name: string;
  idNumber: string;
  birthDate: string;
  nationality: string;
  address: string;
  documentType: "ID" | "Passport" | "CompanyCert";
  documentNumber: string;
  documentExpiry: string;
}

export interface BeneficialOwner {
  name: string;
  idNumber: string;
  controlType: "Direct" | "Indirect" | "SeniorManager";
  ownershipPercent?: number;
}

export interface KYCVerificationResult {
  passed: boolean;
  reason?: string;
}

export function verifyCustomerIdentity(
  identity: CustomerIdentity
): KYCVerificationResult {
  if (!identity.name || !identity.idNumber || !identity.documentNumber) {
    return { passed: false, reason: "缺少必要身份資料" };
  }
  if (identity.documentExpiry < new Date().toISOString().slice(0, 10)) {
    return { passed: false, reason: "證件已過期" };
  }
  return { passed: true };
}

export function verifyBeneficialOwner(
  owners: BeneficialOwner[]
): KYCVerificationResult {
  if (!owners || owners.length === 0) {
    return { passed: false, reason: "未提供實質受益人資料" };
  }
  for (const owner of owners) {
    if (!owner.name || !owner.idNumber) {
      return { passed: false, reason: "實質受益人資料不完整" };
    }
    if (
      owner.controlType === "Direct" &&
      (!owner.ownershipPercent || owner.ownershipPercent < 25)
    ) {
      return { passed: false, reason: "直接持股比例未達標" };
    }
  }
  return { passed: true };
}
