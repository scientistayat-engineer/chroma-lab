from pathlib import Path
from typing import Dict, List

from pypdf import PdfReader


SUPPORTED_SUFFIXES = {".pdf", ".txt", ".md"}


def load_pdf(path: Path) -> List[Dict]:
    reader = PdfReader(str(path))
    pages: List[Dict] = []

    for page_number, page in enumerate(
        reader.pages,
        start=1,
    ):
        text = page.extract_text() or ""

        if text.strip():
            pages.append(
                {
                    "text": text,
                    "source": path.name,
                    "page": page_number,
                }
            )

    return pages


def load_text_file(path: Path) -> List[Dict]:
    text = path.read_text(
        encoding="utf-8"
    )

    if not text.strip():
        return []

    return [
        {
            "text": text,
            "source": path.name,
            "page": 0,
        }
    ]


def load_file(path: Path) -> List[Dict]:
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return load_pdf(path)

    if suffix in {".txt", ".md"}:
        return load_text_file(path)

    return []


def load_directory(
    directory: str,
) -> List[Dict]:
    root = Path(directory)

    if not root.exists():
        raise FileNotFoundError(
            f"Data directory does not exist: {directory}"
        )

    documents: List[Dict] = []

    for path in sorted(root.rglob("*")):
        if (
            path.is_file()
            and path.suffix.lower() in SUPPORTED_SUFFIXES
        ):
            documents.extend(
                load_file(path)
            )

    return documents
