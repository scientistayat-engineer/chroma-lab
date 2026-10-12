<div align="center">

# ⚗️ Chroma Lab

### A full-stack RAG app — free local embeddings, ChromaDB vector search, Groq for answers

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_DB-6E56CF?style=for-the-badge)](https://www.trychroma.com/)
[![Groq](https://img.shields.io/badge/Groq-LLM-F55036?style=for-the-badge&logo=lightning&logoColor=white)](https://console.groq.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](#-license)

<br/>

**Built by Anushay Ayat** · AI & Data Science, SMIT

</div>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Architecture](#-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Folder Structure](#-folder-structure)
- [Getting Started](#-getting-started)
- [Running Locally](#-running-locally)
- [Using the CLI (optional)](#-using-the-cli-optional)
- [API Reference](#-api-reference)
- [Deployment](#-deployment-github--firebase-hosting--cloud-run)
- [Migrating to Chroma Cloud](#-migrating-to-chroma-cloud-optional)
- [Roadmap Ideas](#-roadmap-ideas)
- [Author](#-author)
- [License](#-license)

---

## 🧪 About the Project

**Chroma Lab** turns a Groq + ChromaDB embeddings pipeline into a real,
usable web app. The name is a small pun: ChromaDB takes its name from
*chromatography* — the lab technique that separates a mixture into its
components — which is exactly what this app does to a document: it
splits it into chunks, turns each into a vector, and files it away for
precise retrieval later.

Every answer is grounded in your own uploaded documents and cites the
**exact file, page, and chunk** it came from, with a similarity score —
so you can verify the model isn't making things up.

## 🏗 Architecture

```text
Documents (PDF / TXT / MD)
        │
        ▼
   Extract text
        │
        ▼
    Chunk text
        │
        ▼
 SentenceTransformers  ◄── 100% local, free, no API calls
 (local embeddings)
        │
        ▼
     ChromaDB
   (vector store)


      Question
        │
        ▼
 SentenceTransformers (local query embedding)
        │
        ▼
 ChromaDB similarity search
        │
        ▼
   Top-K relevant chunks
        │
        ▼
      Groq API            ◄── the ONLY network/paid call in the pipeline
        │
        ▼
    LLM answer + cited sources
```

---

## ✨ Features

| | |
|---|---|
| 📎 **Drag-and-drop upload** | PDF, TXT, or Markdown — chunked and embedded immediately |
| 🔬 **Live pipeline visualizer** | Watch each retrieval stage light up as a question is answered |
| 📌 **Cited answers** | Every answer lists source file, page, chunk, and similarity % |
| 🗂 **Document panel** | See every indexed source and how many chunks it produced |
| 🧹 **One-click reset** | Clear the whole collection and start fresh |
| 💸 **Free embeddings** | SentenceTransformers runs locally — Groq is only called for the final answer |
| 🩺 **Live health panel** | See connection status, embedding model, and Groq model at a glance |

---

## 🛠 Tech Stack

**Backend:** FastAPI · ChromaDB · SentenceTransformers · Groq API · Python 3.11
**Frontend:** HTML5 · CSS3 (custom, no framework) · Vanilla JavaScript
**Deployment:** Firebase Hosting (frontend) · Google Cloud Run (backend, via Docker)

---

## 📁 Folder Structure

```
chroma-lab/
├── app/
│   ├── chunker.py            # splits extracted text into overlapping chunks
│   ├── config.py             # settings loaded from .env
│   ├── document_loader.py    # PDF / TXT / MD text extraction
│   ├── embedding_service.py  # local SentenceTransformers embeddings
│   ├── groq_service.py       # calls Groq for the final answer only
│   ├── ingest_service.py     # orchestrates load → chunk → embed → store
│   └── vector_store.py       # ChromaDB persistent client wrapper
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── data/
│   └── sample.txt            # auto-indexed on first run if the collection is empty
├── api.py                    # FastAPI app: upload, documents, reset, query, health
├── cli.py                    # terminal chat loop (optional, no frontend needed)
├── ingest.py                 # batch-ingest everything in data/ from the command line
├── Dockerfile                # Cloud Run container build
├── firebase.json             # Hosting config + rewrite to Cloud Run
├── .firebaserc
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Python 3.10+](https://www.python.org/downloads/)
- A free [Groq API key](https://console.groq.com/)
- ~2 GB free disk space (PyTorch + the embedding model)

### Installation

```bash
git clone https://github.com/<your-username>/chroma-lab.git
cd chroma-lab
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Environment Variables

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `GROQ_API_KEY` | Your key from console.groq.com | — (required) |
| `GROQ_MODEL` | Groq model for answer generation | `openai/gpt-oss-20b` |
| `EMBEDDING_MODEL` | Local SentenceTransformers model | `sentence-transformers/all-MiniLM-L6-v2` |
| `CHROMA_PATH` | Where ChromaDB stores its files | `./chroma_db` |
| `TOP_K` | Chunks retrieved per question | `5` |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | Chunking parameters | `1200` / `200` |

> ⚠️ `.env` is already in `.gitignore` — never commit your real key.

---

## ▶️ Running Locally

```bash
uvicorn api:app --reload
```

Open **http://127.0.0.1:8000** — the backend also serves the frontend, so
there's nothing else to start. Drag a PDF into the sidebar, then ask a
question about it.

---

## 💻 Using the CLI (optional)

The original terminal-based workflow still works independently of the
web app:

```bash
python ingest.py --reset   # bulk-index everything in data/
python cli.py               # ask questions in the terminal
```

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Status, indexed chunk count, model names |
| `GET` | `/documents` | List of indexed sources with chunk counts |
| `POST` | `/upload` | Upload one or more PDF/TXT/MD files (multipart) |
| `POST` | `/reset` | Clear the entire ChromaDB collection |
| `POST` | `/rag/query` | `{ "question": "...", "top_k": 5, "source": "optional.pdf" }` |

---

## ☁️ Deployment (GitHub → Firebase Hosting + Cloud Run)

This backend bundles PyTorch and SentenceTransformers, so it's too heavy
for a typical serverless function — **Cloud Run** (which supports larger
containers and more memory) runs the backend, while **Firebase Hosting**
serves the lightweight static frontend. Firebase ties them together with
a single rewrite rule.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Chroma Lab RAG app"
git branch -M main
git remote add origin https://github.com/<your-username>/chroma-lab.git
git push -u origin main
```

### 2. Install the CLIs (one-time)

```bash
npm install -g firebase-tools
```
Also install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`).

### 3. Create a Firebase project

```bash
firebase login
firebase use --add        # pick your project, alias it "default"
```
Update `.firebaserc` with your actual project ID if it isn't filled in automatically.

### 4. Deploy the backend to Cloud Run

```bash
gcloud run deploy chroma-lab-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --max-instances 1 \
  --set-env-vars GROQ_API_KEY=your_real_key,GROQ_MODEL=openai/gpt-oss-20b
```

> 💡 `--max-instances 1` matters here: ChromaDB's storage lives on the
> container's local disk, which isn't shared between instances. Capping
> at one instance keeps every request looking at the same collection.
> (For a class assignment this is fine — for real production use, swap
> in a hosted vector DB or object storage-backed persistence.)

### 5. Deploy the frontend to Firebase Hosting

```bash
firebase deploy --only hosting
```

You'll get a live URL like `https://your-project.web.app` — every request
is routed to the Cloud Run backend automatically via `firebase.json`.

### 6. Verify

Open the Hosting URL, confirm the sidebar shows **Connected**, upload a
document, and ask it a question.

> 🔐 Your real `GROQ_API_KEY` only ever lives in your local `.env` and in
> the Cloud Run `--set-env-vars` flag — never in a file pushed to GitHub.

---

## ☁️ Migrating to Chroma Cloud (optional)

By default, the collection lives on local disk at `CHROMA_PATH` (`./chroma_db`).
That's fine for local development, but on Cloud Run it means every instance
has its own separate copy — which is why the deployment above is capped at
one instance. [Chroma Cloud](https://www.trychroma.com/) is a hosted,
serverless ChromaDB that fixes this: every instance talks to the same
database over the network instead of to its own disk.

1. Sign up at [trychroma.com](https://www.trychroma.com/) and create a database.
2. Add your credentials to `.env`:
   ```
   CHROMA_API_KEY=ck-...
   CHROMA_TENANT=...
   CHROMA_DATABASE=...
   ```
3. Run the migration script to copy everything you've already indexed locally:
   ```bash
   python migrate_to_chroma_cloud.py
   ```
   It reads your local `knowledge_base` collection in batches of 100 and
   upserts each batch into the same collection on Chroma Cloud, then prints
   a running progress count and the final record totals for both sides.

This script is a one-time copy, not a live switch — the app itself still
reads from local disk until `app/vector_store.py` is pointed at
`chromadb.CloudClient()` instead of `chromadb.PersistentClient()`. Ask if
you'd like that wired in; it removes the `--max-instances 1` restriction
in the deployment step above.

## 💡 Roadmap Ideas

- 🗃 Point `app/vector_store.py` at `chromadb.CloudClient()` instead of `PersistentClient()` (the migration script above already moves the data) so the app scales past one Cloud Run instance
- 🔐 Add simple auth so different users get their own document collection
- 📊 Show a small chart of chunk-count per document in the sidebar
- 🗣 Add streaming answers (Groq supports `stream=True`) for a more live feel
- 🌍 Attach a custom domain in Firebase Hosting settings

---

## 🙋 Author

**Anushay Ayat**
AI & Data Science Student · SMIT (Saylani Mass IT Training)

---

## 📄 License

This project is open-sourced under the [MIT License](https://opensource.org/licenses/MIT).

<div align="center">

Made with 💜 by **Anushay Ayat**

</div>
