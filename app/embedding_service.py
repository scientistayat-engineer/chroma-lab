from typing import Iterable, List

from sentence_transformers import SentenceTransformer

from .config import settings


class EmbeddingService:
    """
    FREE local embedding generation.

    This model runs on your own computer.
    No Groq API calls are used for embeddings.
    """

    def __init__(self) -> None:
        self.model = SentenceTransformer(
            settings.embedding_model
        )

    def embed(
        self,
        texts: Iterable[str],
    ) -> List[List[float]]:
        texts = list(texts)

        if not texts:
            return []

        vectors = self.model.encode(
            texts,
            normalize_embeddings=True,
            batch_size=settings.embedding_batch_size,
            show_progress_bar=False,
        )

        return vectors.tolist()

    def embed_one(
        self,
        text: str,
    ) -> List[float]:
        return self.embed([text])[0]
