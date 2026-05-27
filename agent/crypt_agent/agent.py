"""The Crypt agent: a planner that answers questions about haunted and
abandoned places by retrieving evidence with tools, then writing a grounded,
cited answer.

The loop is the standard Anthropic tool-use cycle: send the conversation, run
any tool calls the model returns, feed the results back, repeat until the
model stops asking for tools (or a step budget is hit).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .llm import LLM
from .retrieval import Retriever
from .tools import TOOL_SCHEMAS, Toolbox

SYSTEM_PROMPT = """You are Crypt, a research agent for haunted and abandoned places.

Answer the user's question ONLY from evidence returned by your tools. Workflow:
1. Plan what to search for. Break compound questions into separate searches.
2. Call `search_places` (use state/structure_type filters when the question
   implies them). Call `get_place` when you need a place's full lore.
3. Write a concise answer grounded in what you found. After every factual
   claim, cite the place id in square brackets like [12]. Never cite an id you
   did not retrieve. If the corpus has no answer, say so plainly.

Keep answers tight: a few sentences or a short list, each item cited."""

# Used for the local-model (Ollama) path, which retrieves first then answers.
RAG_SYSTEM = (
    "You are Crypt, answering questions about haunted and abandoned places "
    "strictly from the evidence given to you, citing each place's id in square "
    "brackets. Never invent places or details."
)

_CITE_RE = re.compile(r"\[(\d+)\]")


@dataclass
class AgentResult:
    question: str
    answer: str
    cited_ids: list[int]
    seen_ids: list[int]
    steps: int
    tool_calls: list[dict] = field(default_factory=list)

    @property
    def grounded(self) -> bool:
        """True iff every cited id was actually retrieved."""
        return all(cid in self.seen_ids for cid in self.cited_ids)


class CryptAgent:
    def __init__(self, retriever: Retriever | None = None, llm: LLM | None = None):
        self.retriever = retriever or Retriever()
        self.llm = llm or LLM()

    def answer(self, question: str, max_steps: int = 5) -> AgentResult:
        # The tool-use loop targets Anthropic; the local (Ollama) path uses a
        # single-shot retrieve-then-answer, reliable on small models.
        if self.llm.settings.provider != "anthropic":
            return self._answer_rag(question)
        toolbox = Toolbox(self.retriever)
        messages: list[dict] = [{"role": "user", "content": question}]
        tool_calls_log: list[dict] = []
        steps = 0

        while steps < max_steps:
            steps += 1
            resp = self.llm.message(
                messages, system=SYSTEM_PROMPT, tools=TOOL_SCHEMAS
            )
            # Record the assistant turn verbatim so tool_result blocks line up.
            messages.append({"role": "assistant", "content": resp.raw.content})

            if not resp.tool_calls:
                cited = sorted({int(m) for m in _CITE_RE.findall(resp.text)})
                return AgentResult(
                    question=question,
                    answer=resp.text,
                    cited_ids=cited,
                    seen_ids=sorted(toolbox.seen),
                    steps=steps,
                    tool_calls=tool_calls_log,
                )

            tool_results = []
            for call in resp.tool_calls:
                output = toolbox.run(call["name"], call["input"])
                tool_calls_log.append({"name": call["name"], "input": call["input"]})
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call["id"],
                        "content": _stringify(output),
                    }
                )
            messages.append({"role": "user", "content": tool_results})

        # Out of steps: ask for a final answer with no further tools.
        messages.append(
            {"role": "user", "content": "Stop searching and answer now with citations."}
        )
        resp = self.llm.message(messages, system=SYSTEM_PROMPT)
        cited = sorted({int(m) for m in _CITE_RE.findall(resp.text)})
        return AgentResult(
            question=question,
            answer=resp.text,
            cited_ids=cited,
            seen_ids=sorted(toolbox.seen),
            steps=steps,
            tool_calls=tool_calls_log,
        )


    def _answer_rag(self, question: str, k: int = 6) -> AgentResult:
        """Single-shot retrieve-then-answer, used for the local-model path."""
        hits = self.retriever.search(question, k=k)
        context = "\n".join(f"[{h.place.id}] {h.place.document()}" for h in hits)
        prompt = (
            f"PLACES:\n{context}\n\nQUESTION: {question}\n\n"
            "Answer using ONLY the places above. After each factual claim, cite the "
            "place id in square brackets like [12]. If the places do not answer the "
            "question, say so plainly. Keep it to a few sentences."
        )
        resp = self.llm.message([{"role": "user", "content": prompt}], system=RAG_SYSTEM)
        cited = sorted({int(m) for m in _CITE_RE.findall(resp.text)})
        return AgentResult(
            question=question,
            answer=resp.text,
            cited_ids=cited,
            seen_ids=sorted({h.place.id for h in hits}),
            steps=1,
            tool_calls=[],
        )


def _stringify(output: dict) -> str:
    import json

    return json.dumps(output, ensure_ascii=False)
