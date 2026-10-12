from typing import Dict, List

from .config import settings


def chunk_text(
    text: str,
    chunk_size: int,
    overlap: int,
) -> List[str]:
    if not text.strip():
        return []

    chunks: List[str] = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = min(
            start + chunk_size,
            text_length,
        )

        if end < text_length:
            search_start = max(
                start + int(chunk_size * 0.65),
                start,
            )

            candidate = text.rfind(
                "\n",
                search_start,
                end,
            )

            if candidate == -1:
                candidate = text.rfind(
                    ". ",
                    search_start,
                    end,
                )

            if candidate > start:
                end = candidate + 1

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= text_length:
            break

        start = max(
            start + 1,
            end - overlap,
        )

    return chunks


def chunk_documents(
    documents: List[Dict],
) -> List[Dict]:
    output: List[Dict] = []

    for document in documents:
        chunks = chunk_text(
            document["text"],
            settings.chunk_size,
            settings.chunk_overlap,
        )

        for chunk_number, chunk in enumerate(
            chunks
        ):
            output.append(
                {
                    "text": chunk,
                    "source": document["source"],
                    "page": document.get(
                        "page",
                        0,
                    ),
                    "chunk": chunk_number,
                }
            )

    return output
