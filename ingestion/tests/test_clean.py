"""Tests for cleaning, deduplication, and the haversine helper."""

from crypt_ingest import clean
from crypt_ingest.model import RawLocation


def make(name, lat, lng, image=None):
    return RawLocation(
        source_id=f"node/{abs(hash((name, lat, lng))) % 100000}",
        name=name,
        description="",
        lat=lat,
        lng=lng,
        era="unknown",
        structure_type="factory",
        image_tag=image,
    )


def test_haversine_one_degree_of_latitude():
    # One degree of latitude is about 111 km anywhere on Earth.
    distance = clean.haversine_meters(0.0, 0.0, 1.0, 0.0)
    assert 110_000 < distance < 112_000


def test_haversine_zero_for_same_point():
    assert clean.haversine_meters(40.7, -74.0, 40.7, -74.0) == 0.0


def test_names_match_is_case_and_punctuation_insensitive():
    assert clean.names_match("Old Power Station", "old power station!")
    assert clean.names_match("Battersea Power Station", "Battersea Power Station (disused)")
    assert not clean.names_match("Eloise Asylum", "Spreepark")


def test_generic_names_never_match():
    # Two distinct unnamed ruins must not be merged on their derived names.
    assert not clean.names_match("Abandoned factory", "Abandoned factory")


def test_dedupe_merges_same_named_nearby_locations():
    locations = [
        make("Battersea Power Station", 51.4816, -0.1440),
        make("Battersea Power Station", 51.4817, -0.1441),  # ~13 m away
    ]
    assert len(clean.dedupe(locations)) == 1


def test_dedupe_keeps_distinct_locations():
    locations = [
        make("Eloise Asylum", 42.3314, -83.0458),
        make("Spreepark", 52.5145, 13.4036),
    ]
    assert len(clean.dedupe(locations)) == 2


def test_dedupe_prefers_the_record_with_imagery():
    locations = [
        make("Old Mill", 50.0, 8.0, image=None),
        make("Old Mill", 50.00005, 8.00005, image="https://example.org/mill.jpg"),
    ]
    kept = clean.dedupe(locations)
    assert len(kept) == 1
    assert kept[0].image_tag == "https://example.org/mill.jpg"


def test_clean_rejects_implausible_coordinates():
    locations = [
        make("Null Island Ruin", 0.0, 0.0),
        make("Off-globe Ruin", 95.0, 200.0),
        make("Real Ruin", 48.86, 2.34),
    ]
    cleaned = clean.clean(locations)
    assert len(cleaned) == 1
    assert cleaned[0].name == "Real Ruin"
