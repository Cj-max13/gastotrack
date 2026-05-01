from fastapi import APIRouter
from app.models.schemas import InsightsRequest
from app.services.analysis import analyze

router = APIRouter()


@router.post("/insights")
def get_insights(body: InsightsRequest):
    """
    Analyze a list of transactions and return:
    - Total spent & average transaction
    - Category breakdown
    - Budget status per category (ok / warning / over)
    - Overspending alerts
    - Budget suggestions

    Optionally pass `budgets` to override the default category limits.
    """
    transactions = [t.model_dump() for t in body.transactions]
    return analyze(transactions, custom_budgets=body.budgets, category_offsets=body.category_offsets)
