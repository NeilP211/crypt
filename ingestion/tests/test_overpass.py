"""Tests for Overpass parsing and tag classification — no network."""

import json
import pathlib

from crypt_ingest import overpass

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "overpass_sample.json"


def load_elements():
    return json.loads(FIXTURE.read_text())["elements"]


def test_parse_elements_drops_features_without_coordinates():
    parsed = overpass.parse_elements(load_elements())
    # The fixture has 6 elements; one (id 505) has no coordinates.
    assert len(parsed) == 5
    assert all(loc.source_id != "node/505" for loc in parsed)


def test_parse_uses_way_center_coordinates():
    parsed = {loc.source_id: loc for loc in overpass.parse_elements(load_elements())}
    chapel = parsed["way/202"]
    assert abs(chapel.lat - 52.5201) < 1e-6
    assert abs(chapel.lng - 13.4090) < 1e-6


def test_structure_classification():
    parsed = {loc.source_id: loc for loc in overpass.parse_elements(load_elements())}
    assert parsed["node/101"].structure_type == "factory"
    assert parsed["way/202"].structure_type == "religious"
    assert parsed["node/303"].structure_type == "hospital"
    assert parsed["node/404"].structure_type == "castle"
    assert parsed["relation/606"].structure_type == "military"


def test_era_classification_from_dates_and_tags():
    parsed = {loc.source_id: loc for loc in overpass.parse_elements(load_elements())}
    assert parsed["node/101"].era == "mid-century"  # start_date 1969
    assert parsed["node/404"].era == "pre-industrial"  # start_date 1180
    assert parsed["relation/606"].era == "wartime"  # historic=bunker


def test_verified_status_from_tags():
    parsed = {loc.source_id: loc for loc in overpass.parse_elements(load_elements())}
    assert parsed["node/303"].verified_status == "verified"  # has check_date
    assert parsed["relation/606"].verified_status == "demolished"  # demolished=yes
    assert parsed["way/202"].verified_status == "unverified"


def test_image_tag_extraction():
    parsed = {loc.source_id: loc for loc in overpass.parse_elements(load_elements())}
    assert parsed["node/101"].image_tag == "https://example.org/img/spreepark.jpg"
    assert parsed["way/202"].image_tag == "File:Old Garrison Chapel Berlin.jpg"
    assert parsed["node/404"].image_tag is None


def test_derived_name_for_untagged_feature():
    # id 404 has no name tag; the parser derives one from the structure type.
    parsed = {loc.source_id: loc for loc in overpass.parse_elements(load_elements())}
    assert parsed["node/404"].name == "Abandoned castle"


def test_classify_era_year_boundaries():
    assert overpass.classify_era({"start_date": "1700"}) == "pre-industrial"
    assert overpass.classify_era({"start_date": "1900"}) == "industrial"
    assert overpass.classify_era({"start_date": "1940"}) == "wartime"
    assert overpass.classify_era({"start_date": "1965"}) == "mid-century"
    assert overpass.classify_era({"start_date": "2005"}) == "modern"
    assert overpass.classify_era({}) == "unknown"


def test_build_query_includes_bbox_and_selectors():
    query = overpass.build_query((52.0, 13.0, 53.0, 14.0))
    assert "(52.0,13.0,53.0,14.0)" in query
    assert '["historic"]' in query
    assert "out center tags" in query
