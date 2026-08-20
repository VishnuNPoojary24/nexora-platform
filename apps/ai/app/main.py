from pydantic import BaseModel
from fastapi import FastAPI

app = FastAPI(
    title="Nexora AI",
    version="0.1.0",
)


class ChatRequest(BaseModel):
    message: str
    context: dict | None = None


class SummarizeRequest(BaseModel):
    text: str


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "nexora-ai",
    }


@app.get("/ready")
async def ready():
    return {
        "status": "ready",
        "services": {
            "llm": "placeholder",
            "langchain": "available",
            "langgraph": "available",
        },
    }


@app.post("/api/v1/ai/chat")
async def chat(request: ChatRequest):
    return {
        "success": True,
        "data": {
            "message": "Nexora AI is running in placeholder mode. Configure an LLM provider to enable grounded assistance.",
            "echo": request.message,
        },
    }


@app.post("/api/v1/ai/summarize")
async def summarize(request: SummarizeRequest):
    preview = request.text.strip().replace("\n", " ")
    if len(preview) > 220:
        preview = f"{preview[:217]}..."

    return {
        "success": True,
        "data": {
            "summary": preview or "No content supplied.",
            "mode": "placeholder",
        },
    }
