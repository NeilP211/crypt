"""Tests for OSM image-tag resolution."""

from crypt_ingest import imagery


def test_direct_url_is_returned_unchanged():
    url = "https://example.org/photo.jpg"
    assert imagery.resolve_image_url(url) == url


def test_wikimedia_file_tag_becomes_filepath_url():
    resolved = imagery.resolve_image_url("File:Old Garrison Chapel Berlin.jpg")
    assert resolved is not None
    assert "Special:FilePath" in resolved
    assert "Old_Garrison_Chapel_Berlin.jpg" in resolved
    assert "width=640" in resolved


def test_custom_width_is_honored():
    resolved = imagery.resolve_image_url("File:Foo.jpg", width=1024)
    assert "width=1024" in resolved


def test_category_tag_is_unresolvable():
    assert imagery.resolve_image_url("Category:Abandoned places") is None


def test_missing_tag_returns_none():
    assert imagery.resolve_image_url(None) is None
    assert imagery.resolve_image_url("") is None
