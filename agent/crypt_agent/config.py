"""Runtime configuration for the Crypt agent.

The Anthropic API key is read from the environment (or a local ``.env`` that
is never committed). Everything else has a sensible default so the retrieval
and corpus layers run with no key at all.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:  # optional: load a local .env if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv is optional
    pass

# Repo-relative data directory (shared with the Rust/ingestion pipeline).
AGENT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = AGENT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

CORPUS_PATH = DATA_DIR / "corpus.jsonl"
EMBEDDINGS_PATH = DATA_DIR / "corpus_embeddings.npy"


@dataclass(frozen=True)
class Settings:
    """Resolved settings for a single run.

    ``provider`` is "anthropic" when an API key is present, otherwise "ollama"
    (a free local model). Both back the same agent + judge code.
    """

    provider: str  # "anthropic" | "ollama"
    anthropic_api_key: str | None
    model: str          # Anthropic model id
    ollama_host: str
    ollama_model: str
    embed_model: str
    rerank_model: str
    max_tokens: int

    @property
    def has_llm(self) -> bool:
        if self.provider == "anthropic":
            return bool(self.anthropic_api_key)
        return True  # ollama path; availability is checked at call time


def load_settings() -> Settings:
    key = os.environ.get("ANTHROPIC_API_KEY")
    provider = os.environ.get("CRYPT_LLM_PROVIDER", "auto")
    if provider == "auto":
        provider = "anthropic" if key else "ollama"
    return Settings(
        provider=provider,
        anthropic_api_key=key,
        # Sonnet is the price/quality sweet spot for the hosted path.
        model=os.environ.get("CRYPT_AGENT_MODEL", "claude-sonnet-4-6"),
        ollama_host=os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
        ollama_model=os.environ.get("CRYPT_OLLAMA_MODEL", "llama3.2:3b"),
        embed_model=os.environ.get("CRYPT_EMBED_MODEL", "BAAI/bge-small-en-v1.5"),
        rerank_model=os.environ.get(
            "CRYPT_RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
        ),
        max_tokens=int(os.environ.get("CRYPT_AGENT_MAX_TOKENS", "1024")),
    )
