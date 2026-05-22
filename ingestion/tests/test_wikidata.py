"""Tests for Wikidata result parsing and classification — no network."""

from crypt_ingest import wikidata


def test_classify_structure_from_label():
    assert wikidata.classify_structure("Old Stone Church") == "religious"
    assert wikidata.classify_structure("Biltmore Mansion") == "residential"
    assert wikidata.classify_structure("Phoenix Gold Mine") == "mine"
    assert wikidata.classify_structure("Rothenstein Castle") == "castle"
    assert wikidata.classify_structure("Eno Cotton Mill") == "factory"
    assert wikidata.classify_structure("Union Railway Station") == "rail"
    assert wikidata.classify_structure("Nondescript Landmark") == "unknown"


def test_parse_bindings_builds_locations():
    bindings = [
        {
            "item": {"value": "http://www.wikidata.org/entity/Q42"},
            "itemLabel": {"value": "Test Ruin"},
            "lat": {"value": "35.5"},
            "lon": {"value": "-80.1"},
            "image": {
                "value": "http://commons.wikimedia.org/wiki/Special:FilePath/Foo.jpg"
            },
        }
    ]
    locations = wikidata.parse_bindings(bindings)
    assert len(locations) == 1
    loc = locations[0]
    assert loc.source_id == "Q42"
    assert loc.name == "Test Ruin"
    assert abs(loc.lat - 35.5) < 1e-9
    assert abs(loc.lng + 80.1) < 1e-9
    # Image is upgraded to an HTTPS thumbnail request.
    assert loc.image_tag.startswith("https://")
    assert "width=800" in loc.image_tag


def test_parse_bindings_skips_incomplete_rows():
    bindings = [
        {  # no image
            "item": {"value": "http://www.wikidata.org/entity/Q1"},
            "itemLabel": {"value": "No Image"},
            "lat": {"value": "1"},
            "lon": {"value": "2"},
        },
        {  # no label
            "item": {"value": "http://www.wikidata.org/entity/Q2"},
            "lat": {"value": "1"},
            "lon": {"value": "2"},
            "image": {"value": "http://x/Special:FilePath/a.jpg"},
        },
    ]
    assert wikidata.parse_bindings(bindings) == []
