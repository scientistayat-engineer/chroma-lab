from app.rag_service import RAGService


def main() -> None:
    rag = RAGService()

    print("\nGroq + ChromaDB RAG")
    print(
        "Embeddings: SentenceTransformers (local/free)"
    )
    print("LLM: Groq")
    print("Type 'exit' to quit.\n")

    while True:
        question = input(
            "Question: "
        ).strip()

        if question.lower() in {
            "exit",
            "quit",
            "q",
        }:
            break

        if not question:
            continue

        try:
            result = rag.ask(
                question
            )

            print("\nANSWER")
            print(result["answer"])

            print(
                "\nRETRIEVED SOURCES"
            )

            for source in result["sources"]:
                print(
                    f'- {source["source"]} | '
                    f'page={source["page"] or "n/a"} | '
                    f'chunk={source["chunk"]} | '
                    f'distance='
                    f'{source["distance"]:.4f}'
                )

            print()

        except Exception as exc:
            print(
                f"\nERROR: {exc}\n"
            )


if __name__ == "__main__":
    main()
