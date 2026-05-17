//! # hnsw
//!
//! A from-scratch Hierarchical Navigable Small World index for approximate
//! nearest-neighbor search — the vector-search core of the Crypt project.
//!
//! The implementation has no third-party ANN dependency: the layered graph,
//! the best-first layer search, and the neighbor-selection heuristic are all
//! built here. It is benchmarked for recall against brute-force exact kNN.
//!
//! ## Example
//!
//! ```
//! use hnsw::{HnswConfig, HnswIndex, Metric};
//!
//! let mut index = HnswIndex::new(4, HnswConfig::new(Metric::Cosine));
//! index.insert(&[1.0, 0.0, 0.0, 0.0]);
//! index.insert(&[0.0, 1.0, 0.0, 0.0]);
//! index.insert(&[0.9, 0.1, 0.0, 0.0]);
//!
//! let hits = index.search(&[1.0, 0.0, 0.0, 0.0], 2);
//! assert_eq!(hits[0].0, 0); // exact match is nearest
//! ```

pub mod distance;
pub mod eval;
mod index;
mod persist;

pub use distance::{cosine_distance, l2_squared, normalize, Metric};
pub use index::{HnswConfig, HnswIndex};
pub use persist::PersistError;
