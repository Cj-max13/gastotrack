/**
 * Run this once to set up the users table and add user_id to transactions.
 * Usage: node src/config/migrate.js
 */
require("dotenv").config();
const pool = require("./db");

async function migrate() {
  console.log("Running migrations...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      name         VARCHAR(100) NOT NULL,
      email        VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at   TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ users table ready");

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
  console.log("✅ transactions table ready");

  // Add user_id column if it doesn't exist yet (safe for existing DBs)
  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  `);
  console.log("✅ user_id column ready");

  console.log("Migrations complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
