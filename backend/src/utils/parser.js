/**
 * parser.js
 * Parses raw SMS/notification text from GCash, PayMaya, GrabPay,
 * BDO, BPI, Metrobank — and also natural language manual entries.
 *
 * Returns: { amount, merchant, category, transaction_type, checksum }
 */

const crypto = require("crypto");

// ── Category keyword rules ────────────────────────────────────────────────────
const LOCAL_RULES = {
  food: [
    "jollibee", "mcdo", "mcdonald", "kfc", "burger king", "wendy",
    "chowking", "greenwich", "mang inasal", "andok", "max's",
    "yellow cab", "shakey", "pizza hut", "domino", "angel's burger",
    "potato corner", "bonchon", "popeyes", "taco bell",
    "starbucks", "coffee bean", "bo's coffee", "dunkin", "krispy kreme",
    "foodpanda", "grabfood", "grocery", "supermarket", "bakery",
    "restaurant", "cafe", "eatery", "food", "pizza", "burger",
    "sm supermarket", "robinsons supermarket", "puregold", "savemore",
    "waltermart", "landers", "s&r", "7-eleven", "7eleven", "ministop",
    "family mart", "sushi", "ramen", "milk tea", "boba",
  ],
  transport: [
    "grab", "angkas", "joyride", "uber",
    "shell", "petron", "caltex", "seaoil", "phoenix",
    "easytrip", "autosweep", "lrt", "mrt", "bus",
    "cebu pacific", "philippine airlines", "pal", "airasia",
    "parking", "gasoline", "diesel", "gas station", "toll", "fare",
  ],
  entertainment: [
    "netflix", "spotify", "youtube", "disney", "hbo", "apple tv",
    "steam", "playstation", "xbox", "nintendo", "mobile legends",
    "garena", "riot", "epic games", "roblox",
    "sm cinema", "cinema", "concert", "gym", "fitness",
    "canva", "adobe", "google one", "icloud", "spa", "salon",
  ],
  health: [
    "mercury drug", "rose pharmacy", "generika", "watsons",
    "hospital", "clinic", "medical", "doctor", "dentist",
    "pharmacy", "drugstore", "medicine",
  ],
  shopping: [
    "shopee", "lazada", "zalora", "amazon", "ebay",
    "h&m", "zara", "uniqlo", "penshoppe", "bench",
    "sm department", "department store", "mall",
  ],
  bills: [
    "meralco", "manila water", "maynilad", "globe", "smart",
    "pldt", "converge", "sky cable", "internet", "wifi",
    "electric", "water bill", "bayad center", "bills",
  ],
  savings: ["savings", "nababawasan", "ipon"],
};

function localCategorize(merchant, rawText = "") {
  const targets = [merchant.toLowerCase(), rawText.toLowerCase()];
  for (const target of targets) {
    let bestMatch = null;
    let bestLen = 0;
    for (const [category, keywords] of Object.entries(LOCAL_RULES)) {
      for (const kw of keywords) {
        if (target.includes(kw) && kw.length > bestLen) {
          bestMatch = category;
          bestLen = kw.length;
        }
      }
    }
    if (bestMatch) return bestMatch;
  }
  return "other";
}

// ── Transaction type detection ────────────────────────────────────────────────
function detectTransactionType(text) {
  const t = text.toLowerCase();
  if (/\b(sent|paid|payment|transferred to|you sent|nabayaran|nagpadala)\b/.test(t)) return "sent";
  if (/\b(received|you received|nakatanggap|incoming|credited)\b/.test(t))            return "received";
  if (/\b(paid|purchase|bought|cashout|withdrawal|withdrew)\b/.test(t))               return "paid";
  return "unknown";
}

// ── Amount extractor ──────────────────────────────────────────────────────────
function extractAmount(text) {
  // Handles: ₱150, ₱1,500.00, PHP 150, Php150.50
  const match = text.match(/(?:₱|PHP|Php)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i);
  if (match) return parseFloat(match[1].replace(/,/g, ""));
  // Fallback: plain number after "spent", "paid", "amount"
  const fallback = text.match(/(?:spent|paid|amount|worth)\s+(\d+(?:\.\d{1,2})?)/i);
  if (fallback) return parseFloat(fallback[1]);
  return 0;
}

// ── Merchant extractor ────────────────────────────────────────────────────────
function extractMerchant(text) {
  // GCash: "You paid ₱150.00 to Jollibee"
  let m = text.match(/(?:paid|sent|transferred)\s+(?:₱[\d,.]+\s+)?to\s+([A-Za-z0-9\s&'.,-]+?)(?:\s+on|\s+via|\s+for|\s*$)/i);
  if (m) return m[1].trim();

  // PayMaya: "Payment to MERCHANT NAME"
  m = text.match(/payment\s+to\s+([A-Za-z0-9\s&'.,-]+?)(?:\s+of|\s+amounting|\s*$)/i);
  if (m) return m[1].trim();

  // BDO/BPI: "at MERCHANT"
  m = text.match(/\bat\s+([A-Za-z0-9\s&'.,-]+?)(?:\s+on|\s+for|\s+worth|\s*$)/i);
  if (m) return m[1].trim();

  // Natural language: "spent ₱150 at Jollibee" or "Jollibee ₱150"
  m = text.match(/(?:at|from|in)\s+([A-Za-z0-9\s&'.,-]+?)(?:\s+for|\s+worth|\s*$)/i);
  if (m) return m[1].trim();

  return "Unknown";
}

// ── Checksum for duplicate detection ─────────────────────────────────────────
// Hash of userId + amount + merchant + minute-level timestamp
// Two identical notifications within the same minute = duplicate
function buildChecksum(userId, amount, merchant, dateStr) {
  const minute = dateStr
    ? new Date(dateStr).toISOString().substring(0, 16)   // "2024-01-15T10:30"
    : new Date().toISOString().substring(0, 16);
  const raw = `${userId}|${amount}|${merchant.toLowerCase()}|${minute}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Main parse function ───────────────────────────────────────────────────────
function parseTransaction(text) {
  const amount          = extractAmount(text);
  const merchant        = extractMerchant(text);
  const category        = localCategorize(merchant, text);
  const transaction_type = detectTransactionType(text);

  return { amount, merchant, category, transaction_type };
}

// ── Natural language manual entry parser ─────────────────────────────────────
// Handles: "Spent ₱150 at Jollibee", "Paid 500 for groceries", "Jollibee 150"
function parseManualEntry(text) {
  return parseTransaction(text);
}

module.exports = { parseTransaction, parseManualEntry, localCategorize, buildChecksum };
