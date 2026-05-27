"""Exercise the agent loop end to end with a scripted fake LLM (no API)."""

from types import SimpleNamespace

from crypt_agent.agent import CryptAgent
from crypt_agent.corpus import Place
from crypt_agent.llm import LLMResponse
from crypt_agent.retrieval import Hit


class FakeRetriever:
    def __init__(self):
        self.places = [
            Place(0, "Waverly Hills Sanatorium", "Louisville", "Kentucky",
                  "Thousands died of tuberculosis; a body chute is the local legend.",
                  38.1, -85.8, "hospital"),
            Place(1, "Stanley Hotel", "Estes Park", "Colorado",
                  "A grand hotel said to inspire a horror novel.", 40.3, -105.5, "hotel"),
        ]

    def search(self, query, k=5, filters=None):
        return [Hit(place=self.places[0], score=1.0)]


class FakeLLM:
    """Returns a scripted sequence: first a tool call, then a cited answer."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0
        # The agent reads provider to pick the tool-loop vs the RAG path.
        self.settings = SimpleNamespace(provider="anthropic")

    def message(self, messages, system=None, tools=None, max_tokens=None):
        resp = self.responses[self.calls]
        self.calls += 1
        return resp


def _tool_use(text, name, inp, call_id="t1"):
    return LLMResponse(
        text=text,
        tool_calls=[{"id": call_id, "name": name, "input": inp}],
        stop_reason="tool_use",
        raw=SimpleNamespace(content=[{"type": "text", "text": text}]),
    )


def _final(text):
    return LLMResponse(
        text=text, tool_calls=[], stop_reason="end_turn",
        raw=SimpleNamespace(content=[{"type": "text", "text": text}]),
    )


def test_agent_runs_tools_then_answers_grounded():
    llm = FakeLLM([
        _tool_use("Let me search.", "search_places", {"query": "tuberculosis hospital"}),
        _final("Waverly Hills Sanatorium in Kentucky is haunted by tuberculosis victims [0]."),
    ])
    agent = CryptAgent(retriever=FakeRetriever(), llm=llm)
    result = agent.answer("What is the most haunted hospital?")

    assert result.cited_ids == [0]
    assert result.seen_ids == [0]      # the search surfaced place 0
    assert result.grounded is True     # cited only what it retrieved
    assert result.steps == 2
    assert result.tool_calls[0]["name"] == "search_places"


def test_agent_rag_path_for_local_provider():
    # A non-anthropic provider uses single-shot retrieve-then-answer.
    llm = FakeLLM([_final("The most haunted hospital is Waverly Hills [0].")])
    llm.settings = SimpleNamespace(provider="ollama")
    agent = CryptAgent(retriever=FakeRetriever(), llm=llm)
    result = agent.answer("what is the most haunted hospital?")
    assert result.cited_ids == [0]
    assert result.seen_ids == [0]
    assert result.grounded is True
    assert result.steps == 1
    assert llm.calls == 1  # one shot, no tool loop


def test_agent_flags_ungrounded_citation():
    # The model cites [1] but never retrieved it -> grounded must be False.
    llm = FakeLLM([
        _tool_use("Searching.", "search_places", {"query": "hotel"}),
        _final("The Stanley Hotel is the answer [1]."),
    ])
    agent = CryptAgent(retriever=FakeRetriever(), llm=llm)
    result = agent.answer("Tell me about a haunted hotel.")
    assert result.cited_ids == [1]
    assert result.seen_ids == [0]
    assert result.grounded is False
