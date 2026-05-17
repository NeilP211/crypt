# ADR 0002 — Use MapLibre GL JS instead of Mapbox GL JS

**Status:** accepted

## Context

The frontend needs an interactive vector/raster map for pins, clustering, and
fly-to navigation. Mapbox GL JS is the well-known option, but since v2 it
requires a Mapbox account and an access token, and its license is no longer
open source.

## Decision

Use **MapLibre GL JS**, the open-source fork of Mapbox GL JS, with CARTO's
free dark basemap tiles.

## Rationale

- **Clone-and-run.** A Mapbox token is a secret; it cannot live in a public
  repository. MapLibre needs no token, so `git clone` to a working map is
  frictionless — important for a portfolio project a reviewer will run.
- **API compatibility.** MapLibre forked from Mapbox GL JS v1; the API used
  here (`Map`, `Marker`, `Popup`, `NavigationControl`) is identical, so the
  code reads the same as a Mapbox integration.
- **Licensing.** MapLibre is BSD-licensed; no usage restrictions.

## Consequences

- No Mapbox-only features (e.g. Mapbox-hosted styles, some 3D terrain APIs).
  None are needed here.
- Basemap tiles come from CARTO's free endpoint; a production deployment would
  use its own tile source or a self-hosted style.
