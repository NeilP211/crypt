"""Hybrid retrieval over the Crypt corpus.

Pipeline: dense (BGE sentence embeddings) + sparse (BM25) candidate sets,
fused with Reciprocal Rank Fusion, then re-ordered by a cross-encoder
reranker. Metadata and geo filters are applied before fusion so they never
get drowned out by lexical noise.

Models are loaded lazily so importing this module (and running the unit tests
that monkeypatch the encoders) stays cheap.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .config import EMBEDDINGS_PATH, Settings, load_settings
from .corpus import Place, load_corpus

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


@dataclass
class Hit:
    place: Place
    score: float
    # How the candidate was found, for debugging/eval transparency.
    dense_rank: int | None = None
    sparse_rank: int | None = None
    rerank_score: float | None = None


def reciprocal_rank_fusion(
    ranked_lists: list[list[int]], k: int = 60
) -> dict[int, float]:
    """Standard RRF: each list contributes 1 / (k + rank) to every id."""
    scores: dict[int, float] = {}
    for ranking in ranked_lists:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return scores


class Retriever:
    """Loads the corpus once, builds dense + sparse indexes, serves queries."""

    def __init__(self, settings: Settings | None = None, places: list[Place] | None = None):
        self.settings = settings or load_settings()
        self.places = places if places is not None else load_corpus()
        self.docs = [p.document() for p in self.places]
        self._embeddings: np.ndarray | None = None
        self._bm25 = None
        self._encoder = None
        self._reranker = None

    # ---- lazy model / index construction -------------------------------

    @property
    def encoder(self):
        if self._encoder is None:
            from sentence_transformers import SentenceTransformer

            self._encoder = SentenceTransformer(self.settings.embed_model)
        return self._encoder

    @property
    def reranker(self):
        if self._reranker is None:
            from sentence_transformers import CrossEncoder

            self._reranker = CrossEncoder(self.settings.rerank_model)
        return self._reranker

    @property
    def bm25(self):
        if self._bm25 is None:
            from rank_bm25 import BM25Okapi

            self._bm25 = BM25Okapi([_tokenize(d) for d in self.docs])
        return self._bm25

    def embeddings(self, cache: Path = EMBEDDINGS_PATH) -> np.ndarray:
        """Encode the corpus once and memoize to disk (L2-normalized)."""
        if self._embeddings is not None:
            return self._embeddings
        if cache.exists():
            cached = np.load(cache)
            if cached.shape[0] == len(self.docs):
                self._embeddings = cached
                return cached
        vectors = self.encoder.encode(
            self.docs, normalize_embeddings=True, show_progress_bar=False
        ).astype("float32")
        np.save(cache, vectors)
        self._embeddings = vectors
        return vectors

    # ---- query path -----------------------------------------------------

    def _candidate_ids(self, filters: dict | None) -> list[int]:
        if not filters:
            return list(range(len(self.places)))
        keep: list[int] = []
        state = (filters.get("state") or "").lower()
        structure = (filters.get("structure_type") or "").lower()
        near = filters.get("near")  # (lat, lng, radius_km)
        for i, place in enumerate(self.places):
            if state and place.state.lower() != state:
                continue
            if structure and place.structure_type != structure:
                continue
            if near and _haversine_km(place.lat, place.lng, near[0], near[1]) > near[2]:
                continue
            keep.append(i)
        return keep

    def dense(self, query: str, candidates: list[int], n: int) -> list[int]:
        vectors = self.embeddings()
        q = self.encoder.encode([query], normalize_embeddings=True)[0].astype("float32")
        sims = vectors[candidates] @ q
        order = np.argsort(-sims)[:n]
        return [candidates[i] for i in order]

    def sparse(self, query: str, candidates: list[int], n: int) -> list[int]:
        scores = self.bm25.get_scores(_tokenize(query))
        ranked = sorted(candidates, key=lambda i: scores[i], reverse=True)
        return ranked[:n]

    def search(
        self,
        query: str,
        k: int = 5,
        filters: dict | None = None,
        candidate_pool: int = 40,
        rerank: bool = True,
    ) -> list[Hit]:
        """Return the top-``k`` places for ``query`` after fuse + rerank."""
        candidates = self._candidate_ids(filters)
        if not candidates:
            return []
        dense_ids = self.dense(query, candidates, candidate_pool)
        sparse_ids = self.sparse(query, candidates, candidate_pool)
        fused = reciprocal_rank_fusion([dense_ids, sparse_ids])
        dense_rank = {d: r for r, d in enumerate(dense_ids)}
        sparse_rank = {d: r for r, d in enumerate(sparse_ids)}

        pool = sorted(fused, key=lambda d: fused[d], reverse=True)[: max(k * 4, 20)]
        hits = [
            Hit(
                place=self.places[doc_id],
                score=fused[doc_id],
                dense_rank=dense_rank.get(doc_id),
                sparse_rank=sparse_rank.get(doc_id),
            )
            for doc_id in pool
        ]

        if rerank and hits:
            pairs = [(query, h.place.document()) for h in hits]
            rerank_scores = self.reranker.predict(pairs)
            for hit, rs in zip(hits, rerank_scores):
                hit.rerank_score = float(rs)
            hits.sort(key=lambda h: h.rerank_score, reverse=True)
        return hits[:k]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
