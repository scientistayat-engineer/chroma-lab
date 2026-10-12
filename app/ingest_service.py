import hashlib
from typing import Dict, List

from .chunker import chunk_documents
from .config import settings
from .document_loader import load_directory
from .embedding_service import EmbeddingService
from .vector_store import ChromaVectorStore


def make_chunk_id(
    item: Dict,
) -> str:
    raw = (
        f'{item["source"]}|'
        f'{item.get("page", 0)}|'
        f'{item["chunk"]}|'
        f'{item["text"]}'
    )

    return hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()


class IngestionService:
    def __init__(self) -> None:
        self.embedder = EmbeddingService()
        self.store = ChromaVectorStore()

    def ingest(
        self,
        directory: str = "./data",
        reset: bool = False,
    ) -> Dict:
        if reset:
            self.store.reset_collection()

        raw_documents = load_directory(
            directory
        )

        chunks = chunk_documents(
            raw_documents
        )

        if not chunks:
            return {
                "documents_loaded": len(raw_documents),
                "chunks_upserted": 0,
                "collection_count": self.store.count(),
            }

        batch_size = settings.embedding_batch_size
        inserted = 0

        for start in range(
            0,
            len(chunks),
            batch_size,
        ):
            batch = chunks[
                start:start + batch_size
            ]

            texts = [
                item["text"]
                for item in batch
            ]

            # Completely local/free.
            embeddings = self.embedder.embed(
                texts
            )

            ids = [
                make_chunk_id(item)
                for item in batch
            ]

            metadatas: List[Dict] = [
                {
                    "source": item["source"],
                    "page": int(
                        item.get("page", 0)
                    ),
                    "chunk": int(
                        item["chunk"]
                    ),
                    "embedding_model": (
                        settings.embedding_model
                    ),
                }
                for item in batch
            ]

            self.store.upsert(
                ids=ids,
                texts=texts,
                metadatas=metadatas,
                embeddings=embeddings,
            )

            inserted += len(batch)

            print(
                f"Embedded/stored "
                f"{inserted}/{len(chunks)} chunks"
            )

        return {
            "documents_loaded": len(raw_documents),
            "chunks_upserted": inserted,
            "collection_count": self.store.count(),
            "embedding_model": settings.embedding_model,
        }
