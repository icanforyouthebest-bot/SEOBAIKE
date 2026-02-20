-- Fix governance_audit_log status CHECK constraint
-- Add all statuses used by governance scripts
ALTER TABLE governance_audit_log
  DROP CONSTRAINT IF EXISTS governance_audit_log_status_check;

ALTER TABLE governance_audit_log
  ADD CONSTRAINT governance_audit_log_status_check
  CHECK (status IN (
    'OK', 'WARN', 'DRIFT', 'ALERT', 'CRITICAL', 'FAIL', 'HEALED', 'LOGGED',
    'BLOCKED', 'APPLIED', 'CAPTURED', 'PASS', 'FAILED', 'SENT', 'PENDING',
    'REPORT_GENERATED', 'EVIDENCE_WRITTEN', 'ENFORCED', 'SKIPPED'
  ));
