-- 0001_init.sql
-- Cross-surface continuity store: account preferences + virtual-leg batches.
--
-- Privacy decision: activity stays client-side (localStorage).
-- Only prefs are synced server-side.

-- ─── account_state ────────────────────────────────────────────────────────────
-- Stores per-wallet preferences (slippage, odds format, notifications, etc.).
-- Activity is intentionally excluded; activity stays in localStorage.

CREATE TABLE IF NOT EXISTS account_state (
  address    TEXT        PRIMARY KEY,
  prefs      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Guard against huge blobs being stored via a direct DB write.
  CONSTRAINT prefs_size_check CHECK (octet_length(prefs::text) < 16384)
);

-- ─── vl_batch ─────────────────────────────────────────────────────────────────
-- Records virtual-leg batch submissions for idempotency + cancellation.

CREATE TABLE IF NOT EXISTS vl_batch (
  vl_batch_id  TEXT    PRIMARY KEY,
  address      TEXT    NOT NULL,
  budget_symbol TEXT   NOT NULL,
  amount       TEXT    NOT NULL,
  legs         JSONB   NOT NULL,
  expiration   BIGINT  NOT NULL,
  created_at   BIGINT  NOT NULL,
  cancelled_at BIGINT
);

-- Index: open batches per address (used by cancel + status lookups).
CREATE INDEX IF NOT EXISTS vl_batch_address_open_idx
  ON vl_batch(address)
  WHERE cancelled_at IS NULL;
