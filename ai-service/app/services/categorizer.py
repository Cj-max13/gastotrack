"""
Merchant categorizer — uses Gemini as primary, keyword map as fallback.
"""
import re
from app.services.gemini import generate, get_client

VALID_CATEGORIES = {
    "food", "transport", "entertainment",
    "health", "shopping", "utilities", "education", "other",
}

# ── Keyword fallback (used when Gemini is unavailable) ──────────────────────
KEYWORD_RULES: dict[str, list[str]] = {
    "food": [
        "jollibee", "mcdo", "mcdonald", "kfc", "burger king", "wendy",
        "chowking", "greenwich", "mang inasal", "andok", "max's",
        "yellow cab", "shakey", "pizza hut", "domino", "angel's burger",
        "potato corner", "bonchon", "popeyes", "taco bell",
        "sm supermarket", "robinsons supermarket", "puregold", "savemore",
        "waltermart", "landers", "s&r", "costco",
        "starbucks", "coffee bean", "bo's coffee", "dunkin", "krispy kreme",
        "foodpanda", "grabfood", "7-eleven", "7eleven", "ministop",
        "restaurant", "eatery", "cafe", "grocery", "supermarket", "bakery",
        "food", "pizza", "burger", "sushi", "ramen",
    ],
    "transport": [
        "grab", "angkas", "joyride", "uber", "lyft",
        "shell", "petron", "caltex", "seaoil", "phoenix petroleum",
        "easytrip", "autosweep", "lrt", "mrt", "bus",
        "cebu pacific", "philippine airlines", "pal", "airasia",
        "parking", "gasoline", "diesel", "toll", "fare",
    ],
    "entertainment": [
        "netflix", "spotify", "youtube", "disney", "hbo", "apple tv",
        "steam", "playstation", "xbox", "nintendo", "mobile legends",
        "garena", "roblox", "sm cinema", "cinema", "concert",
        "canva", "adobe", "gym", "fitness", "spa", "salon",
    ],
    "health": [
        "mercury drug", "rose pharmacy", "generika", "watsons",
        "hospital", "clinic", "medical", "doctor", "dentist",
        "pharmacy", "drugstore", "medicine",
    ],
    "shopping": [
        "shopee", "lazada", "zalora", "amazon", "ebay",
        "h&m", "zara", "uniqlo", "penshoppe", "bench",
        "department store", "mall",
    ],
    "utilities": [
        "meralco", "manila water", "maynilad", "globe", "smart",
        "pldt", "converge", "internet", "wifi", "electric", "bayad center",
    ],
    "education": [
        "tuition", "school", "university", "coursera", "udemy",
        "national bookstore", "books",
    ],
}

_KEYWORD_MAP: dict[str, str] = {}
for _cat, _kws in KEYWORD_RULES.items():
    for _kw in _kws:
        _KEYWORD_MAP[_kw.lower()] = _cat


def _keyword_fallback(merchant: str, raw_text: str) -> dict:
    for target in [merchant.lower(), raw_text.lower()]:
        best, best_len = None, 0
        for kw, cat in _KEYWORD_MAP.items():
            pattern = r'(?<![a-z])' + re.escape(kw) + r'(?![a-z])'
            if re.search(pattern, target) and len(kw) > best_len:
                best, best_len = cat, len(kw)
        if best:
            return {"category": best, "confidence": "medium"}
    return {"category": "other", "confidence": "low"}


# ── Gemini-powered categorizer ───────────────────────────────────────────────
def categorize_merchant(merchant: str, raw_text: str = "") -> dict:
    """
    Uses Gemini to classify the merchant into a spending category.
    Falls back to keyword matching if Gemini is unavailable.
    """
    try:
        prompt = f"""You are a financial transaction classifier for a Philippine expense tracker app.

Classify this transaction into exactly ONE of these categories:
food, transport, entertainment, health, shopping, utilities, education, other

Merchant: "{merchant}"
Full text: "{raw_text}"

Rules:
- Reply with ONLY the category word, nothing else.
- Use "food" for restaurants, groceries, delivery, cafes.
- Use "transport" for ride-hailing, fuel, toll, airlines, parking.
- Use "entertainment" for streaming, gaming, cinema, gym, subscriptions.
- Use "health" for pharmacies, hospitals, clinics, medicine.
- Use "shopping" for online shops, malls, clothing, electronics.
- Use "utilities" for electricity, water, internet, phone bills.
- Use "education" for tuition, books, online courses.
- Use "other" if none of the above fit.

Category:"""

        category = generate(prompt).lower().split()[0]
        if category not in VALID_CATEGORIES:
            category = "other"
        return {"category": category, "confidence": "high"}

    except Exception:
        # Gemini unavailable — use keyword fallback silently
        return _keyword_fallback(merchant, raw_text)
