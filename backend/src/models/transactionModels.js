/**
 * transactionModels.js
 * Raw SQL queries for the transactions table.
 * No ORM — uses pg directly.
 */
const pool = require("../config/db");

// ── INSERT ────────────────────────────────────────────────────────────────────
exports.insert = async (data, rawText, userId, source = "manual") => {
  const result = await pool.query(
    `INSERT INTO transactions
       (user_id, amount, merchant, category, transaction_type, source, raw_text, checksum)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      data.amount,
      data.merchant,
      data.category,
      data.transaction_type || "unknown",
      source,
      rawText,
      data.checksum || null,
    ]
  );
  return result.rows[0];
};

// ── DUPLICATE CHECK ───────────────────────────────────────────────────────────
exports.findByChecksum = async (checksum) => {
  const result = await pool.query(
    "SELECT id FROM transactions WHERE checksum = $1 LIMIT 1",
    [checksum]
  );
  return result.rows[0] || null;
};

// ── GET ALL (with filters + pagination) ───────────────────────────────────────
exports.getAll = async (userId, filters = {}) => {
  const {
    category,
    search,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    sortBy   = "created_at",
    sortDir  = "DESC",
    page     = 1,
    limit    = 20,
  } = filters;

  const params = [userId];
  const conditions = ["user_id = $1"];
  let i = 2;

  if (category) {
    conditions.push(`category = $${i++}`);
    params.push(category);
  }
  if (search) {
    conditions.push(`merchant ILIKE $${i++}`);
    params.push(`%${search}%`);
  }
  if (dateFrom) {
    conditions.push(`created_at >= $${i++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`created_at <= $${i++}`);
    params.push(dateTo);
  }
  if (amountMin !== undefined) {
    conditions.push(`amount >= $${i++}`);
    params.push(amountMin);
  }
  if (amountMax !== undefined) {
    conditions.push(`amount <= $${i++}`);
    params.push(amountMax);
  }

  // Whitelist sort columns to prevent SQL injection
  const allowedSort = ["created_at", "amount", "merchant", "category"];
  const safeSort    = allowedSort.includes(sortBy) ? sortBy : "created_at";
  const safeDir     = sortDir.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const offset = (Math.max(1, page) - 1) * limit;

  const whereClause = conditions.join(" AND ");

  // Get total count for pagination metadata
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM transactions WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated rows
  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT * FROM transactions
     WHERE ${whereClause}
     ORDER BY ${safeSort} ${safeDir}
     LIMIT $${i++} OFFSET $${i++}`,
    params
  );

  return {
    data:       dataResult.rows,
    total,
    page:       parseInt(page, 10),
    limit:      parseInt(limit, 10),
    totalPages: Math.ceil(total / limit),
  };
};

// ── GET BY ID ─────────────────────────────────────────────────────────────────
exports.getById = async (id, userId) => {
  const result = await pool.query(
    "SELECT * FROM transactions WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] || null;
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
exports.updateById = async (id, { amount, merchant, category }, userId) => {
  const result = await pool.query(
    `UPDATE transactions
     SET amount = $1, merchant = $2, category = $3
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [amount, merchant, category, id, userId]
  );
  return result.rows[0] || null;
};

// ── DELETE ────────────────────────────────────────────────────────────────────
exports.deleteById = async (id, userId) => {
  const result = await pool.query(
    "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );
  return result.rowCount > 0;
};

// ── CATEGORY OFFSETS (for reset feature) ─────────────────────────────────────
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

// ── RECORD RESET ──────────────────────────────────────────────────────────────
exports.recordReset = async (category, offsetAmount, userId) => {
  await pool.query(
    `INSERT INTO category_resets (user_id, category, offset_amount)
     VALUES ($1, $2, $3)`,
    [userId, category, offsetAmount]
  );
};
