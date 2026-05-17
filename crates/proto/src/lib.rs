//! Generated gRPC types for the Crypt search service.
//!
//! The `.proto` definitions live in `proto/crypt.proto` and are compiled by
//! `build.rs` via `tonic-build`. This crate simply re-exports the generated
//! module so the server and any client can depend on a stable path.

pub mod crypt {
    #![allow(clippy::all)]
    tonic::include_proto!("crypt");
}

pub use crypt::{
    search_service_client::SearchServiceClient,
    search_service_server::{SearchService, SearchServiceServer},
    GeoPoint, HealthRequest, HealthResponse, LocationResult, SearchRequest, SearchResponse,
};
