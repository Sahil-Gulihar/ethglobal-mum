-- Verified buyers with World ID. Additive and idempotent; run after 2026-11-07-verified-buyers.sql.
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS verified_buyer_method text NOT NULL DEFAULT 'world_id';
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS human_verified_via text;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS buyer_world_nullifier text;
CREATE INDEX IF NOT EXISTS cs_buyer_world_nullifier_idx ON checkout_sessions (buyer_world_nullifier);
-- Sessions verified before this column existed were all 0G checks.
UPDATE checkout_sessions SET human_verified_via = CASE WHEN human_check_id IS NULL THEN 'zg_badge' ELSE 'zg' END
  WHERE human_verified_at IS NOT NULL AND human_verified_via IS NULL;
