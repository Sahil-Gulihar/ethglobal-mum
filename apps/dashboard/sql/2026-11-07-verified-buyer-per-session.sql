-- Verified buyers move from a merchant setting to a per-checkout flag set in code (requireVerifiedBuyer).
-- Additive and idempotent. The old merchants.require_verified_buyers / verified_buyer_method columns are no longer read.
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS require_verified_buyer boolean NOT NULL DEFAULT false;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS verified_buyer_method text NOT NULL DEFAULT 'world_id';
