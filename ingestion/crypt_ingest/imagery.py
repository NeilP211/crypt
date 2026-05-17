"""Resolve OpenStreetMap image tags to fetchable image URLs."""

from __future__ import annotations

from urllib.parse import quote

# Wikimedia's FilePath special page redirects straight to the media file and
# accepts a width parameter, so we can request a reasonably sized thumbnail.
_COMMONS_FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath"


def resolve_image_url(image_tag: str | None, *, width: int = 640) -> str | None:
    """Turn an OSM ``image`` / ``wikimedia_commons`` tag into a real URL.

    Returns ``None`` when the tag is missing or in a form we cannot resolve.
    """
    if not image_tag:
        return None
    tag = image_tag.strip()

    # A plain direct URL.
    if tag.startswith("http://") or tag.startswith("https://"):
        return tag

    # A Wikimedia Commons file reference, e.g. "File:Foo bar.jpg".
    if tag.lower().startswith("file:"):
        filename = tag[tag.index(":") + 1 :].strip().replace(" ", "_")
        return f"{_COMMONS_FILEPATH}/{quote(filename)}?width={width}"

    # A bare Commons category is not a single image — skip it.
    if tag.lower().startswith("category:"):
        return None

    return None
