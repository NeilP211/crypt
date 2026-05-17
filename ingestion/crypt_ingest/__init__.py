"""Crypt data ingestion pipeline.

Scrapes abandoned and historic locations from OpenStreetMap, resolves their
imagery, embeds the images with CLIP, deduplicates, and loads everything into
PostGIS plus a flat embeddings file the Rust ``build-index`` binary turns into
an HNSW index.
"""

__version__ = "0.1.0"
