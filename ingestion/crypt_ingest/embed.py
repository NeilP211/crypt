"""CLIP image embedding via open_clip.

`torch` and `open_clip` are imported lazily inside `Embedder` so the rest of
the pipeline — scraping, cleaning, loading — and the test suite do not pay the
cost of importing a deep-learning stack.
"""

from __future__ import annotations

import io

import numpy as np

# ViT-B/32 produces 512-dimensional embeddings; the LAION-2B checkpoint is a
# strong general-purpose image encoder and is what the index is sized for.
DEFAULT_MODEL = "ViT-B-32"
DEFAULT_PRETRAINED = "laion2b_s34b_b79k"


class Embedder:
    """Wraps an open_clip model and exposes batched image embedding."""

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        pretrained: str = DEFAULT_PRETRAINED,
        device: str | None = None,
    ) -> None:
        import open_clip
        import torch

        self._torch = torch
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            model_name, pretrained=pretrained
        )
        self.model = self.model.eval().to(self.device)
        self.tokenizer = open_clip.get_tokenizer(model_name)
        self.dim = int(getattr(self.model.visual, "output_dim", 512))

    def embed_images(self, images: list) -> np.ndarray:
        """Embed a batch of PIL images, returning L2-normalized row vectors."""
        torch = self._torch
        tensors = [self.preprocess(im.convert("RGB")) for im in images]
        batch = torch.stack(tensors).to(self.device)
        with torch.no_grad():
            features = self.model.encode_image(batch)
            features = features / features.norm(dim=-1, keepdim=True)
        return features.cpu().numpy().astype("float32")

    def embed_bytes(self, data: bytes) -> np.ndarray:
        """Embed a single image given its raw bytes."""
        from PIL import Image

        image = Image.open(io.BytesIO(data))
        return self.embed_images([image])[0]

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        """Embed a batch of captions with CLIP's text encoder.

        CLIP image and text embeddings share one space, so these vectors are
        directly comparable to image embeddings — letting a photo query match
        text-described locations. Captions over CLIP's 77-token limit are
        truncated by the tokenizer.
        """
        torch = self._torch
        tokens = self.tokenizer(texts).to(self.device)
        with torch.no_grad():
            features = self.model.encode_text(tokens)
            features = features / features.norm(dim=-1, keepdim=True)
        return features.cpu().numpy().astype("float32")
