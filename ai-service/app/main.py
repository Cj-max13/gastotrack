from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routes.insights import router as insights_router
from app.routes.categorize import router as categorize_router
from app.routes.chat import router as chat_router

load_dotenv()  # loads GEMINI_API_KEY from ai-service/.env

app = FastAPI(
    title="GastoTrack AI Service",
    description="Gemini-powered spending analysis, categorization, and chatbot",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(insights_router, prefix="/ai")
app.include_router(categorize_router, prefix="/ai")
app.include_router(chat_router, prefix="/ai")


@app.get("/health")
def health():
    return {"status": "ok", "service": "gastotrack-ai", "version": "2.0.0"}
