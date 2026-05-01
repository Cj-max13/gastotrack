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

/**
 * Get the total reset offset for each category.
 * Returns { food: 1500, transport: 200, ... }
 */
exports.getCategoryOffsets = async (userId) => {
  const result = await pool.query(
    `SELECT category, COALESCE(SUM(offset_amount), 0) AS total_offset
     FROM category_resets
     WHERE user_id = $1
     GROUP BY category`,
    [userId]
  );
  const offsets = {};
  for (const row of result.rows) {
    offsets[row.category] = parseFloat(row.total_offset);
  }
  return offsets;
};

/**
 * Record a reset: saves the current spent amount as an offset so
 * future calculations subtract it. Transactions are NOT deleted.
 */
exports.recordReset = async (category, offsetAmount, userId) => {
  await pool.query(
    `INSERT INTO category_resets (user_id, category, offset_amount)
     VALUES ($1, $2, $3)`,
    [userId, category, offsetAmount]
  );
};
