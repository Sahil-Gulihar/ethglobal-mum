-- Verified buyers (0G human check). Additive and idempotent; safe to run on a live database.
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS require_verified_buyers boolean NOT NULL DEFAULT false;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS human_verified_at timestamptz;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS human_check_id text;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS buyer_id text;

CREATE TABLE IF NOT EXISTS buyers (
  id text PRIMARY KEY,
  zg_address text NOT NULL UNIQUE,
  mgmt_key_enc text NOT NULL,
  inference_key_enc text NOT NULL,
  inference_key_id text NOT NULL,
  session_hash text UNIQUE,
  verified_at timestamptz,
  checks_passed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS human_checks (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES checkout_sessions(id),
  buyer_id text REFERENCES buyers(id) ON DELETE SET NULL,
  payer text NOT NULL,
  subject jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  calls jsonb NOT NULL,
  last_answer text,
  balance_before text,
  balance_after text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hc_session_idx ON human_checks (session_id);
CREATE INDEX IF NOT EXISTS hc_buyer_idx ON human_checks (buyer_id);
