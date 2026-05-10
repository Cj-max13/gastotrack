/**
 * budgetController.js
 * HTTP layer for budget endpoints.
 * All routes are JWT-protected (enforced in budgetRoutes.js).
 */
const budgetService = require("../services/budgetService");

// ── GET /budget ───────────────────────────────────────────────────────────────
// Full budget overview: limits + current spending + status per category
exports.getBudget = async (req, res) => {
  try {
    const data = await budgetService.getBudget(req.userId);
    res.json(data);
  } catch (err) {
    console.error("getBudget error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /budget ───────────────────────────────────────────────────────────────
// Update category budget limits
// Body (bulk):  { "food": 3000, "transport": 1500 }
// Body (single): { "category": "food", "limit": 3000 }
exports.updateBudget = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "Request body is required." });
    }

    const result = await budgetService.updateBudget(req.userId, req.body);
    res.json(result);
  } catch (err) {
    // Service throws descriptive errors for invalid input — no need to log stack trace
    res.status(400).json({ error: err.message });
  }
};

// ── GET /budget/status ────────────────────────────────────────────────────────
// Returns only categories that are at warning (80%) or over budget
// Used by mobile app to decide whether to fire push notifications
exports.getBudgetStatus = async (req, res) => {
  try {
    const data = await budgetService.getBudgetStatus(req.userId);
    res.json(data);
  } catch (err) {
    console.error("getBudgetStatus error:", err);
    res.status(500).json({ error: err.message });
  }
};
