-- governance_audit_log: Empire Governance Audit Table (WORM - write-once, read-many)
-- Operations Officer CANNOT delete records

CREATE TABLE IF NOT EXISTS governance_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  layer        TEXT NOT NULL,
  check_name   TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('OK', 'WARN', 'DRIFT', 'ALERT', 'CRITICAL', 'FAIL', 'HEALED', 'LOGGED')),
  action       TEXT NOT NULL,
  detail       TEXT,
  severity     TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  source       TEXT NOT NULL DEFAULT 'unknown',
  healer_run   BOOLEAN DEFAULT FALSE,
  metadata     JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE governance_audit_log ENABLE ROW LEVEL SECURITY;

-- WORM policy: anyone can insert, NOBODY can delete/update
CREATE POLICY "governance_audit_insert" ON governance_audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "governance_audit_select" ON governance_audit_log
  FOR SELECT USING (true);

-- NO delete policy = nobody can delete (WORM enforced)
-- NO update policy = nobody can update (immutable records)

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_gal_created_at  ON governance_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gal_layer       ON governance_audit_log (layer);
CREATE INDEX IF NOT EXISTS idx_gal_status      ON governance_audit_log (status);
CREATE INDEX IF NOT EXISTS idx_gal_severity    ON governance_audit_log (severity);
CREATE INDEX IF NOT EXISTS idx_gal_source      ON governance_audit_log (source);

-- Comment
COMMENT ON TABLE governance_audit_log IS 'Empire Governance Audit Log - WORM (Write Once Read Many) - Operations Officer cannot delete';

