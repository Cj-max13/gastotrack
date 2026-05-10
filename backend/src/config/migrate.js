/**
 * Run this once to set up all tables and indexes.
 * Usage: node src/config/migrate.js
 */
require("dotenv").config();
const pool = require("./db");

async function migrate() {
  console.log("Running migrations...");

  // ── Users ──────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ users table ready");

  // ── Transactions ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id         SERIAL PRIMARY KEY,
      amount     NUMERIC(10,2),
      merchant   VARCHAR(255),
      category   VARCHAR(50),
      raw_text   TEXT,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Safe migration: add user_id if it doesn't exist yet
  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  `);
  console.log("✅ transactions table ready");

  // ── Category resets ────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS category_resets (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
      category      VARCHAR(50) NOT NULL,
      offset_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      reset_at      TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ category_resets table ready");

  // ── Indexes (performance for multi-user scale) ─────────────────────────────
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id
      ON transactions(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_created
      ON transactions(user_id, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_category
      ON transactions(user_id, category);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_category_resets_user_id
      ON category_resets(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);
  `);
  console.log("✅ indexes ready");

  console.log("\n✅ All migrations complete. Your database is ready for public use.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
