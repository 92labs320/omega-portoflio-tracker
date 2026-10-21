-- Omega Portfolio Tracker — Neon schema (idempotent, safe to run several times)

CREATE SEQUENCE IF NOT EXISTS tx_seq;

CREATE TABLE IF NOT EXISTS transactions (
  owner_hash   TEXT        NOT NULL,            -- SHA-256 of the device secret; no personal data
  id           UUID        NOT NULL,            -- generated on the device
  asset_id     TEXT        NOT NULL,
  symbol       TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  category     TEXT        NOT NULL CHECK (category IN ('crypto', 'stock')),
  type         TEXT        NOT NULL CHECK (type IN ('buy', 'sell', 'stake', 'unstake', 'reward', 'airdrop')),
  quantity     DOUBLE PRECISION NOT NULL CHECK (quantity >= 0),
  price_usd    DOUBLE PRECISION NOT NULL CHECK (price_usd >= 0),
  fee_usd      DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (fee_usd >= 0),
  exchange     TEXT        NOT NULL DEFAULT '',
  notes        TEXT        NOT NULL DEFAULT '',
  executed_at  TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,             -- client clock, used for last-write-wins
  deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
  server_seq   BIGINT      NOT NULL DEFAULT nextval('tx_seq'),  -- sync cursor
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_hash, id)
);

CREATE INDEX IF NOT EXISTS transactions_owner_seq_idx ON transactions (owner_hash, server_seq);
