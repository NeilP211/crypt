"""Run the eval suite and print metrics.

  retrieval -- recall@1/5/10 and MRR over entity and lore queries (no key).
  judge     -- how often the LLM judge catches injected hallucinations,
               plus its false-positive rate on grounded answers (needs key).

Usage: python -m crypt_agent.cli eval [--n 120] [--judge-n 60] [--no-judge]
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from ..config import load_settings
from ..corpus import load_corpus
from ..retrieval import Retriever
from .dataset import build_judge_evalset, build_retrieval_evalset
from .judge import LLMJudge


@dataclass
class RetrievalMetrics:
    n: int
    recall_at_1: float
    recall_at_5: float
    recall_at_10: float
    mrr: float
    by_kind: dict


@dataclass
class JudgeMetrics:
    n: int
    detection_rate: float       # recall on hallucinated cases (caught / total)
    false_positive_rate: float  # grounded answers wrongly flagged
    precision: float
    accuracy: float


def run_retrieval_eval(retriever: Retriever, n: int = 120) -> RetrievalMetrics:
    cases = build_retrieval_evalset(retriever.places, n=n)
    ranks: list[int | None] = []
    kind_hits: dict[str, list[int]] = {}
    for case in cases:
        hits = retriever.search(case.query, k=10)
        rank = next((i for i, h in enumerate(hits) if h.place.id == case.gold_id), None)
        ranks.append(rank)
        kind_hits.setdefault(case.kind, []).append(1 if rank is not None and rank < 5 else 0)

    def recall_at(k: int) -> float:
        return sum(1 for r in ranks if r is not None and r < k) / len(ranks)

    mrr = sum(1.0 / (r + 1) for r in ranks if r is not None) / len(ranks)
    return RetrievalMetrics(
        n=len(ranks),
        recall_at_1=round(recall_at(1), 4),
        recall_at_5=round(recall_at(5), 4),
        recall_at_10=round(recall_at(10), 4),
        mrr=round(mrr, 4),
        by_kind={k: round(sum(v) / len(v), 4) for k, v in kind_hits.items()},
    )


def run_judge_eval(places, judge: LLMJudge, n: int = 60) -> JudgeMetrics:
    cases = build_judge_evalset(places, n=n)
    tp = fp = tn = fn = 0
    for case in cases:
        verdict = judge.score(case.question, case.answer, case.evidence)
        predicted_hallucinated = not verdict.faithful
        if case.is_hallucinated and predicted_hallucinated:
            tp += 1
        elif case.is_hallucinated and not predicted_hallucinated:
            fn += 1
        elif not case.is_hallucinated and predicted_hallucinated:
            fp += 1
        else:
            tn += 1
    halluc = tp + fn
    grounded = fp + tn
    return JudgeMetrics(
        n=len(cases),
        detection_rate=round(tp / halluc, 4) if halluc else 0.0,
        false_positive_rate=round(fp / grounded, 4) if grounded else 0.0,
        precision=round(tp / (tp + fp), 4) if (tp + fp) else 0.0,
        accuracy=round((tp + tn) / len(cases), 4) if cases else 0.0,
    )


def main(n: int = 120, judge_n: int = 60, run_judge: bool = True) -> dict:
    settings = load_settings()
    retriever = Retriever(settings=settings, places=load_corpus())
    report: dict = {"retrieval": run_retrieval_eval(retriever, n=n).__dict__}

    if run_judge and settings.has_llm:
        report["judge"] = run_judge_eval(retriever.places, LLMJudge(), n=judge_n).__dict__
    else:
        report["judge"] = "skipped (no ANTHROPIC_API_KEY)" if run_judge else "disabled"

    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":  # pragma: no cover
    main()
