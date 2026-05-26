"""Tools the agent can call, plus a dispatcher that runs them against the
retriever. Tool *schemas* are plain dicts (no SDK import) so they are easy to
unit-test and to feed to the Anthropic API verbatim.
"""

from __future__ import annotations

from .retrieval import Retriever

TOOL_SCHEMAS = [
    {
        "name": "search_places",
        "description": (
            "Search the corpus of haunted/abandoned places by a natural-language "
            "query. Use filters to narrow by US state, structure type, or geographic "
            "radius. Returns ranked places with an id and a lore snippet."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to look for."},
                "state": {"type": "string", "description": "US state name, optional."},
                "structure_type": {
                    "type": "string",
                    "description": (
                        "One of: cemetery, hospital, religious, school, theater, "
                        "hotel, infrastructure, military, industrial, landmark, "
                        "residential. Optional."
                    ),
                },
                "k": {"type": "integer", "description": "How many results (default 5)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_place",
        "description": "Fetch the full record (name, location, lore) for a place id.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "integer"}},
            "required": ["id"],
        },
    },
]


class Toolbox:
    """Executes tool calls and tracks every place the agent has seen, so the
    caller can verify citations against retrieved evidence."""

    def __init__(self, retriever: Retriever):
        self.retriever = retriever
        self.seen: dict[int, str] = {}  # id -> document text

    def run(self, name: str, payload: dict) -> dict:
        if name == "search_places":
            return self._search(payload)
        if name == "get_place":
            return self._get(payload)
        return {"error": f"unknown tool {name!r}"}

    def _search(self, payload: dict) -> dict:
        filters = {}
        if payload.get("state"):
            filters["state"] = payload["state"]
        if payload.get("structure_type"):
            filters["structure_type"] = payload["structure_type"]
        hits = self.retriever.search(
            payload["query"], k=int(payload.get("k", 5)), filters=filters or None
        )
        results = []
        for hit in hits:
            self.seen[hit.place.id] = hit.place.document()
            results.append(
                {
                    "id": hit.place.id,
                    "name": hit.place.name,
                    "location": ", ".join(
                        p for p in (hit.place.city, hit.place.state) if p
                    ),
                    "structure_type": hit.place.structure_type,
                    "snippet": hit.place.description[:300],
                }
            )
        return {"results": results}

    def _get(self, payload: dict) -> dict:
        pid = int(payload["id"])
        if pid < 0 or pid >= len(self.retriever.places):
            return {"error": f"no place with id {pid}"}
        place = self.retriever.places[pid]
        self.seen[place.id] = place.document()
        return {
            "id": place.id,
            "name": place.name,
            "location": ", ".join(p for p in (place.city, place.state) if p),
            "structure_type": place.structure_type,
            "description": place.description,
            "lat": place.lat,
            "lng": place.lng,
        }
