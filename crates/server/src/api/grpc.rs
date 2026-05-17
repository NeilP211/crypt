//! gRPC surface: a `tonic` implementation of the `SearchService` defined in
//! `crypt-proto`. It shares the exact same search and ranking code as REST.

use crypt_proto::{
    GeoPoint, HealthRequest, HealthResponse, LocationResult, SearchRequest, SearchResponse,
};
use tonic::{Request, Response, Status};

use crate::domain::{ScoredLocation, SearchFilters, SearchQuery};
use crate::search;
use crate::state::AppState;

const DEFAULT_LIMIT: u32 = 20;

/// gRPC handler holding shared application state.
pub struct GrpcSearch {
    pub state: AppState,
}

fn to_proto(scored: ScoredLocation) -> LocationResult {
    let loc = scored.location;
    LocationResult {
        id: loc.id.to_string(),
        name: loc.name,
        description: loc.description,
        point: Some(GeoPoint {
            lat: loc.lat,
            lng: loc.lng,
        }),
        era: loc.era,
        structure_type: loc.structure_type,
        verified_status: loc.verified_status,
        image_url: loc.image_url,
        vector_score: scored.vector_score,
        geo_score: scored.geo_score,
        hybrid_score: scored.hybrid_score,
        distance_meters: scored.distance_meters,
    }
}

#[tonic::async_trait]
impl crypt_proto::SearchService for GrpcSearch {
    async fn search(
        &self,
        request: Request<SearchRequest>,
    ) -> Result<Response<SearchResponse>, Status> {
        let req = request.into_inner();
        let limit = if req.limit == 0 {
            DEFAULT_LIMIT
        } else {
            req.limit
        };
        let query = SearchQuery {
            embedding: req.embedding,
            origin: req.origin.map(|p| (p.lat, p.lng)),
            radius_meters: req.radius_meters,
            filters: SearchFilters {
                era: req.era,
                structure_type: req.structure_type,
                verified_status: req.verified_status,
            },
            limit: (limit as usize).clamp(1, 100),
        };
        // AppError implements Into<tonic::Status>.
        let results = search::run_search(&self.state, query).await?;
        Ok(Response::new(SearchResponse {
            results: results.into_iter().map(to_proto).collect(),
        }))
    }

    async fn health(
        &self,
        _request: Request<HealthRequest>,
    ) -> Result<Response<HealthResponse>, Status> {
        Ok(Response::new(HealthResponse {
            status: "ok".to_string(),
            indexed_vectors: self.state.index.len() as u64,
        }))
    }
}
