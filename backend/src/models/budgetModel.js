/**
 * budgetModel.js
 * Raw SQL queries for the categories table (per-user budget limits)
 * and spending totals from the transactions table.
 */
const pool = require("../config/db");

// ── Get all category budgets for a user ───────────────────────────────────────
exports.getCategories = async (userId) => {
  const result = await pool.query(
    `SELECT id, name, icon, color, budget_limit
     FROM categories
     WHERE user_id = $1
     ORDER BY name ASC`,
    [userId]
  );
  return result.rows;
};

// ── Update a single category's budget limit ───────────────────────────────────
exports.updateCategoryLimit = async (userId, name, budgetLimit) => {
  const result = await pool.query(
    `UPDATE categories
     SET budget_limit = $1
     WHERE user_id = $2 AND name = $3
     RETURNING *`,
    [budgetLimit, userId, name]
  );
  return result.rows[0] || null;
};

// ── Bulk update multiple category limits at once ──────────────────────────────
// budgets = { food: 3000, transport: 1500, ... }
exports.bulkUpdateLimits = async (userId, budgets) => {
  const updated = [];
  for (const [name, limit] of Object.entries(budgets)) {
    const row = await exports.updateCategoryLimit(userId, name, parseFloat(limit));
    if (row) updated.push(row);
  }
  return updated;
};

// ── Get current month's spending per category ─────────────────────────────────
// Accounts for reset offsets so displayed spending matches what the user sees
exports.getMonthlySpending = async (userId) => {
  // Get all spending from the 1st of the current month
  const spendingResult = await pool.query(
    `SELECT category, COALESCE(SUM(amount), 0) AS total_spent
     FROM transactions
     WHERE user_id = $1
       AND created_at >= date_trunc('month', NOW())
     GROUP BY category`,
    [userId]
  );

  // Get reset offsets recorded this month
  const offsetResult = await pool.query(
    `SELECT category, COALESCE(SUM(offset_amount), 0) AS total_offset
     FROM category_resets
     WHERE user_id = $1
       AND reset_at >= date_trunc('month', NOW())
     GROUP BY category`,
    [userId]
  );

  // Build maps
  const spending = {};
  for (const row of spendingResult.rows) {
    spending[row.category] = parseFloat(row.total_spent);
  }

  const offsets = {};
  for (const row of offsetResult.rows) {
    offsets[row.category] = parseFloat(row.total_offset);
  }

  // Net spending = total spent − reset offsets (floor at 0)
  const net = {};
  const allCategories = new Set([...Object.keys(spending), ...Object.keys(offsets)]);
  for (const cat of allCategories) {
    net[cat] = Math.max(0, (spending[cat] || 0) - (offsets[cat] || 0));
  }

  return net;
};

// ── Get user's global monthly budget ─────────────────────────────────────────
exports.getMonthlyBudget = async (userId) => {
  const result = await pool.query(
    "SELECT monthly_budget FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0]?.monthly_budget || 0;
};
