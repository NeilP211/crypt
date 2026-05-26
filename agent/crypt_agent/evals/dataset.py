"""Deterministic eval sets, built from the real corpus with no LLM calls.

Two kinds:
  * retrieval set  -- (query, gold place id) pairs to score recall@k / MRR.
  * judge set      -- (question, answer, evidence, is_hallucinated) pairs to
    score how well the LLM judge catches fabricated claims.

Everything is seeded so the metrics are reproducible run to run.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass

from ..corpus import Place

_SENT_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class RetrievalCase:
    query: str
    gold_id: int
    kind: str  # "entity" or "lore"


@dataclass
class JudgeCase:
    question: str
    answer: str
    evidence: str
    is_hallucinated: bool
    note: str


def _salient_sentence(text: str) -> str | None:
    """Pick the longest early sentence as a lore query (skip the first, which
    often just restates the name)."""
    sentences = [s.strip() for s in _SENT_RE.split(text) if len(s.strip()) > 40]
    if not sentences:
        return None
    return max(sentences[:3], key=len)


def build_retrieval_evalset(
    places: list[Place], n: int = 120, seed: int = 7
) -> list[RetrievalCase]:
    rng = random.Random(seed)
    pool = [p for p in places if len(p.description) > 80]
    sample = rng.sample(pool, min(n, len(pool)))
    cases: list[RetrievalCase] = []
    for place in sample:
        # Entity query: can the system find a place by name + location?
        loc = ", ".join(p for p in (place.city, place.state) if p)
        cases.append(
            RetrievalCase(query=f"{place.name} {loc}".strip(), gold_id=place.id, kind="entity")
        )
        # Lore query: can it find the place from a description of the haunting?
        sentence = _salient_sentence(place.description)
        if sentence:
            cases.append(RetrievalCase(query=sentence, gold_id=place.id, kind="lore"))
    return cases


def build_judge_evalset(
    places: list[Place], n: int = 60, seed: int = 11
) -> list[JudgeCase]:
    rng = random.Random(seed)
    pool = [p for p in places if p.state and len(p.description) > 80]
    sample = rng.sample(pool, min(n, len(pool)))
    cases: list[JudgeCase] = []
    other_states = sorted({p.state for p in pool})

    for place in sample:
        evidence = place.citation() + " " + place.document()
        # Faithful answer: a true, grounded, cited claim.
        cases.append(
            JudgeCase(
                question=f"Tell me about {place.name}.",
                answer=f"{place.name} is in {place.state} and is reportedly haunted [{place.id}].",
                evidence=evidence,
                is_hallucinated=False,
                note="grounded",
            )
        )
        # Hallucinated answer: wrong state (a fact the evidence contradicts).
        wrong = rng.choice([s for s in other_states if s != place.state])
        cases.append(
            JudgeCase(
                question=f"Where is {place.name}?",
                answer=f"{place.name} is located in {wrong} [{place.id}].",
                evidence=evidence,
                is_hallucinated=True,
                note="wrong-location",
            )
        )
        # Hallucinated answer: fabricated specific detail not in the evidence.
        cases.append(
            JudgeCase(
                question=f"What happened at {place.name}?",
                answer=(
                    f"{place.name} is haunted by exactly 13 children who died in a "
                    f"fire in 1847, witnessed by over 400 visitors [{place.id}]."
                ),
                evidence=evidence,
                is_hallucinated=True,
                note="fabricated-detail",
            )
        )
    return cases
