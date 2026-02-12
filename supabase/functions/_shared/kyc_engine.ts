type KycDocument = {
  id: string;
  type: string;
  status: string;
  [key: string]: unknown;
};

type KycResult =
  | { status: "approved" }
  | { status: "failed"; reason: "missing_documents"; missing: string[] }
  | { status: "failed"; reason: "document_rejected"; rejected: KycDocument[] };

export function evaluateKyc(documents: KycDocument[]): KycResult {
  const required = ["id_front", "id_back", "selfie"];

  const missing = required.filter((r) => !documents.some((d) => d.type === r));

  if (missing.length > 0) {
    return {
      status: "failed",
      reason: "missing_documents",
      missing
    };
  }

  const rejected = documents.filter((d) => d.status === "rejected");
  if (rejected.length > 0) {
    return {
      status: "failed",
      reason: "document_rejected",
      rejected
    };
  }

  return { status: "approved" };
}
