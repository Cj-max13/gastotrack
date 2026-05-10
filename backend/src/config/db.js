const { Pool } = require("pg");

// Supabase and most cloud PostgreSQL providers require SSL.
// rejectUnauthorized: false allows self-signed certs (safe for Supabase).
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: process.env.DB_URL?.includes("supabase") || process.env.DB_URL?.includes("render")
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = pool;
