-- Crypt initial schema: locations (PostGIS), users, saved locations, and
-- user contributions.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Abandoned / historically interesting locations.
CREATE TABLE locations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Position of this location's image embedding in the HNSW index.
    -- NULL until the ingestion pipeline has embedded and indexed it.
    embedding_id     INTEGER UNIQUE,
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    geom             geography(Point, 4326) NOT NULL,
    era              TEXT NOT NULL DEFAULT 'unknown',
    structure_type   TEXT NOT NULL DEFAULT 'unknown',
    verified_status  TEXT NOT NULL DEFAULT 'unverified',
    verified_at      TIMESTAMPTZ,
    image_url        TEXT NOT NULL DEFAULT '',
    source           TEXT NOT NULL DEFAULT 'osm',
    source_id        TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index for radius / bounding-box / nearest-neighbor queries.
CREATE INDEX locations_geom_idx ON locations USING GIST (geom);
CREATE INDEX locations_embedding_id_idx ON locations (embedding_id);
CREATE INDEX locations_era_idx ON locations (era);
CREATE INDEX locations_structure_type_idx ON locations (structure_type);
CREATE UNIQUE INDEX locations_source_idx ON locations (source, source_id)
    WHERE source_id IS NOT NULL;

-- Registered users.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A user's saved/bookmarked locations.
CREATE TABLE saved_locations (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, location_id)
);

-- Locations submitted by users, pending review before they join `locations`.
CREATE TABLE contributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    era             TEXT NOT NULL DEFAULT 'unknown',
    structure_type  TEXT NOT NULL DEFAULT 'unknown',
    image_url       TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contributions_user_idx ON contributions (user_id);
