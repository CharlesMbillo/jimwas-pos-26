-- API Rate Limiting Table
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,                 -- "{prefix}:{identifier}"
  count INTEGER NOT NULL DEFAULT 0,         -- Request count
  window_start INTEGER NOT NULL,            -- Window start timestamp
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key ON api_rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated ON api_rate_limits(updated_at DESC);

-- Cleanup old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM api_rate_limits
  WHERE updated_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- API Audit Logs Table
CREATE TABLE IF NOT EXISTS api_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,                 -- STK_PUSH_INITIATED, IPN_RECEIVED, etc
  actor TEXT NOT NULL,                      -- User/system identifier
  resource TEXT NOT NULL,                   -- Resource affected
  action TEXT NOT NULL,                     -- What was done
  status TEXT NOT NULL,                     -- SUCCESS, FAILED, BLOCKED
  metadata JSONB DEFAULT '{}',              -- Additional context
  ip_address INET,                          -- Client IP
  user_agent TEXT,                          -- Client user agent
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON api_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON api_audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON api_audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON api_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON api_audit_logs(status);

-- API Alerts Table
CREATE TABLE IF NOT EXISTS api_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,                 -- Event that triggered alert
  severity TEXT NOT NULL,                   -- ERROR, WARN, INFO
  message TEXT NOT NULL,                    -- Alert message
  metadata JSONB DEFAULT '{}',              -- Additional context
  resolved BOOLEAN DEFAULT FALSE,           -- Has been resolved?
  resolved_at TIMESTAMPTZ,                  -- When resolved
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_api_alerts_event_type ON api_alerts(event_type);
CREATE INDEX IF NOT EXISTS idx_api_alerts_severity ON api_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_api_alerts_resolved ON api_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_api_alerts_created ON api_alerts(created_at DESC);

-- View for unresolved alerts (for monitoring dashboard)
CREATE OR REPLACE VIEW unresolved_alerts AS
SELECT 
  id,
  event_type,
  severity,
  message,
  metadata,
  created_at,
  NOW() - created_at as age
FROM api_alerts
WHERE resolved = FALSE
ORDER BY severity DESC, created_at DESC;

-- Function to resolve alerts
CREATE OR REPLACE FUNCTION resolve_alert(alert_id UUID) RETURNS void AS $$
BEGIN
  UPDATE api_alerts
  SET resolved = TRUE,
      resolved_at = NOW()
  WHERE id = alert_id;
END;
$$ LANGUAGE plpgsql;

-- View for payment monitoring (recent transactions with status)
CREATE OR REPLACE VIEW payment_monitoring_summary AS
SELECT 
  DATE_TRUNC('hour', created_at) as period,
  status,
  COUNT(*) as count,
  AVG(CAST(amount AS NUMERIC)) as avg_amount,
  SUM(CAST(amount AS NUMERIC)) as total_amount
FROM kcb_payments
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), status
ORDER BY period DESC, status;

-- Function to get monitoring stats
CREATE OR REPLACE FUNCTION get_monitoring_stats(hours INTEGER DEFAULT 24)
RETURNS TABLE (
  total_requests BIGINT,
  success_rate NUMERIC,
  avg_response_time INTERVAL,
  error_count BIGINT,
  rate_limits_hit BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_requests,
    (COUNT(*) FILTER (WHERE status = 'SUCCESS') * 100.0 / COUNT(*))::NUMERIC as success_rate,
    INTERVAL '0' as avg_response_time,  -- Placeholder
    COUNT(*) FILTER (WHERE status = 'FAILED')::BIGINT as error_count,
    COUNT(*) FILTER (WHERE event_type = 'RATE_LIMIT_EXCEEDED')::BIGINT as rate_limits_hit
  FROM api_audit_logs
  WHERE created_at > NOW() - (hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Retention policy: Keep audit logs for 90 days
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs() RETURNS void AS $$
BEGIN
  DELETE FROM api_audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Retention policy: Keep alerts for 30 days if resolved, 90 days if unresolved
CREATE OR REPLACE FUNCTION cleanup_old_alerts() RETURNS void AS $$
BEGIN
  DELETE FROM api_alerts
  WHERE (resolved = TRUE AND resolved_at < NOW() - INTERVAL '30 days')
     OR (resolved = FALSE AND created_at < NOW() - INTERVAL '90 days');
END;
$$ LANGUAGE plpgsql;
