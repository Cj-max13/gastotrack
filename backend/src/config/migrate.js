/**
 * migrate.js — Run once to set up / upgrade all tables and indexes.
 * Safe to re-run: uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
 *
 * Usage:  node src/config/migrate.js
 */
require("dotenv").config();
const pool = require("./db");

async function migrate() {
  console.log("🚀 Running GastoTrack migrations...\n");

  // ── USERS ──────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(100)  NOT NULL,
      email          VARCHAR(255)  UNIQUE NOT NULL,
      password_hash  TEXT          NOT NULL,
      monthly_budget NUMERIC(10,2) NOT NULL DEFAULT 10000.00,
      created_at     TIMESTAMP     DEFAULT NOW()
    );
  `);
  // Safe upgrade: add monthly_budget if this is an older DB
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(10,2) NOT NULL DEFAULT 10000.00;
  `);
  console.log("✅ users table ready");

  // ── TRANSACTIONS ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount           NUMERIC(10,2) NOT NULL,
      merchant         VARCHAR(255)  NOT NULL DEFAULT 'Unknown',
      category         VARCHAR(50)   NOT NULL DEFAULT 'other',
      transaction_type VARCHAR(20)   NOT NULL DEFAULT 'unknown',
      source           VARCHAR(10)   NOT NULL DEFAULT 'manual',
      raw_text         TEXT,
      checksum         VARCHAR(64),
      created_at       TIMESTAMP     DEFAULT NOW()
    );
  `);
  // Safe upgrades for existing tables
  await pool.query(`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      ADD COLUMN IF NOT EXISTS source           VARCHAR(10) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS checksum         VARCHAR(64);
  `);
  // Add CHECK constraint only if it doesn't exist yet
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_source_check'
      ) THEN
        ALTER TABLE transactions
          ADD CONSTRAINT transactions_source_check
          CHECK (source IN ('auto', 'manual'));
      END IF;
    END $$;
  `);
  console.log("✅ transactions table ready");

  // ── CATEGORIES ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name         VARCHAR(50)   NOT NULL,
      icon         VARCHAR(10)   NOT NULL DEFAULT '💰',
      color        VARCHAR(7)    NOT NULL DEFAULT '#C8F135',
      budget_limit NUMERIC(10,2) NOT NULL DEFAULT 0.00,
      UNIQUE (user_id, name)
    );
  `);
  console.log("✅ categories table ready");

  // ── CHAT HISTORY ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id VARCHAR(36) NOT NULL,
      role       VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
      message    TEXT        NOT NULL,
      created_at TIMESTAMP   DEFAULT NOW()
    );
  `);
  console.log("✅ chat_history table ready");

  // ── CATEGORY RESETS ────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS category_resets (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category      VARCHAR(50)   NOT NULL,
      offset_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      reset_at      TIMESTAMP     DEFAULT NOW()
    );
  `);
  console.log("✅ category_resets table ready");

  // ── INDEXES ────────────────────────────────────────────────────────────────
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_created
       ON transactions(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_category
       ON transactions(user_id, category)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_checksum
       ON transactions(checksum)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_history_user_session
       ON chat_history(user_id, session_id, created_at ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_categories_user_id
       ON categories(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_category_resets_user_id
       ON category_resets(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email
       ON users(email)`,
  ];
  for (const sql of indexes) await pool.query(sql);
  console.log("✅ indexes ready");

  // ── SEED FUNCTION ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE OR REPLACE FUNCTION seed_user_categories(p_user_id INTEGER)
    RETURNS VOID AS $$
    BEGIN
      INSERT INTO categories (user_id, name, icon, color, budget_limit) VALUES
        (p_user_id, 'food',          '🍔', '#FF6B6B', 3000.00),
        (p_user_id, 'transport',     '🚗', '#4ECDC4', 1500.00),
        (p_user_id, 'entertainment', '🎮', '#45B7D1', 1000.00),
        (p_user_id, 'shopping',      '🛍️', '#96CEB4', 2000.00),
        (p_user_id, 'bills',         '📱', '#FFEAA7', 2000.00),
        (p_user_id, 'health',        '💊', '#DDA0DD', 1000.00),
        (p_user_id, 'savings',       '💰', '#C8F135', 0.00),
        (p_user_id, 'other',         '📦', '#888888', 500.00)
      ON CONFLICT (user_id, name) DO NOTHING;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log("✅ seed_user_categories function ready");

  console.log("\n✅ All migrations complete. Database is ready.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
