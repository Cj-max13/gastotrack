"""
Spending analysis — pure Python aggregation + Gemini-generated suggestions.
"""
import time
from typing import Any
from app.services.gemini import generate

# Default budget limits (PHP) — overridden by user's Budget Settings
BUDGET_LIMITS = {
    "food": 3000,
    "transport": 1500,
    "entertainment": 1000,
    "other": 2000,
}


def _gemini_suggestions(
    cat_totals: dict,
    budget_status: dict,
    total_spent: float,
    overspending_alerts: list,
) -> list[str]:
    """Ask Gemini to generate personalised, constructive budget suggestions."""
    last_error = None
    for attempt in range(2):  # 2 attempts for insights
        try:
            breakdown = "\n".join(
                f"- {cat}: ₱{amt:,.0f} spent / ₱{budget_status[cat]['budget']:,.0f} budget "
                f"({budget_status[cat]['percentage_used']}% used, status: {budget_status[cat]['status']})"
                for cat, amt in cat_totals.items()
                if cat in budget_status
            )
            alerts = "\n".join(f"- {a['message']}" for a in overspending_alerts) or "None"
            prompt = f"""You are a friendly, constructive personal finance advisor for a Filipino user.

Here is their spending summary this period:
Total spent: ₱{total_spent:,.0f}

Category breakdown:
{breakdown}

Overspending alerts:
{alerts}

Give 3–5 short, specific, actionable suggestions to help them manage their budget better.
- Be encouraging, not judgmental.
- Use Philippine context (mention GCash, Grab, Jollibee, etc. where relevant).
- Each suggestion must be 1–2 sentences max.
- Start each with a relevant emoji.
- Do NOT repeat the numbers back — focus on advice.
- Reply as a plain list, one suggestion per line, no numbering."""

            response = generate(prompt)
            lines = [l.strip() for l in response.strip().splitlines() if l.strip()]
            return lines[:5]

        except Exception as e:
            last_error = e
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                time.sleep((attempt + 1) * 4)
                continue
            break

    # Fallback to rule-based suggestions on any error
    suggestions = []
    for cat, info in budget_status.items():
        if info["status"] == "over":
            suggestions.append(f"🚨 {cat.capitalize()}: You exceeded your budget. Try to cut back next period.")
        elif info["status"] == "warning":
            suggestions.append(f"⚠️ {cat.capitalize()}: You've used {info['percentage_used']}% of your budget.")
    if total_spent > 5000:
        suggestions.append("💡 Your total spending is high. Consider setting a weekly limit.")
    if not suggestions:
        suggestions.append("✅ Great job! Your spending looks healthy across all categories.")
    return suggestions


def analyze(
    transactions: list[dict[str, Any]],
    custom_budgets: dict[str, float] | None = None,
    category_offsets: dict[str, float] | None = None,
) -> dict[str, Any]:

    limits  = {**BUDGET_LIMITS, **(custom_budgets or {})}
    offsets = category_offsets or {}  # amounts to subtract per category

    if not transactions:
        return {
            "total_spent": 0,
            "transaction_count": 0,
            "average_transaction": 0,
            "top_category": None,
            "category_breakdown": {},
            "budget_status": {},
            "suggestions": ["Add some transactions to get personalised AI insights."],
            "overspending_alerts": [],
        }

    # Aggregate
    cat_totals: dict[str, float] = {}
    cat_counts: dict[str, int] = {}
    total_spent = 0.0

    for tx in transactions:
        try:
            amount = float(tx.get("amount") or 0)
        except (ValueError, TypeError):
            amount = 0.0
        category = str(tx.get("category") or "other").lower().strip()
        cat_totals[category] = cat_totals.get(category, 0.0) + amount
        cat_counts[category] = cat_counts.get(category, 0) + 1
        total_spent += amount

    transaction_count = len(transactions)
    average_transaction = total_spent / transaction_count if transaction_count else 0.0
    top_category = max(cat_totals, key=cat_totals.get) if cat_totals else None

    # Apply reset offsets — subtract from each category's total
    # (floor at 0 so it never goes negative)
    adjusted_totals = {
        cat: max(0.0, amt - offsets.get(cat, 0.0))
        for cat, amt in cat_totals.items()
    }
    adjusted_total = sum(adjusted_totals.values())

    # Budget status — uses adjusted totals (after reset offsets)
    budget_status: dict[str, Any] = {}
    overspending_alerts: list[dict[str, Any]] = []

    for cat, spent in adjusted_totals.items():
        limit = limits.get(cat, limits.get("other", 2000))
        pct = round((spent / limit) * 100, 1) if limit > 0 else 0
        status = "ok"

        if pct >= 100:
            status = "over"
            over_by = round(spent - limit, 2)
            overspending_alerts.append({
                "category": cat,
                "spent": round(spent, 2),
                "budget": limit,
                "over_by": over_by,
                "message": f"You've exceeded your {cat} budget by ₱{over_by:,.0f}.",
            })
        elif pct >= 80:
            status = "warning"

        budget_status[cat] = {
            "spent": round(spent, 2),
            "budget": limit,
            "percentage_used": pct,
            "status": status,
            "transaction_count": cat_counts.get(cat, 0),
        }

    # Gemini-generated suggestions
    suggestions = _gemini_suggestions(adjusted_totals, budget_status, adjusted_total, overspending_alerts)

    return {
        "total_spent": round(adjusted_total, 2),
        "transaction_count": transaction_count,
        "average_transaction": round(average_transaction, 2),
        "top_category": top_category,
        "category_breakdown": {cat: round(amt, 2) for cat, amt in adjusted_totals.items()},
        "budget_status": budget_status,
        "suggestions": suggestions,
        "overspending_alerts": overspending_alerts,
    }
