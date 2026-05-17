//! Hierarchical Navigable Small World (HNSW) index.
//!
//! A from-scratch implementation of the algorithm described in Malkov &
//! Yashunin, *"Efficient and robust approximate nearest neighbor search using
//! Hierarchical Navigable Small World graphs"* (2018).
//!
//! The index is a layered proximity graph. The bottom layer contains every
//! vector; each higher layer contains an exponentially thinning sample. A
//! search descends greedily from the top layer's entry point to layer 0, then
//! runs a best-first expansion on layer 0 with a tunable beam width (`ef`).

use std::cmp::{Ordering, Reverse};
use std::collections::{BinaryHeap, HashSet};

use rand::Rng;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use serde::{Deserialize, Serialize};

use crate::distance::Metric;

/// Tuning parameters for an [`HnswIndex`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HnswConfig {
    /// Number of neighbors selected per node per layer during construction.
    pub m: usize,
    /// Maximum neighbor capacity on layer 0 (conventionally `2 * m`).
    pub m_max0: usize,
    /// Beam width used while building the graph. Higher = better graph, slower.
    pub ef_construction: usize,
    /// Default beam width used at query time. Higher = better recall, slower.
    pub ef_search: usize,
    /// Distance metric.
    pub metric: Metric,
    /// Seed for the (reproducible) layer-assignment RNG.
    pub seed: u64,
}

impl HnswConfig {
    /// Sensible defaults (`m = 16`) for the given metric.
    pub fn new(metric: Metric) -> Self {
        let m = 16;
        Self {
            m,
            m_max0: m * 2,
            ef_construction: 200,
            ef_search: 64,
            metric,
            seed: 0x5EED_C0DE,
        }
    }

    /// Set `m` (and `m_max0` to `2 * m`).
    pub fn with_m(mut self, m: usize) -> Self {
        self.m = m;
        self.m_max0 = m * 2;
        self
    }

    /// Set the construction beam width.
    pub fn with_ef_construction(mut self, ef: usize) -> Self {
        self.ef_construction = ef;
        self
    }

    /// Set the default query-time beam width.
    pub fn with_ef_search(mut self, ef: usize) -> Self {
        self.ef_search = ef;
        self
    }

    /// Set the layer-assignment RNG seed.
    pub fn with_seed(mut self, seed: u64) -> Self {
        self.seed = seed;
        self
    }

    /// The `mL` normalization constant from the paper: `1 / ln(m)`.
    fn level_mult(&self) -> f64 {
        1.0 / (self.m.max(2) as f64).ln()
    }
}

/// One graph node: its per-layer adjacency lists. `connections[0]` is layer 0.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Node {
    connections: Vec<Vec<u32>>,
}

/// A `(distance, id)` pair ordered by distance, for use in the search heaps.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Scored {
    dist: f32,
    id: u32,
}

impl Eq for Scored {}

impl Ord for Scored {
    fn cmp(&self, other: &Self) -> Ordering {
        self.dist.total_cmp(&other.dist)
    }
}

impl PartialOrd for Scored {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// An approximate-nearest-neighbor index over fixed-dimension `f32` vectors.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HnswIndex {
    config: HnswConfig,
    dim: usize,
    /// Row-major vector storage: vector `id` is `vectors[id*dim .. id*dim+dim]`.
    vectors: Vec<f32>,
    nodes: Vec<Node>,
    entry_point: Option<u32>,
    max_layer: usize,
    /// Monotonic counter feeding the per-insert RNG for reproducible levels.
    rng_counter: u64,
}

impl HnswIndex {
    /// Create an empty index for `dim`-dimensional vectors.
    pub fn new(dim: usize, config: HnswConfig) -> Self {
        assert!(dim > 0, "dimension must be positive");
        Self {
            config,
            dim,
            vectors: Vec::new(),
            nodes: Vec::new(),
            entry_point: None,
            max_layer: 0,
            rng_counter: 0,
        }
    }

    /// Number of indexed vectors.
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    /// Whether the index holds no vectors.
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Vector dimensionality.
    pub fn dim(&self) -> usize {
        self.dim
    }

    /// The index's configuration.
    pub fn config(&self) -> &HnswConfig {
        &self.config
    }

    /// Read back a stored vector by id.
    pub fn get_vector(&self, id: u32) -> Option<&[f32]> {
        let start = id as usize * self.dim;
        self.vectors.get(start..start + self.dim)
    }

    #[inline]
    fn vector(&self, id: u32) -> &[f32] {
        let start = id as usize * self.dim;
        &self.vectors[start..start + self.dim]
    }

    #[inline]
    fn dist_to(&self, query: &[f32], id: u32) -> f32 {
        self.config.metric.distance(query, self.vector(id))
    }

    /// Draw a layer for a new node from a geometric distribution.
    fn random_level(&mut self) -> usize {
        let mut rng = ChaCha8Rng::seed_from_u64(self.config.seed ^ self.rng_counter);
        self.rng_counter = self.rng_counter.wrapping_add(1);
        let r: f64 = rng.gen_range(f64::MIN_POSITIVE..1.0);
        (-r.ln() * self.config.level_mult()) as usize
    }

    /// Insert a vector and return its assigned id (its insertion index).
    pub fn insert(&mut self, vector: &[f32]) -> u32 {
        assert_eq!(vector.len(), self.dim, "vector dimension mismatch");
        let id = self.nodes.len() as u32;
        let level = self.random_level();

        self.vectors.extend_from_slice(vector);
        self.nodes.push(Node {
            connections: vec![Vec::new(); level + 1],
        });

        let entry = match self.entry_point {
            None => {
                self.entry_point = Some(id);
                self.max_layer = level;
                return id;
            }
            Some(ep) => ep,
        };

        // Phase 1: greedily descend the empty upper layers with a beam of 1.
        let top = self.max_layer;
        let mut ep = vec![entry];
        let mut layer = top;
        while layer > level {
            let found = self.search_layer(vector, &ep, 1, layer);
            ep = vec![found[0].id];
            layer -= 1;
        }

        // Phase 2: from min(level, top) down to 0, connect the new node.
        let start_layer = level.min(top);
        for layer in (0..=start_layer).rev() {
            let candidates = self.search_layer(vector, &ep, self.config.ef_construction, layer);
            let selected = self.select_neighbors(&candidates, self.config.m);

            self.nodes[id as usize].connections[layer] = selected.clone();

            let m_max = if layer == 0 {
                self.config.m_max0
            } else {
                self.config.m
            };
            for &nbr in &selected {
                self.nodes[nbr as usize].connections[layer].push(id);
                if self.nodes[nbr as usize].connections[layer].len() > m_max {
                    self.prune_neighbors(nbr, layer, m_max);
                }
            }

            ep = candidates.iter().map(|s| s.id).collect();
        }

        if level > self.max_layer {
            self.max_layer = level;
            self.entry_point = Some(id);
        }
        id
    }

    /// Re-select a node's neighbor list down to `m_max` using the heuristic.
    fn prune_neighbors(&mut self, node: u32, layer: usize, m_max: usize) {
        let node_vec = self.vector(node).to_vec();
        let mut conns: Vec<Scored> = self.nodes[node as usize].connections[layer]
            .iter()
            .map(|&c| Scored {
                dist: self.config.metric.distance(&node_vec, self.vector(c)),
                id: c,
            })
            .collect();
        conns.sort_unstable();
        self.nodes[node as usize].connections[layer] = self.select_neighbors(&conns, m_max);
    }

    /// Best-first search confined to a single layer.
    ///
    /// Returns the `ef` closest nodes found, sorted ascending by distance.
    fn search_layer(&self, query: &[f32], entry: &[u32], ef: usize, layer: usize) -> Vec<Scored> {
        let mut visited: HashSet<u32> = HashSet::with_capacity(ef * 8);
        // Min-heap of nodes still to expand (closest first).
        let mut candidates: BinaryHeap<Reverse<Scored>> = BinaryHeap::new();
        // Max-heap of the best `ef` results found (worst on top, easy to evict).
        let mut results: BinaryHeap<Scored> = BinaryHeap::new();

        for &e in entry {
            let d = self.dist_to(query, e);
            visited.insert(e);
            candidates.push(Reverse(Scored { dist: d, id: e }));
            results.push(Scored { dist: d, id: e });
        }
        while results.len() > ef {
            results.pop();
        }

        while let Some(Reverse(c)) = candidates.pop() {
            let worst = results.peek().map(|s| s.dist).unwrap_or(f32::INFINITY);
            if c.dist > worst && results.len() >= ef {
                break;
            }
            if let Some(neighbors) = self.nodes[c.id as usize].connections.get(layer) {
                for &e in neighbors {
                    if visited.insert(e) {
                        let d = self.dist_to(query, e);
                        let worst = results.peek().map(|s| s.dist).unwrap_or(f32::INFINITY);
                        if d < worst || results.len() < ef {
                            candidates.push(Reverse(Scored { dist: d, id: e }));
                            results.push(Scored { dist: d, id: e });
                            if results.len() > ef {
                                results.pop();
                            }
                        }
                    }
                }
            }
        }

        results.into_sorted_vec()
    }

    /// The neighbor-selection heuristic from the paper: prefer candidates that
    /// are closer to the query than to any already-selected neighbor, which
    /// keeps the graph diverse and well-connected. Falls back to plain nearest
    /// if the heuristic prunes below `m`.
    fn select_neighbors(&self, candidates: &[Scored], m: usize) -> Vec<u32> {
        let mut selected: Vec<u32> = Vec::with_capacity(m);
        for &cand in candidates {
            if selected.len() >= m {
                break;
            }
            let cand_vec = self.vector(cand.id);
            let keep = selected.iter().all(|&r| {
                self.config.metric.distance(cand_vec, self.vector(r)) >= cand.dist
            });
            if keep {
                selected.push(cand.id);
            }
        }
        if selected.len() < m {
            for &cand in candidates {
                if selected.len() >= m {
                    break;
                }
                if !selected.contains(&cand.id) {
                    selected.push(cand.id);
                }
            }
        }
        selected
    }

    /// Search for the `k` nearest neighbors of `query` using the configured
    /// `ef_search`. Returns `(id, distance)` pairs sorted by ascending distance.
    pub fn search(&self, query: &[f32], k: usize) -> Vec<(u32, f32)> {
        self.search_with_ef(query, k, self.config.ef_search)
    }

    /// As [`search`](Self::search) but with an explicit beam width, letting
    /// callers trade latency for recall per query.
    pub fn search_with_ef(&self, query: &[f32], k: usize, ef: usize) -> Vec<(u32, f32)> {
        assert_eq!(query.len(), self.dim, "query dimension mismatch");
        let entry = match self.entry_point {
            None => return Vec::new(),
            Some(ep) => ep,
        };

        let mut ep = vec![entry];
        let mut layer = self.max_layer;
        while layer > 0 {
            let found = self.search_layer(query, &ep, 1, layer);
            ep = vec![found[0].id];
            layer -= 1;
        }

        self.search_layer(query, &ep, ef.max(k), 0)
            .into_iter()
            .take(k)
            .map(|s| (s.id, s.dist))
            .collect()
    }
}
