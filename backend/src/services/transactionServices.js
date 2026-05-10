/**
 * transactionServices.js
 * Business logic layer between controllers and models.
 * Handles: parsing, AI categorization, duplicate detection, CRUD.
 */
const { parseTransaction, parseManualEntry, buildChecksum } = require("../utils/parser");
const transactionModel = require("../models/transactionModels");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// ── AI categorization (calls Python FastAPI) ──────────────────────────────────
// Falls back silently if AI service is down — local rules take over
async function aiCategorize(merchant, rawText) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/ai/categorize`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ merchant, raw_text: rawText }),
      signal:  AbortSignal.timeout(3000), // 3s timeout — don't block the user
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.category || null;
  } catch {
    return null; // AI service offline — use local category
  }
}

// ── Process raw notification text (from Android NotificationListener) ─────────
exports.processRaw = async (text, userId) => {
  if (!text || typeof text !== "string") {
    throw new Error("text is required");
  }

  const parsed = parseTransaction(text.trim());

  // Build checksum to detect duplicate notifications
  const checksum = buildChecksum(userId, parsed.amount, parsed.merchant, null);
  const duplicate = await transactionModel.findByChecksum(checksum);
  if (duplicate) {
    return { duplicate: true, existing_id: duplicate.id };
  }

  // Try AI categorization — override local rule if AI is confident
  const aiCategory = await aiCategorize(parsed.merchant, text);
  if (aiCategory) parsed.category = aiCategory;

  parsed.checksum = checksum;

  return await transactionModel.insert(parsed, text, userId, "auto");
};

// ── Process manual entry (typed or voice input) ───────────────────────────────
exports.processManual = async (text, userId) => {
  if (!text || typeof text !== "string") {
    throw new Error("text is required");
  }

  const parsed = parseManualEntry(text.trim());

  // Manual entries don't need duplicate detection (user intentionally typed it)
  const aiCategory = await aiCategorize(parsed.merchant, text);
  if (aiCategory) parsed.category = aiCategory;

  return await transactionModel.insert(parsed, text, userId, "manual");
};

// ── Get transactions with filters + pagination ────────────────────────────────
exports.getTransactions = async (userId, filters = {}) => {
  return await transactionModel.getAll(userId, filters);
};

// ── Get single transaction ────────────────────────────────────────────────────
exports.getTransactionById = async (id, userId) => {
  return await transactionModel.getById(id, userId);
};

// ── Update transaction (category override, amount correction) ─────────────────
exports.updateTransaction = async (id, fields, userId) => {
  return await transactionModel.updateById(id, fields, userId);
};

// ── Delete transaction ────────────────────────────────────────────────────────
exports.deleteTransaction = async (id, userId) => {
  return await transactionModel.deleteById(id, userId);
};

// ── Reset category spending display ──────────────────────────────────────────
exports.resetCategory = async (category, spentAmount, userId) => {
  await transactionModel.recordReset(category, spentAmount, userId);
  return { category, offset: spentAmount };
};

// ── Get category reset offsets ────────────────────────────────────────────────
exports.getCategoryOffsets = async (userId) => {
  return await transactionModel.getCategoryOffsets(userId);
};
