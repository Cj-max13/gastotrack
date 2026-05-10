const pool = require("../config/db");

// Create a new user — returns the full row including monthly_budget
exports.createUser = async ({ name, email, hashedPassword }) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, monthly_budget, created_at`,
    [name, email, hashedPassword]
  );
  return result.rows[0];
};

// Find by email — includes password_hash (needed for login/delete)
exports.findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
};

// Find by ID — strips password_hash for safe use in responses
exports.findById = async (id) => {
  const result = await pool.query(
    "SELECT id, name, email, monthly_budget, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};

// Hard delete — cascades to transactions, categories, chat_history via FK
exports.deleteById = async (id) => {
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
};
