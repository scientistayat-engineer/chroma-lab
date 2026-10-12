from groq import Groq

from .config import settings


class GroqService:
    """
    Groq is used only for final answer generation.
    """

    def __init__(self) -> None:
        settings.validate()

        self.client = Groq(
            api_key=settings.groq_api_key
        )

    def generate_answer(
        self,
        question: str,
        context: str,
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a retrieval-augmented generation assistant. "
                    "Answer using only the retrieved document context. "
                    "Do not invent facts. If the context is insufficient, "
                    'say: "I could not find enough information in the '
                    'supplied documents." Mention source filenames when '
                    "useful."
                ),
            },
            {
                "role": "user",
                "content": (
                    "RETRIEVED CONTEXT\n"
                    "-----------------\n"
                    f"{context}\n\n"
                    "USER QUESTION\n"
                    "-------------\n"
                    f"{question}"
                ),
            },
        ]

        response = self.client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            temperature=0.1,
        )

        return response.choices[0].message.content or ""
