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

exports.resetCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const deleted = await transactionService.resetCategory(category, req.userId);
    res.json({ deleted, category, message: `Reset ${deleted} transaction(s) in ${category}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
