from typing import Any, Dict, List, Optional

from .config import settings
from .embedding_service import EmbeddingService
from .groq_service import GroqService
from .vector_store import ChromaVectorStore


class RAGService:
    def __init__(self) -> None:
        self.embedder = EmbeddingService()
        self.groq = GroqService()
        self.store = ChromaVectorStore()

    @staticmethod
    def build_context(
        results: List[Dict[str, Any]]
    ) -> str:
        blocks: List[str] = []

        for index, result in enumerate(
            results,
            start=1,
        ):
            metadata = result["metadata"]

            source = metadata.get(
                "source",
                "unknown",
            )

            page = metadata.get(
                "page",
                0,
            )

            chunk = metadata.get(
                "chunk",
                0,
            )

            page_text = (
                str(page)
                if page
                else "n/a"
            )

            blocks.append(
                (
                    f"[SOURCE {index}]\n"
                    f"File: {source}\n"
                    f"Page: {page_text}\n"
                    f"Chunk: {chunk}\n\n"
                    f'{result["text"]}\n'
                )
            )

        return "\n".join(blocks)

    def ask(
        self,
        question: str,
        top_k: Optional[int] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not question.strip():
            raise ValueError(
                "Question cannot be empty."
            )

        if self.store.count() == 0:
            raise RuntimeError(
                "ChromaDB is empty. "
                "Run ingest.py first."
            )

        query_embedding = (
            self.embedder.embed_one(
                question
            )
        )

        
        where = (
            {"source": source}
            if source and source.strip().lower() != "all"
            else None
        )


        retrieved = self.store.query(
            query_embedding=query_embedding,
            top_k=top_k or settings.top_k,
            where=where,
        )

        context = self.build_context(
            retrieved
        )

        # Groq is called only here.
        answer = self.groq.generate_answer(
            question=question,
            context=context,
        )

        sources = []

        for result in retrieved:
            metadata = result["metadata"]

            sources.append(
                {
                    "source": metadata.get(
                        "source",
                        "unknown",
                    ),
                    "page": metadata.get(
                        "page",
                        0,
                    ),
                    "chunk": metadata.get(
                        "chunk",
                        0,
                    ),
                    "distance": result[
                        "distance"
                    ],
                    "text": result["text"],
                }
            )

        return {
            "question": question,
            "answer": answer,
            "sources": sources,
        }
