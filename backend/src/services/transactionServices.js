const { parseTransaction } = require("../utils/parser");
const transactionModel = require("../models/transactionModels");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

async function aiCategorize(merchant, rawText) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/ai/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant, raw_text: rawText }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.category || null;
  } catch {
    return null;
  }
}

exports.processRaw = async (text, userId) => {
  const parsed = parseTransaction(text);
  const aiCategory = await aiCategorize(parsed.merchant, text);
  if (aiCategory) parsed.category = aiCategory;
  return await transactionModel.insert(parsed, text, userId);
};

exports.getTransactions = async (userId) => {
  return await transactionModel.getAll(userId);
};

exports.resetCategory = async (category, userId) => {
  return await transactionModel.deleteByCategory(category, userId);
};
