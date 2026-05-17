//! Binary persistence for an [`HnswIndex`].
//!
//! The whole index — vectors, graph, and configuration — is serialized with
//! `bincode`. This lets the ingestion pipeline build an index offline and the
//! server load it at startup without rebuilding.

use std::fs;
use std::io;
use std::path::Path;

use crate::index::HnswIndex;

/// Error returned by [`HnswIndex::save`] / [`HnswIndex::load`].
#[derive(Debug)]
pub enum PersistError {
    /// Filesystem failure.
    Io(io::Error),
    /// The bytes on disk were not a valid serialized index.
    Codec(String),
}

impl std::fmt::Display for PersistError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PersistError::Io(e) => write!(f, "io error: {e}"),
            PersistError::Codec(e) => write!(f, "codec error: {e}"),
        }
    }
}

impl std::error::Error for PersistError {}

impl From<io::Error> for PersistError {
    fn from(e: io::Error) -> Self {
        PersistError::Io(e)
    }
}

impl HnswIndex {
    /// Serialize the index to `path`, overwriting any existing file.
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), PersistError> {
        let bytes =
            bincode::serialize(self).map_err(|e| PersistError::Codec(e.to_string()))?;
        fs::write(path, bytes)?;
        Ok(())
    }

    /// Load an index previously written by [`save`](Self::save).
    pub fn load<P: AsRef<Path>>(path: P) -> Result<HnswIndex, PersistError> {
        let bytes = fs::read(path)?;
        bincode::deserialize(&bytes).map_err(|e| PersistError::Codec(e.to_string()))
    }

    /// Serialize the index to an in-memory byte buffer.
    pub fn to_bytes(&self) -> Result<Vec<u8>, PersistError> {
        bincode::serialize(self).map_err(|e| PersistError::Codec(e.to_string()))
    }

    /// Deserialize an index from a byte buffer.
    pub fn from_bytes(bytes: &[u8]) -> Result<HnswIndex, PersistError> {
        bincode::deserialize(bytes).map_err(|e| PersistError::Codec(e.to_string()))
    }
}
