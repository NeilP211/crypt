"""HTTP embedding service.

The Rust backend does not run a neural network. When a user uploads a photo,
the backend POSTs it here and receives a CLIP embedding to feed into the ANN
index. Run it with:

    uvicorn crypt_ingest.embed_service:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile

from .embed import Embedder

app = FastAPI(title="Crypt Embedding Service", version="0.1.0")

# The model is loaded lazily on the first request so the process starts fast
# and test imports of this module stay cheap.
_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = Embedder()
    return _embedder


@app.get("/health")
def health() -> dict:
    """Liveness probe. Reports whether the model has been loaded yet."""
    return {"status": "ok", "model_loaded": _embedder is not None}


@app.post("/embed")
async def embed(file: UploadFile = File(...)) -> dict:
    """Embed an uploaded image and return its CLIP vector."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty upload")
    try:
        vector = get_embedder().embed_bytes(data)
    except Exception as error:  # noqa: BLE001 - surface decode failures as 400
        raise HTTPException(status_code=400, detail=f"could not embed image: {error}")
    return {"embedding": vector.tolist(), "dim": int(vector.shape[0])}
