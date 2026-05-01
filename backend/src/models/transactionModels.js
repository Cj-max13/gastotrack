const pool = require("../config/db");

exports.insert = async (data, raw, userId) => {
  const result = await pool.query(
    `INSERT INTO transactions (amount, merchant, category, raw_text, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.amount, data.merchant, data.category, raw, userId]
  );
  return result.rows[0];
};

exports.getAll = async (userId) => {
  const result = await pool.query(
    "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows;
};

exports.deleteByCategory = async (category, userId) => {
  const result = await pool.query(
    "DELETE FROM transactions WHERE category = $1 AND user_id = $2 RETURNING id",
    [category, userId]
  );
  return result.rowCount;
};
