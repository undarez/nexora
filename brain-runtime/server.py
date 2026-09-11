import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from llama_cpp import Llama

MODEL_PATH = os.environ.get("NEXORA_MODEL_PATH", "/models/nexora-lia.gguf")
MODEL_NAME = os.environ.get("NEXORA_MODEL_NAME", "nexora-lia")
N_CTX = int(os.environ.get("NEXORA_N_CTX", "8192"))
N_THREADS = int(os.environ.get("NEXORA_N_THREADS", str(max(1, os.cpu_count() or 4))))
N_GPU_LAYERS = int(os.environ.get("NEXORA_N_GPU_LAYERS", "0"))
API_KEY = os.environ.get("NEXORA_BRAIN_API_KEY", "")

app = FastAPI(title="NEXORA Brain", version="0.1.0")

print(f"Loading NEXORA Brain model: {MODEL_PATH}")
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=N_CTX,
    n_threads=N_THREADS,
    n_gpu_layers=N_GPU_LAYERS,
    verbose=False,
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[Message]
    temperature: float = 0.2
    max_tokens: int | None = None
    stream: bool = False


def authorize(authorization: str | None) -> None:
    if not API_KEY:
        return
    expected = f"Bearer {API_KEY}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid NEXORA Brain API key")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/chat/completions")
def chat_completions(
    request: ChatRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    authorize(authorization)
    if request.stream:
        raise HTTPException(status_code=400, detail="Streaming is not enabled in the first NEXORA Brain runtime.")

    messages = [m.model_dump() for m in request.messages]
    result = llm.create_chat_completion(
        messages=messages,
        temperature=max(0.0, min(request.temperature, 1.5)),
        max_tokens=request.max_tokens,
    )

    choice = result["choices"][0]
    usage = result.get("usage", {})
    return {
        "id": result.get("id", "nexora-brain"),
        "object": "chat.completion",
        "model": MODEL_NAME,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": choice["message"]["content"],
                },
                "finish_reason": choice.get("finish_reason", "stop"),
            }
        ],
        "usage": usage,
    }
