"""
Agent Tools — real actions the Gasto AI Agent can execute.
Each tool fetches live data from the backend or performs calculations.
"""
import os
import json
import urllib.request
import urllib.error
from typing import Any

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")

DEFAULT_BUDGETS = {
    "food": 3000,
    "transport": 1500,
    "entertainment": 1000,
    "health": 2000,
    "shopping": 2000,
    "utilities": 1500,
    "education": 1000,
    "other": 2000,
}


def _backend_get(path: str, token: str) -> Any:
    """Make an authenticated GET request to the backend."""
    req = urllib.request.Request(
        f"{BACKEND_URL}{path}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode())


def _backend_post(path: str, body: dict, token: str) -> Any:
    """Make an authenticated POST request to the backend."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BACKEND_URL}{path}",
        data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode())


# ── Tool implementations ──────────────────────────────────────────────────────

def tool_get_transactions(token: str, limit: int = 20) -> dict:
    """Fetch the user's recent transactions from the backend."""
    try:
        txs = _backend_get("/transactions", token)
        recent = txs[:limit] if isinstance(txs, list) else []
        return {
            "success": True,
            "count": len(recent),
            "transactions": [
                {
                    "id": t.get("id"),
                    "amount": float(t.get("amount", 0)),
                    "merchant": t.get("merchant", "Unknown"),
                    "category": t.get("category", "other"),
                    "date": t.get("created_at", ""),
                }
                for t in recent
            ],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_get_spending_summary(token: str) -> dict:
    """Calculate total spending and breakdown by category."""
    try:
        txs = _backend_get("/transactions", token)
        if not isinstance(txs, list):
            return {"success": False, "error": "No transactions found"}

        total = 0.0
        by_category: dict[str, float] = {}
        by_category_count: dict[str, int] = {}

        for t in txs:
            amt = float(t.get("amount", 0))
            cat = t.get("category", "other")
            total += amt
            by_category[cat] = by_category.get(cat, 0.0) + amt
            by_category_count[cat] = by_category_count.get(cat, 0) + 1

        top = max(by_category, key=by_category.get) if by_category else None
        avg = total / len(txs) if txs else 0

        return {
            "success": True,
            "total_spent": round(total, 2),
            "transaction_count": len(txs),
            "average_transaction": round(avg, 2),
            "top_category": top,
            "by_category": {k: round(v, 2) for k, v in sorted(by_category.items(), key=lambda x: -x[1])},
            "by_category_count": by_category_count,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_get_budget_status(token: str, budgets: dict | None = None) -> dict:
    """Check budget usage per category against user-defined or default limits."""
    try:
        txs = _backend_get("/transactions", token)
        if not isinstance(txs, list):
            return {"success": False, "error": "No transactions found"}

        limits = {**DEFAULT_BUDGETS, **(budgets or {})}
        by_category: dict[str, float] = {}
        for t in txs:
            cat = t.get("category", "other")
            by_category[cat] = by_category.get(cat, 0.0) + float(t.get("amount", 0))

        status = {}
        alerts = []
        for cat, spent in by_category.items():
            limit = limits.get(cat, DEFAULT_BUDGETS["other"])
            pct = round((spent / limit) * 100, 1)
            s = "ok" if pct < 80 else ("warning" if pct < 100 else "over")
            status[cat] = {
                "spent": round(spent, 2),
                "budget": limit,
                "percentage_used": pct,
                "status": s,
                "remaining": round(max(limit - spent, 0), 2),
            }
            if s == "over":
                alerts.append(f"{cat}: over by ₱{round(spent - limit, 2):,.0f}")
            elif s == "warning":
                alerts.append(f"{cat}: {pct}% used, ₱{round(limit - spent, 2):,.0f} left")

        return {
            "success": True,
            "budget_status": status,
            "alerts": alerts,
            "over_budget_categories": [c for c, v in status.items() if v["status"] == "over"],
            "warning_categories": [c for c, v in status.items() if v["status"] == "warning"],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_add_transaction(text: str, token: str) -> dict:
    """Add a new transaction by natural language text."""
    try:
        result = _backend_post("/transactions/raw", {"text": text}, token)
        return {
            "success": True,
            "saved": {
                "amount": result.get("amount"),
                "merchant": result.get("merchant"),
                "category": result.get("category"),
            },
            "message": f"Saved ₱{result.get('amount')} at {result.get('merchant')} ({result.get('category')})",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_get_top_merchants(token: str, top_n: int = 5) -> dict:
    """Find the merchants the user spends the most at."""
    try:
        txs = _backend_get("/transactions", token)
        if not isinstance(txs, list):
            return {"success": False, "error": "No transactions found"}

        merchants: dict[str, float] = {}
        for t in txs:
            m = t.get("merchant", "Unknown")
            merchants[m] = merchants.get(m, 0.0) + float(t.get("amount", 0))

        top = sorted(merchants.items(), key=lambda x: -x[1])[:top_n]
        return {
            "success": True,
            "top_merchants": [{"merchant": m, "total_spent": round(v, 2)} for m, v in top],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def tool_get_recent_transactions(token: str, n: int = 5) -> dict:
    """Get the N most recent transactions."""
    result = tool_get_transactions(token, limit=n)
    if result["success"]:
        result["transactions"] = result["transactions"][:n]
    return result


# ── Tool registry ─────────────────────────────────────────────────────────────
TOOLS = {
    "get_transactions":       tool_get_transactions,
    "get_spending_summary":   tool_get_spending_summary,
    "get_budget_status":      tool_get_budget_status,
    "add_transaction":        tool_add_transaction,
    "get_top_merchants":      tool_get_top_merchants,
    "get_recent_transactions": tool_get_recent_transactions,
}

TOOL_DESCRIPTIONS = """
Available tools (call by responding with JSON action):

1. get_transactions — Fetch all user transactions
   Args: {}

2. get_spending_summary — Total spent + breakdown by category
   Args: {}

3. get_budget_status — Check budget usage per category
   Args: {}

4. add_transaction — Add a transaction from natural language
   Args: {"text": "Spent ₱150 at Jollibee"}

5. get_top_merchants — Top merchants by spending
   Args: {"top_n": 5}

6. get_recent_transactions — Most recent N transactions
   Args: {"n": 5}

To call a tool, respond ONLY with valid JSON:
{"action": "tool_name", "args": {...}}

To give a final answer to the user, respond with plain text (no JSON).
"""
