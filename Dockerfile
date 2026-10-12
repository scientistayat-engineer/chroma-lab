# Backend container for Google Cloud Run
FROM python:3.11-slim

WORKDIR /app

# System libs some wheels (torch, chromadb) need at import time
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# CPU-only torch is a fraction of the size of the default CUDA build —
# sentence-transformers only needs CPU inference for a model this small.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake the embedding model into the image at build time so the first
# request on a cold start doesn't have to download it from the internet.
RUN python -c "from sentence_transformers import SentenceTransformer; \
    import os; \
    SentenceTransformer(os.getenv('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2'))"

ENV PORT=8080
CMD exec uvicorn api:app --host 0.0.0.0 --port ${PORT}
