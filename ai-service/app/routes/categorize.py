from fastapi import APIRouter
from pydantic import BaseModel
from app.services.categorizer import categorize_merchant

router = APIRouter()


class CategorizeRequest(BaseModel):
    merchant: str
    raw_text: str = ""


class CategorizeResponse(BaseModel):
    category: str
    confidence: str  # "high" | "medium" | "low"


@router.post("/categorize", response_model=CategorizeResponse)
def categorize(body: CategorizeRequest):
    """
    Given a merchant name (and optionally the full raw text),
    returns the best-matching spending category.
    """
    result = categorize_merchant(body.merchant, body.raw_text)
    return result
