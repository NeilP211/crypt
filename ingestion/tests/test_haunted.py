"""Tests for Haunted Places CSV parsing and caption building — no network."""

from crypt_ingest import haunted
from crypt_ingest.model import RawLocation


def test_parse_rows_builds_locations():
    rows = [
        {
            "location": "Eloise Asylum",
            "city": "Westland",
            "state": "Michigan",
            "description": "A vast abandoned psychiatric hospital said to be haunted.",
            "latitude": "42.31",
            "longitude": "-83.36",
            "city_latitude": "42.32",
            "city_longitude": "-83.40",
        }
    ]
    locations = haunted.parse_rows(rows)
    assert len(locations) == 1
    loc = locations[0]
    assert loc.name == "Eloise Asylum"
    assert loc.structure_type == "hospital"  # 'asylum' keyword
    assert abs(loc.lat - 42.31) < 1e-9
    assert abs(loc.lng + 83.36) < 1e-9
    assert loc.tags["state"] == "Michigan"


def test_parse_rows_falls_back_to_city_coordinates():
    rows = [
        {
            "location": "Foo House",
            "city": "Bar",
            "state": "NC",
            "description": "",
            "latitude": "",
            "longitude": "",
            "city_latitude": "35.2",
            "city_longitude": "-80.8",
        }
    ]
    loc = haunted.parse_rows(rows)[0]
    assert abs(loc.lat - 35.2) < 1e-9
    assert abs(loc.lng + 80.8) < 1e-9


def test_parse_rows_skips_rows_without_name_or_coords():
    rows = [
        {"location": "", "latitude": "1", "longitude": "2"},
        {"location": "No Coords", "latitude": "", "longitude": "", "city_latitude": ""},
    ]
    assert haunted.parse_rows(rows) == []


def test_caption_leads_with_name_and_place_and_truncates():
    loc = RawLocation(
        source_id="x",
        name="Old Mill",
        description="d" * 500,
        lat=1.0,
        lng=2.0,
        era="unknown",
        structure_type="factory",
        image_tag=None,
        tags={"city": "Durham", "state": "North Carolina"},
    )
    text = haunted.caption(loc, max_chars=240)
    assert text.startswith("Old Mill, Durham, North Carolina")
    assert len(text) <= 240
