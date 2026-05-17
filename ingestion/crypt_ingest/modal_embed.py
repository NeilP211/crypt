"""Modal scale-out variant of the embedding stage.

The local pipeline (`cli.py`) embeds images one process at a time, which is
fine for tens of thousands of locations. For a larger crawl, this module runs
CLIP on Modal with a GPU and high fan-out.

It is intentionally optional: the repository runs end to end without Modal.
Deploy it with `modal deploy crypt_ingest/modal_embed.py`, then call
`embed_batch.remote(image_urls)`.
"""

from __future__ import annotations

try:
    import modal
except ImportError:  # Modal is an optional dependency.
    modal = None  # type: ignore[assignment]


if modal is not None:
    image = (
        modal.Image.debian_slim()
        .pip_install("open-clip-torch>=2.24", "torch>=2.1", "pillow>=10.0", "requests>=2.31")
    )
    app = modal.App("crypt-embed")

    @app.function(image=image, gpu="T4", timeout=900)
    def embed_batch(image_urls: list[str]) -> list[list[float] | None]:
        """Embed a batch of image URLs on a GPU worker.

        Returns one vector per URL, or ``None`` for any URL that failed to
        download or decode — the caller aligns results with its records.
        """
        import io

        import requests
        from PIL import Image

        from crypt_ingest.embed import Embedder

        embedder = Embedder()
        results: list[list[float] | None] = []
        for url in image_urls:
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                image_obj = Image.open(io.BytesIO(response.content))
                vector = embedder.embed_images([image_obj])[0]
                results.append(vector.tolist())
            except Exception:  # noqa: BLE001 - a failed URL must not abort the batch
                results.append(None)
        return results

    @app.local_entrypoint()
    def main() -> None:
        sample = ["https://upload.wikimedia.org/wikipedia/commons/0/0a/Example.jpg"]
        print(embed_batch.remote(sample))
