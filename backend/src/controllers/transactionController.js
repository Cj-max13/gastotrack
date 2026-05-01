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
