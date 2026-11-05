
from app.embedding_service import generate_embedding
from app.vector_db_service import search_chunks
from app.llm_service import generate_answer


def ask_question(
        question: str,
        top_k: int = 3
):
    """
    Perform Retrieval-Augmented Generation (RAG).
    """

    if not question or not question.strip():
        raise ValueError("Question cannot be empty.")

    # Step 1: Convert question into embedding
    query_embedding = generate_embedding(question)

    # Step 2: Retrieve relevant PDF chunks
    search_results = search_chunks(
        query_embedding=query_embedding,
        top_k=top_k,
        distance_threshold=0.5
    )

    # Step 3: Check whether relevant context exists
    if not search_results:
        return {
            "answer": (
                "Sorry, I couldn't find relevant "
                "information in the uploaded documents."
            ),
            "sources": []
        }

    # Step 4: Build context from retrieved chunks
    context_parts = []

    for index, result in enumerate(search_results, start=1):

        metadata = result["metadata"]

        context_parts.append(
            f"""
            [Source {index}]
            Filename: {metadata.get("filename")}
            Page: {metadata.get("page_number")}

            Content:
            {result["text"]}
            """
        )

    context = "\n\n".join(context_parts)

    # Step 5: Generate answer using LLM
    answer = generate_answer(
        question=question,
        context=context
    )

    # Step 6: Prepare source information
    sources = []

    for result in search_results:

        metadata = result["metadata"]

        sources.append({
            "filename": metadata.get("filename"),
            "page_number": metadata.get("page_number"),
            "chunk_id": result["chunk_id"],
            "distance": result["distance"]
        })

    return {
        "answer": answer,
        "sources": sources
    }
