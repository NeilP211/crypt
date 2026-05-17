"""Tests for the flat embeddings file format.

The format is the contract between the Python pipeline and the Rust
``build-index`` binary, so a round-trip test guards it from drift.
"""

import struct

import numpy as np
import pytest

from crypt_ingest import load


def test_embeddings_file_round_trips(tmp_path):
    vectors = np.random.default_rng(0).standard_normal((37, 16)).astype("float32")
    path = tmp_path / "embeddings.bin"
    load.write_embeddings_file(str(path), vectors)
    restored = load.read_embeddings_file(str(path))
    assert restored.shape == (37, 16)
    np.testing.assert_allclose(restored, vectors, rtol=1e-6)


def test_embeddings_file_header_matches_rust_reader(tmp_path):
    # The Rust build-index binary reads [u32 count][u32 dim] little-endian.
    vectors = np.zeros((5, 8), dtype="float32")
    path = tmp_path / "embeddings.bin"
    load.write_embeddings_file(str(path), vectors)
    with open(path, "rb") as handle:
        count, dim = struct.unpack("<II", handle.read(8))
    assert (count, dim) == (5, 8)


def test_write_rejects_non_2d_array(tmp_path):
    with pytest.raises(ValueError):
        load.write_embeddings_file(str(tmp_path / "bad.bin"), np.zeros(10, dtype="float32"))
