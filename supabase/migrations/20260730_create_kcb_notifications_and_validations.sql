-- create kcb_notifications table (raw notifications)
CREATE TABLE IF NOT EXISTS kcb_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb,
  received_at timestamptz DEFAULT now()
);

-- create kcb_validations table (validation requests + responses)
CREATE TABLE IF NOT EXISTS kcb_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request jsonb,
  response jsonb,
  received_at timestamptz DEFAULT now()
);
