"""LLM-as-judge for answer faithfulness.

The judge reads (question, answer, evidence) and decides whether the answer is
fully supported by the evidence, checking four failure modes:

  1. fabrication        -- a place or event not present in the evidence
  2. location_error     -- a place put in the wrong city/state
  3. unsupported_detail -- specific numbers/names/dates the evidence never states
  4. citation_mismatch  -- a [id] citation that the evidence does not back

It returns a structured verdict so the eval runner can measure how often it
catches injected hallucinations.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from ..llm import LLM

JUDGE_SYSTEM = """You are a strict faithfulness judge for a retrieval system.

You are given a QUESTION, an ANSWER, and the EVIDENCE that was retrieved. Decide
whether every claim in the ANSWER is directly supported by the EVIDENCE. Check
these four dimensions:
  - fabrication: a place or event not in the evidence
  - location_error: a place placed in the wrong city/state vs the evidence
  - unsupported_detail: specific numbers, names, or dates not stated in evidence
  - citation_mismatch: a [id] citation the evidence does not support

Reply with ONLY a JSON object:
{"faithful": true|false, "score": 0.0-1.0,
 "violations": ["fabrication"|"location_error"|"unsupported_detail"|"citation_mismatch", ...],
 "reason": "one sentence"}
faithful=false if ANY violation exists. Do not add prose outside the JSON."""

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


@dataclass
class Verdict:
    faithful: bool
    score: float
    violations: list[str]
    reason: str


class LLMJudge:
    def __init__(self, llm: LLM | None = None):
        self.llm = llm or LLM()

    def score(self, question: str, answer: str, evidence: str) -> Verdict:
        user = (
            f"QUESTION:\n{question}\n\nANSWER:\n{answer}\n\nEVIDENCE:\n{evidence}\n\n"
            "Return the JSON verdict."
        )
        resp = self.llm.message(
            [{"role": "user", "content": user}], system=JUDGE_SYSTEM, max_tokens=400
        )
        return _parse(resp.text)


def _parse(text: str) -> Verdict:
    match = _JSON_RE.search(text)
    if not match:
        # Be conservative: an unparseable judge reply counts as "flag it".
        return Verdict(False, 0.0, ["parse_error"], "judge returned non-JSON")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return Verdict(False, 0.0, ["parse_error"], "invalid JSON")
    return Verdict(
        faithful=bool(data.get("faithful", False)),
        score=float(data.get("score", 0.0)),
        violations=list(data.get("violations", []) or []),
        reason=str(data.get("reason", "")),
    )
