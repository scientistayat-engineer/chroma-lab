from typing import Any, Dict, List, Optional

import chromadb

from .config import settings


class ChromaVectorStore:
    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(
            path=settings.chroma_path
        )

        self.collection = self.client.get_or_create_collection(
            name=settings.chroma_collection,
            metadata={
                "hnsw:space": "cosine"
            },
        )

    def count(self) -> int:
        return self.collection.count()

    def upsert(
        self,
        ids: List[str],
        texts: List[str],
        metadatas: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> None:
        self.collection.upsert(
            ids=ids,
            documents=texts,
            metadatas=metadatas,
            embeddings=embeddings,
        )

    def query(
        self,
        query_embedding: List[float],
        top_k: int,
        where: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        kwargs: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
            "include": [
                "documents",
                "metadatas",
                "distances",
            ],
        }

        if where:
            kwargs["where"] = where

        results = self.collection.query(
            **kwargs
        )

        ids = results.get(
            "ids",
            [[]],
        )[0]

        documents = (
            results.get("documents")
            or [[]]
        )[0]

        metadatas = (
            results.get("metadatas")
            or [[]]
        )[0]

        distances = (
            results.get("distances")
            or [[]]
        )[0]

        output: List[Dict[str, Any]] = []

        for (
            record_id,
            document,
            metadata,
            distance,
        ) in zip(
            ids,
            documents,
            metadatas,
            distances,
        ):
            output.append(
                {
                    "id": record_id,
                    "text": document,
                    "metadata": metadata or {},
                    "distance": distance,
                }
            )

        return output

    def reset_collection(self) -> None:
        try:
            self.client.delete_collection(
                name=settings.chroma_collection
            )
        except Exception:
            pass

        self.collection = self.client.get_or_create_collection(
            name=settings.chroma_collection,
            metadata={
                "hnsw:space": "cosine"
            },
        )
