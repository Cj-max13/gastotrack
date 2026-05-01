const transactionService = require("../services/transactionServices");

exports.createTransaction = async (req, res) => {
  try {
    const result = await transactionService.processRaw(req.body.text, req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const data = await transactionService.getTransactions(req.userId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /transactions/reset/:category
 * Body: { spentAmount: number }
 * Records the current spent amount as an offset so the displayed
 * spending resets to ₱0. Transactions are NOT deleted.
 */
exports.resetCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { spentAmount } = req.body;
    if (!spentAmount || isNaN(spentAmount)) {
      return res.status(400).json({ error: "spentAmount is required" });
    }
    const result = await transactionService.resetCategory(category, parseFloat(spentAmount), req.userId);
    res.json({ ...result, message: `${category} spending reset to ₱0` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCategoryOffsets = async (req, res) => {
  try {
    const offsets = await transactionService.getCategoryOffsets(req.userId);
    res.json(offsets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
