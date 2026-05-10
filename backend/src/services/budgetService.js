/**
 * budgetService.js
 * Business logic for budget tracking:
 * - Computes spending vs limits per category
 * - Determines alert status (ok / warning / over)
 * - Calculates overall monthly budget usage
 */
const budgetModel = require("../models/budgetModel");

// Thresholds for alert levels
const WARNING_THRESHOLD  = 0.80; // 80% of budget used → warning
const EXCEEDED_THRESHOLD = 1.00; // 100% → over budget

/**
 * Determine alert status for a category.
 * @param {number} spent       - Amount spent this month
 * @param {number} budgetLimit - Monthly limit (0 = no limit set)
 * @returns {"ok"|"warning"|"over"|"unlimited"}
 */
function getAlertStatus(spent, budgetLimit) {
  if (!budgetLimit || budgetLimit <= 0) return "unlimited";
  const ratio = spent / budgetLimit;
  if (ratio >= EXCEEDED_THRESHOLD) return "over";
  if (ratio >= WARNING_THRESHOLD)  return "warning";
  return "ok";
}

// ── GET /budget ───────────────────────────────────────────────────────────────
// Returns all category budgets with their current spending and status
exports.getBudget = async (userId) => {
  const [categories, spending, monthlyBudget] = await Promise.all([
    budgetModel.getCategories(userId),
    budgetModel.getMonthlySpending(userId),
    budgetModel.getMonthlyBudget(userId),
  ]);

  // Build per-category status
  const categoryStatus = categories.map((cat) => {
    const spent      = spending[cat.name] || 0;
    const limit      = parseFloat(cat.budget_limit);
    const remaining  = limit > 0 ? Math.max(0, limit - spent) : null;
    const percentage = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : null;
    const status     = getAlertStatus(spent, limit);

    return {
      name:         cat.name,
      icon:         cat.icon,
      color:        cat.color,
      budget_limit: limit,
      spent,
      remaining,
      percentage,
      status,
    };
  });

  // Overall totals
  const totalSpent  = Object.values(spending).reduce((a, b) => a + b, 0);
  const totalBudget = parseFloat(monthlyBudget);
  const overallPct  = totalBudget > 0
    ? Math.min(100, Math.round((totalSpent / totalBudget) * 100))
    : null;

  return {
    monthly_budget:    totalBudget,
    total_spent:       Math.round(totalSpent * 100) / 100,
    total_remaining:   totalBudget > 0 ? Math.max(0, totalBudget - totalSpent) : null,
    overall_percentage: overallPct,
    overall_status:    getAlertStatus(totalSpent, totalBudget),
    categories:        categoryStatus,
    period:            getCurrentMonthLabel(),
  };
};

// ── PUT /budget ───────────────────────────────────────────────────────────────
// Update one or many category limits at once
// body: { food: 3000, transport: 1500 } OR { category: "food", limit: 3000 }
exports.updateBudget = async (userId, body) => {
  let budgets = {};

  if (body.category && body.limit !== undefined) {
    // Single category update
    budgets[body.category] = body.limit;
  } else {
    // Bulk update — filter out non-category keys
    const validCategories = [
      "food", "transport", "entertainment",
      "shopping", "bills", "health", "savings", "other",
    ];
    for (const [key, val] of Object.entries(body)) {
      if (validCategories.includes(key) && !isNaN(val)) {
        budgets[key] = val;
      }
    }
  }

  if (Object.keys(budgets).length === 0) {
    throw new Error("No valid category budgets provided.");
  }

  const updated = await budgetModel.bulkUpdateLimits(userId, budgets);
  return { updated, message: "Budget limits updated." };
};

// ── GET /budget/status ────────────────────────────────────────────────────────
// Lightweight version — just the alert statuses, no full category details
// Used by the mobile app to check if push notifications should fire
exports.getBudgetStatus = async (userId) => {
  const [categories, spending] = await Promise.all([
    budgetModel.getCategories(userId),
    budgetModel.getMonthlySpending(userId),
  ]);

  const alerts = [];

  for (const cat of categories) {
    const spent  = spending[cat.name] || 0;
    const limit  = parseFloat(cat.budget_limit);
    const status = getAlertStatus(spent, limit);

    if (status === "warning" || status === "over") {
      alerts.push({
        category: cat.name,
        icon:     cat.icon,
        spent,
        limit,
        status,
        message:  status === "over"
          ? `You've exceeded your ₱${limit.toLocaleString()} ${cat.name} budget!`
          : `You've used 80%+ of your ₱${limit.toLocaleString()} ${cat.name} budget.`,
      });
    }
  }

  return {
    has_alerts: alerts.length > 0,
    alerts,
  };
};

// ── Helper ────────────────────────────────────────────────────────────────────
function getCurrentMonthLabel() {
  return new Date().toLocaleString("en-PH", { month: "long", year: "numeric" });
}
