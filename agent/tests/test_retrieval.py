import numpy as np
import pytest

from crypt_agent.corpus import Place
from crypt_agent.retrieval import Retriever, _haversine_km, _tokenize, reciprocal_rank_fusion


def test_tokenize():
    assert _tokenize("Waverly Hills, KY!") == ["waverly", "hills", "ky"]


def test_rrf_rewards_agreement():
    # doc 1 is high in both lists -> should win; doc 3 only in one.
    fused = reciprocal_rank_fusion([[1, 2, 3], [1, 4, 2]])
    assert max(fused, key=fused.get) == 1
    assert fused[2] > fused[3]


def test_haversine_known_distance():
    # NYC to LA is ~3936 km.
    d = _haversine_km(40.7128, -74.0060, 34.0522, -118.2437)
    assert 3900 < d < 3980


@pytest.fixture
def tiny_retriever(monkeypatch):
    places = [
        Place(0, "Waverly Hills Sanatorium", "Louisville", "Kentucky",
              "A tuberculosis hospital where thousands died; nurses report a body chute.", 38.1, -85.8, "hospital"),
        Place(1, "Bachelors Grove Cemetery", "Midlothian", "Illinois",
              "An abandoned graveyard with a phantom farmhouse and a white lady.", 41.6, -87.8, "cemetery"),
        Place(2, "Stanley Hotel", "Estes Park", "Colorado",
              "A grand hotel that inspired a famous horror novel; piano plays itself.", 40.3, -105.5, "hotel"),
    ]
    r = Retriever(places=places)

    # Fake dense encoder: map known words to fixed unit vectors so cosine is deterministic.
    vocab = {"hospital": 0, "cemetery": 1, "hotel": 2, "graveyard": 1}

    def fake_encode(texts, normalize_embeddings=True, show_progress_bar=False):
        vecs = []
        for t in texts:
            v = np.zeros(3, dtype="float32")
            for w, idx in vocab.items():
                if w in t.lower():
                    v[idx] += 1.0
            if v.sum() == 0:
                v[0] = 1e-3
            v /= np.linalg.norm(v)
            vecs.append(v)
        return np.array(vecs, dtype="float32")

    class FakeEncoder:
        def encode(self, texts, normalize_embeddings=True, show_progress_bar=False):
            return fake_encode(texts, normalize_embeddings, show_progress_bar)

    class FakeReranker:
        def predict(self, pairs):
            # Reward lexical overlap between query and doc.
            scores = []
            for q, d in pairs:
                q_tok, d_tok = set(_tokenize(q)), set(_tokenize(d))
                scores.append(len(q_tok & d_tok))
            return scores

    monkeypatch.setattr(Retriever, "encoder", property(lambda self: FakeEncoder()))
    monkeypatch.setattr(Retriever, "reranker", property(lambda self: FakeReranker()))
    r._embeddings = fake_encode([p.document() for p in places])
    return r


def test_search_finds_relevant(tiny_retriever):
    hits = tiny_retriever.search("haunted graveyard with a white lady", k=2)
    assert hits[0].place.id == 1  # the cemetery


def test_search_state_filter(tiny_retriever):
    hits = tiny_retriever.search("haunted place", k=5, filters={"state": "Colorado"})
    assert {h.place.id for h in hits} == {2}


def test_search_structure_filter(tiny_retriever):
    hits = tiny_retriever.search("anything", k=5, filters={"structure_type": "hospital"})
    assert [h.place.id for h in hits] == [0]
