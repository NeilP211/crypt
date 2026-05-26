from crypt_agent.corpus import Place
from crypt_agent.evals.dataset import build_judge_evalset, build_retrieval_evalset
from crypt_agent.evals.judge import _parse
from crypt_agent.evals.run_evals import run_judge_eval, run_retrieval_eval


def _places(n=40):
    states = ["Ohio", "Texas", "Maine", "Nevada"]
    return [
        Place(
            i, f"Place {i}", f"City{i}", states[i % len(states)],
            f"This is a sufficiently long haunting description number {i}. "
            f"Witnesses describe cold spots and a recurring apparition near the stairs.",
            30.0 + i * 0.1, -90.0 - i * 0.1, "unknown",
        )
        for i in range(n)
    ]


def test_retrieval_evalset_deterministic_and_valid():
    places = _places()
    a = build_retrieval_evalset(places, n=10)
    b = build_retrieval_evalset(places, n=10)
    assert [(c.query, c.gold_id) for c in a] == [(c.query, c.gold_id) for c in b]
    assert all(0 <= c.gold_id < len(places) for c in a)
    assert {c.kind for c in a} <= {"entity", "lore"}


def test_judge_evalset_balanced():
    cases = build_judge_evalset(_places(), n=10)
    halluc = sum(c.is_hallucinated for c in cases)
    grounded = sum(not c.is_hallucinated for c in cases)
    # Each place yields 1 grounded + 2 hallucinated cases.
    assert halluc == 2 * grounded


def test_judge_parse_handles_good_and_bad():
    good = _parse('{"faithful": false, "score": 0.1, "violations": ["location_error"], "reason": "wrong state"}')
    assert good.faithful is False and "location_error" in good.violations
    bad = _parse("the model rambled with no json")
    assert bad.faithful is False and "parse_error" in bad.violations


class _FakeRetriever:
    """Returns the gold place at a fixed rank for entity queries, missing for lore."""

    def __init__(self, places):
        self.places = places

    def search(self, query, k=10, filters=None):
        class H:
            def __init__(self, place):
                self.place = place
        # Entity queries are "<name> <loc>"; match the name as an exact prefix
        # so "Place 3" does not spuriously match "Place 37". Lore queries (a
        # description sentence) contain no name and correctly miss.
        gold = next(
            (p for p in self.places if query == p.name or query.startswith(p.name + " ")),
            None,
        )
        return [H(gold)] if gold else []


def test_run_retrieval_eval_metrics():
    places = _places()
    m = run_retrieval_eval(_FakeRetriever(places), n=10)
    # Entity queries always hit at rank 0; lore queries miss -> recall@1 ~0.5.
    assert m.recall_at_1 == m.recall_at_5
    assert 0.4 <= m.recall_at_1 <= 0.6
    assert m.by_kind["entity"] == 1.0


class _FakeJudge:
    """Flags everything that mentions a wrong state or a fabricated number."""

    def score(self, question, answer, evidence):
        from crypt_agent.evals.judge import Verdict
        faithful = "13 children" not in answer and not _wrong_state(answer, evidence)
        return Verdict(faithful, 1.0 if faithful else 0.0, [] if faithful else ["x"], "")


def _wrong_state(answer, evidence):
    # crude: the grounded answer says "reportedly haunted", hallucinated says "located in <wrong>"
    return "located in" in answer


def test_run_judge_eval_detection():
    m = run_judge_eval(_places(), _FakeJudge(), n=8)
    assert m.detection_rate == 1.0     # catches both hallucination types
    assert m.false_positive_rate == 0.0
