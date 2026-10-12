import argparse
import json

from app.ingest_service import IngestionService


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate local embeddings and store "
            "documents in ChromaDB."
        )
    )

    parser.add_argument(
        "--data-dir",
        default="./data",
    )

    parser.add_argument(
        "--reset",
        action="store_true",
    )

    args = parser.parse_args()

    result = IngestionService().ingest(
        directory=args.data_dir,
        reset=args.reset,
    )

    print(
        json.dumps(
            result,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
