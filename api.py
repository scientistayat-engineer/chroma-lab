import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.config import settings
from app.document_loader import SUPPORTED_SUFFIXES
from app.ingest_service import IngestionService
from app.rag_service import RAGService

app = FastAPI(
    title="Groq + ChromaDB RAG API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR / "frontend"

rag_service: Optional[RAGService] = None
ingestion_service: Optional[IngestionService] = None


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: Optional[int] = Field(default=None, ge=1, le=50)
    source: Optional[str] = None


@app.on_event("startup")
def startup() -> None:
    global rag_service, ingestion_service
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    rag_service = RAGService()
    ingestion_service = IngestionService()

    # Reuse the SAME embedder + vector store the RAG service already loaded,
    # instead of loading the SentenceTransformer model twice and risking
    # two ChromaDB collection handles drifting out of sync after a reset.
    ingestion_service.embedder = rag_service.embedder
    ingestion_service.store = rag_service.store

    # Nice-to-have: if the collection is empty but data/ already has files
    # (e.g. the bundled sample.txt on a fresh clone), index them automatically
    # so the app isn't an empty shell on first run.
    if rag_service.store.count() == 0 and any(DATA_DIR.glob("*")):
        ingestion_service.ingest(directory=str(DATA_DIR), reset=False)


@app.get("/health")
def health():
    if rag_service is None:
        return {"status": "starting"}

    return {
        "status": "ok",
        "indexed_chunks": rag_service.store.count(),
        "embedding_model": settings.embedding_model,
        "groq_model": settings.groq_model,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "top_k": settings.top_k,
    }


@app.get("/documents")
def list_documents():
    if rag_service is None:
        raise HTTPException(503, "Service is not ready.")

    raw = rag_service.store.collection.get(include=["metadatas"])
    metadatas = raw.get("metadatas") or []

    counts: dict = {}
    for meta in metadatas:
        source = meta.get("source", "unknown")
        counts[source] = counts.get(source, 0) + 1

    documents = [
        {"source": source, "chunks": count}
        for source, count in sorted(counts.items())
    ]

    return {"documents": documents, "total_chunks": len(metadatas)}


@app.post("/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    if ingestion_service is None:
        raise HTTPException(503, "Service is not ready.")

    if not files:
        raise HTTPException(400, "No files were provided.")

    tmp_dir = Path(tempfile.mkdtemp(prefix="rag_upload_"))
    saved: List[str] = []
    errors: List[dict] = []

    try:
        for upload in files:
            filename = upload.filename or "unnamed"
            suffix = Path(filename).suffix.lower()

            if suffix not in SUPPORTED_SUFFIXES:
                errors.append(
                    {
                        "filename": filename,
                        "error": f"Unsupported file type '{suffix or 'unknown'}'. "
                        "Use PDF, TXT, or MD.",
                    }
                )
                continue

            content = await upload.read()
            if not content.strip():
                errors.append({"filename": filename, "error": "File is empty."})
                continue

            # Keep a permanent copy in data/ so `python ingest.py --reset`
            # from the CLI still picks up everything that was ever uploaded.
            (DATA_DIR / filename).write_bytes(content)
            (tmp_dir / filename).write_bytes(content)
            saved.append(filename)

        if not saved:
            raise HTTPException(
                400,
                detail=errors or [{"error": "No valid files were uploaded."}],
            )

        result = ingestion_service.ingest(directory=str(tmp_dir), reset=False)
        result["uploaded"] = saved
        result["errors"] = errors
        return result

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.post("/reset")
def reset_collection():
    if rag_service is None:
        raise HTTPException(503, "Service is not ready.")

    rag_service.store.reset_collection()

    # Also clear the on-disk copies so a stale upload can't be re-ingested
    # by accident later.
    for item in DATA_DIR.glob("*"):
        if item.is_file():
            item.unlink()

    return {"status": "reset", "collection_count": rag_service.store.count()}


@app.post("/rag/query")
def query_rag(payload: QuestionRequest):
    if rag_service is None:
        raise HTTPException(status_code=503, detail="RAG service is not ready.")

    try:
        return rag_service.ask(
            question=payload.question,
            top_k=payload.top_k,
            source=payload.source,
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Serve the frontend (index.html, style.css, script.js) at "/"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
