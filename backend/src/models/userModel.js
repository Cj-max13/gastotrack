const pool = require("../config/db");

exports.createUser = async ({ name, email, hashedPassword }) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3) RETURNING id, name, email, created_at`,
    [name, email, hashedPassword]
  );
  return result.rows[0];
};

exports.findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
};

exports.findById = async (id) => {
  const result = await pool.query(
    "SELECT id, name, email, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};
