"""Evaluation harness: retrieval metrics + LLM-judge faithfulness scoring."""

from .dataset import build_judge_evalset, build_retrieval_evalset
from .judge import LLMJudge, Verdict

__all__ = [
    "build_retrieval_evalset",
    "build_judge_evalset",
    "LLMJudge",
    "Verdict",
]
