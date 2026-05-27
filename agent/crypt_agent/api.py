"""HTTP service that exposes the Crypt agent to the web frontend.

Endpoints:
  GET  /health          -> readiness, whether an LLM key is present, corpus size
  POST /search {query}  -> hybrid retrieval results with coordinates (no key)
  POST /ask {question}  -> grounded, cited answer + the cited places (needs key)

The retriever (and its models) load once at startup and are shared across
requests. Run with: ``uvicorn crypt_agent.api:app --port 8088``.
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import CryptAgent
from .config import load_settings
from .corpus import Place
from .llm import LLM, LLMUnavailable
from .retrieval import Retriever

app = FastAPI(title="Crypt Agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev: the Next.js frontend is a separate origin
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _retriever() -> Retriever:
    return Retriever()


@lru_cache(maxsize=1)
def _agent() -> CryptAgent:
    return CryptAgent(retriever=_retriever(), llm=LLM())


def _place_dto(place: Place) -> dict:
    return {
        "id": place.id,
        "name": place.name,
        "city": place.city,
        "state": place.state,
        "structure_type": place.structure_type,
        "lat": place.lat,
        "lng": place.lng,
        "description": place.description,
    }


class SearchRequest(BaseModel):
    query: str
    state: str | None = None
    structure_type: str | None = None
    k: int = 6


class AskRequest(BaseModel):
    question: str
    max_steps: int = 5


@app.get("/health")
def health() -> dict:
    settings = load_settings()
    active_model = settings.model if settings.provider == "anthropic" else settings.ollama_model
    return {
        "ok": True,
        "provider": settings.provider,
        "has_llm": settings.has_llm,
        "model": active_model,
        "corpus_size": len(_retriever().places),
    }


@app.post("/search")
def search(req: SearchRequest) -> dict:
    filters: dict = {}
    if req.state:
        filters["state"] = req.state
    if req.structure_type:
        filters["structure_type"] = req.structure_type
    hits = _retriever().search(req.query, k=req.k, filters=filters or None)
    return {
        "results": [
            {**_place_dto(h.place), "rerank_score": h.rerank_score} for h in hits
        ]
    }


@app.post("/ask")
def ask(req: AskRequest) -> dict:
    try:
        result = _agent().answer(req.question, max_steps=req.max_steps)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    places = _retriever().places
    cited = [_place_dto(places[i]) for i in result.cited_ids if 0 <= i < len(places)]
    return {
        "question": result.question,
        "answer": result.answer,
        "grounded": result.grounded,
        "steps": result.steps,
        "cited": cited,
    }
