/**
 * transactionController.js
 * Handles HTTP layer: validates input, calls service, returns response.
 */
const transactionService = require("../services/transactionServices");

// ── POST /transactions/raw ────────────────────────────────────────────────────
// Receives raw notification text from Android NotificationListenerService
exports.createFromRaw = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text is required." });
    }

    const result = await transactionService.processRaw(text, req.userId);

    // Duplicate detected — return 200 (not an error, just skip)
    if (result.duplicate) {
      return res.status(200).json({
        duplicate: true,
        message:   "Duplicate transaction skipped.",
        existing_id: result.existing_id,
      });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error("createFromRaw error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /transactions/manual ─────────────────────────────────────────────────
// Receives natural language input: "Spent ₱150 at Jollibee"
exports.createManual = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text is required." });
    }

    const result = await transactionService.processManual(text, req.userId);
    res.status(201).json(result);
  } catch (err) {
    console.error("createManual error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /transactions ─────────────────────────────────────────────────────────
// Supports: ?category=food&search=jollibee&dateFrom=2024-01-01&dateTo=2024-01-31
//           &amountMin=100&amountMax=500&sortBy=amount&sortDir=DESC&page=1&limit=20
exports.getTransactions = async (req, res) => {
  try {
    const {
      category, search,
      dateFrom, dateTo,
      amountMin, amountMax,
      sortBy, sortDir,
      page  = 1,
      limit = 20,
    } = req.query;

    // Clamp limit to prevent abuse
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);

    const result = await transactionService.getTransactions(req.userId, {
      category,
      search,
      dateFrom,
      dateTo,
      amountMin: amountMin !== undefined ? parseFloat(amountMin) : undefined,
      amountMax: amountMax !== undefined ? parseFloat(amountMax) : undefined,
      sortBy,
      sortDir,
      page:  parseInt(page, 10) || 1,
      limit: safeLimit,
    });

    res.json(result);
  } catch (err) {
    console.error("getTransactions error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /transactions/:id ─────────────────────────────────────────────────────
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid transaction ID." });

    const transaction = await transactionService.getTransactionById(id, req.userId);
    if (!transaction) return res.status(404).json({ error: "Transaction not found." });

    res.json(transaction);
  } catch (err) {
    console.error("getTransactionById error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /transactions/:id ─────────────────────────────────────────────────────
// Used for manual category override or amount correction
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid transaction ID." });

    const { amount, merchant, category } = req.body;
    if (!amount || !merchant || !category) {
      return res.status(400).json({ error: "amount, merchant, and category are required." });
    }
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "amount must be a positive number." });
    }

    const updated = await transactionService.updateTransaction(
      id,
      { amount: parseFloat(amount), merchant, category },
      req.userId
    );
    if (!updated) return res.status(404).json({ error: "Transaction not found." });

    res.json(updated);
  } catch (err) {
    console.error("updateTransaction error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /transactions/:id ──────────────────────────────────────────────────
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid transaction ID." });

    const deleted = await transactionService.deleteTransaction(id, req.userId);
    if (!deleted) return res.status(404).json({ error: "Transaction not found." });

    res.json({ message: "Transaction deleted." });
  } catch (err) {
    console.error("deleteTransaction error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /transactions/reset/:category ───────────────────────────────────────
exports.resetCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { spentAmount } = req.body;
    if (!spentAmount || isNaN(spentAmount)) {
      return res.status(400).json({ error: "spentAmount is required." });
    }
    const result = await transactionService.resetCategory(
      category,
      parseFloat(spentAmount),
      req.userId
    );
    res.json({ ...result, message: `${category} spending reset to ₱0` });
  } catch (err) {
    console.error("resetCategory error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /transactions/offsets ─────────────────────────────────────────────────
exports.getCategoryOffsets = async (req, res) => {
  try {
    const offsets = await transactionService.getCategoryOffsets(req.userId);
    res.json(offsets);
  } catch (err) {
    console.error("getCategoryOffsets error:", err);
    res.status(500).json({ error: err.message });
  }
};
