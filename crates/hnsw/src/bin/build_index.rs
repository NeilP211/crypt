//! Build an HNSW index from a flat embeddings file produced by the Python
//! ingestion pipeline, and persist it for the server to load.
//!
//! The embeddings file format is language-neutral:
//!
//! ```text
//! [u32 count][u32 dim][f32 ... ]   // all little-endian, row-major
//! ```
//!
//! Vector `i` becomes index id `i`, which the ingestion pipeline stores as
//! `locations.embedding_id` so a search hit maps back to a database row.
//!
//! Usage: `build-index [embeddings.bin] [out.index]`

use std::io::Read;

use hnsw::{HnswConfig, HnswIndex, Metric};

fn read_u32(reader: &mut impl Read) -> std::io::Result<u32> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf)?;
    Ok(u32::from_le_bytes(buf))
}

fn main() {
    let mut args = std::env::args().skip(1);
    let input = args.next().unwrap_or_else(|| "data/embeddings.bin".to_string());
    let output = args.next().unwrap_or_else(|| "data/crypt.index".to_string());

    let mut file = std::fs::File::open(&input)
        .unwrap_or_else(|e| panic!("cannot open embeddings file '{input}': {e}"));
    let count = read_u32(&mut file).expect("read vector count") as usize;
    let dim = read_u32(&mut file).expect("read dimension") as usize;
    assert!(count > 0 && dim > 0, "embeddings file is empty");

    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).expect("read vector data");
    assert_eq!(
        bytes.len(),
        count * dim * 4,
        "embeddings file size does not match its header ({count} x {dim})"
    );

    eprintln!("building HNSW index over {count} vectors (dim {dim})...");
    let config = HnswConfig::new(Metric::Cosine)
        .with_m(24)
        .with_ef_construction(256);
    let mut index = HnswIndex::new(dim, config);

    let mut vector = vec![0f32; dim];
    for i in 0..count {
        for (j, slot) in vector.iter_mut().enumerate() {
            let offset = (i * dim + j) * 4;
            *slot = f32::from_le_bytes([
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ]);
        }
        index.insert(&vector);
        if (i + 1) % 1000 == 0 {
            eprintln!("  indexed {}/{}", i + 1, count);
        }
    }

    if let Some(parent) = std::path::Path::new(&output).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    index.save(&output).expect("save index");
    println!("built index: {count} vectors (dim {dim}) -> {output}");
}
