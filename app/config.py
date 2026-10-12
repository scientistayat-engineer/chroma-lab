import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")

    groq_model: str = os.getenv(
        "GROQ_MODEL",
        "openai/gpt-oss-20b",
    )

    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL",
        "sentence-transformers/all-MiniLM-L6-v2",
    )

    chroma_path: str = os.getenv(
        "CHROMA_PATH",
        "./chroma_db",
    )

    chroma_collection: str = os.getenv(
        "CHROMA_COLLECTION",
        "knowledge_base",
    )

    top_k: int = int(os.getenv("TOP_K", "5"))
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "1200"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "200"))

    embedding_batch_size: int = int(
        os.getenv("EMBEDDING_BATCH_SIZE", "64")
    )

    def validate(self) -> None:
        if not self.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is missing. Copy .env.example to .env "
                "and add your Groq API key."
            )

        if self.chunk_size <= 0:
            raise ValueError(
                "CHUNK_SIZE must be greater than 0."
            )

        if self.chunk_overlap < 0:
            raise ValueError(
                "CHUNK_OVERLAP cannot be negative."
            )

        if self.chunk_overlap >= self.chunk_size:
            raise ValueError(
                "CHUNK_OVERLAP must be smaller than CHUNK_SIZE."
            )

        if self.top_k <= 0:
            raise ValueError(
                "TOP_K must be greater than 0."
            )


settings = Settings()
