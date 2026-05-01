from pydantic import BaseModel
from typing import Optional


class Transaction(BaseModel):
    id: Optional[int] = None
    amount: float
    merchant: Optional[str] = "Unknown"
    category: Optional[str] = "other"
    created_at: Optional[str] = None


class InsightsRequest(BaseModel):
    transactions: list[Transaction]
    budgets: Optional[dict[str, float]] = None  # user-defined limits, falls back to defaults
