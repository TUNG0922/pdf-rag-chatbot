
from ollama import chat


MODEL_NAME = "qwen2.5:3b"


def generate_answer(
        question: str,
        context: str
):
    """
    Generate an answer using retrieved PDF context.
    """

    system_prompt = """
    You are a helpful PDF question-answering assistant.

    Answer the user's question based ONLY on the provided context.

    Rules:
    1. Do not use external knowledge.
    2. If the context does not contain the answer,
       clearly say that the answer cannot be found
       in the uploaded documents.
    3. Give clear and easy-to-understand answers.
    4. Answer in the same language as the user's question.
    """

    user_prompt = f"""
    Context from PDF documents:

    {context}

    User Question:
    {question}

    Please answer based on the context above.
    """

    response = chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        options={
            "temperature": 0.2
        }
    )

    return response.message.content
