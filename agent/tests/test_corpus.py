import io
import json

from crypt_agent.corpus import (
    Place,
    classify_structure,
    load_corpus,
    parse_csv,
    write_corpus,
)


def test_classify_structure():
    assert classify_structure("Waverly Hills Sanatorium") == "hospital"
    assert classify_structure("Bachelor's Grove Cemetery") == "cemetery"
    assert classify_structure("Old Stone Church") == "religious"
    assert classify_structure("Some Random Spot") == "unknown"


def test_parse_csv_filters_and_ids(tmp_path):
    csv_text = (
        "location,description,city,state,latitude,longitude\n"
        "Waverly Hills,A long and detailed haunting description here for testing.,Louisville,Kentucky,38.1,-85.8\n"
        "NoCoords,A description long enough to pass the length filter check.,X,Y,,\n"
        "ShortDesc,too short,A,B,1.0,2.0\n"
        "Bridge of Doom,Travelers report shadowy figures crossing at midnight here.,Salem,Oregon,44.9,-123.0\n"
    )
    path = tmp_path / "h.csv"
    path.write_text(csv_text, encoding="utf-8")
    places = parse_csv(path)
    # Only the two rows with coords + long-enough descriptions survive.
    assert [p.name for p in places] == ["Waverly Hills", "Bridge of Doom"]
    assert [p.id for p in places] == [0, 1]
    assert places[0].structure_type == "unknown"  # "Waverly Hills" has no keyword
    assert places[1].structure_type == "infrastructure"  # "Bridge"


def test_document_and_citation():
    p = Place(3, "Old Mill", "Sleepy Hollow", "New York", "It groans at night.", 41.0, -73.0, "industrial")
    assert "Old Mill (Sleepy Hollow, New York)" in p.document()
    assert p.citation() == "[3] Old Mill, Sleepy Hollow, New York"


def test_write_load_roundtrip(tmp_path):
    places = [
        Place(0, "A", "C1", "S1", "desc one", 1.0, 2.0, "cemetery"),
        Place(1, "B", "C2", "S2", "desc two", 3.0, 4.0, "hotel"),
    ]
    path = tmp_path / "corpus.jsonl"
    write_corpus(places, path=path)
    loaded = load_corpus(path=path)
    assert [p.name for p in loaded] == ["A", "B"]
    assert loaded[1].structure_type == "hotel"
