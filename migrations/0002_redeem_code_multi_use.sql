ALTER TABLE redeem_codes ADD COLUMN plain_code TEXT;
ALTER TABLE redeem_codes ADD COLUMN max_redemptions INTEGER NOT NULL DEFAULT 3;
ALTER TABLE redeem_codes ADD COLUMN redemption_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS redeem_code_redemptions (
  id TEXT PRIMARY KEY,
  redeem_code_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  redeemed_at TEXT NOT NULL,
  FOREIGN KEY (redeem_code_id) REFERENCES redeem_codes(id)
);

CREATE INDEX IF NOT EXISTS idx_redeem_code_redemptions_token_hash
  ON redeem_code_redemptions (token_hash);

CREATE INDEX IF NOT EXISTS idx_redeem_code_redemptions_code_id
  ON redeem_code_redemptions (redeem_code_id);
