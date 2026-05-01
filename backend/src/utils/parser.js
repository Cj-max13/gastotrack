/**
 * Local parser — used as a fast fallback when the AI service is unavailable.
 * The AI service (categorizer.py) is the primary categorization source.
 */

const LOCAL_RULES = {
  food: [
    "jollibee", "mcdo", "mcdonald", "kfc", "burger king", "wendy",
    "chowking", "greenwich", "mang inasal", "andok", "max's",
    "yellow cab", "shakey", "pizza hut", "domino", "angel's burger",
    "starbucks", "coffee bean", "bo's coffee", "dunkin", "krispy kreme",
    "foodpanda", "grabfood", "grocery", "supermarket", "bakery",
    "restaurant", "cafe", "eatery", "food", "pizza", "burger",
    "sm supermarket", "robinsons supermarket", "puregold", "savemore",
    "7-eleven", "7eleven", "ministop", "family mart",
  ],
  transport: [
    "grab", "angkas", "joyride", "uber",
    "shell", "petron", "caltex", "seaoil", "phoenix",
    "easytrip", "autosweep", "lrt", "mrt", "bus",
    "cebu pacific", "philippine airlines", "pal", "airasia",
    "parking", "gasoline", "diesel", "gas station", "toll",
  ],
  entertainment: [
    "netflix", "spotify", "youtube", "disney", "hbo", "apple tv",
    "steam", "playstation", "xbox", "nintendo", "mobile legends",
    "garena", "riot", "epic games", "roblox",
    "sm cinema", "cinema", "concert", "gym", "fitness",
    "canva", "adobe", "google one", "icloud",
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
  utilities: [
    "meralco", "manila water", "maynilad", "globe", "smart",
    "pldt", "converge", "sky cable", "internet", "wifi",
    "electric", "water bill", "bayad center",
  ],
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

function parseTransaction(text) {
  const amountMatch = text.match(/₱\s?(\d+(\.\d+)?)/);
  const merchantMatch = text.match(/at ([A-Za-z0-9\s&'.,-]+?)(?:\s*$|\s+for\b|\s+worth\b)/i)
    || text.match(/at ([A-Za-z0-9\s&'.,-]+)/i);

  const merchant = merchantMatch ? merchantMatch[1].trim() : "Unknown";

  return {
    amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
    merchant,
    category: localCategorize(merchant, text),
  };
}

module.exports = { parseTransaction, localCategorize };
