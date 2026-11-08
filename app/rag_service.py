
from app.embedding_service import generate_embedding
from app.vector_db_service import search_chunks
from app.llm_service import generate_answer
from app import config


# Short/vague follow-up phrases that carry no topic of their own. When the
# current question looks like one of these, we lean on earlier turns for the
# retrieval topic. Kept multilingual (English + Chinese) and matched loosely.
_FOLLOWUP_HINTS = (
    "more example", "another example", "more detail", "explain", "elaborate",
    "go on", "continue", "more", "example",
    "更多", "例子", "继续", "详细", "再", "多一些", "多一点", "展开", "具体",
)


def _looks_like_followup(text: str) -> bool:
    t = text.strip().lower()
    # Short questions, or ones that contain a follow-up hint, are treated as
    # continuations that don't carry their own topic.
    if len(t) <= 12:
        return True
    return any(h in t for h in _FOLLOWUP_HINTS)


def is_followup_question(question: str, history: list | None = None) -> bool:
    """
    True when the current question is a short/vague continuation that relies on
    the earlier conversation rather than standing on its own. Such answers are
    driven by the conversation + model knowledge, so retrieval "sources" are
    not a faithful attribution for them.
    """
    if not history:
        return False
    return _looks_like_followup(question)


def build_retrieval_query(question: str, history: list | None = None) -> str:
    """
    Build the text used for semantic retrieval.

    For follow-up questions that are short or refer back ("more examples",
    "explain further", "能不能给我更多的例子"), the current question carries no
    topic of its own. In that case we anchor retrieval to the actual topic from
    earlier in the conversation (the substantive user questions) so we keep
    pulling chunks about the SAME subject instead of drifting.
    """
    if not history:
        return question

    user_turns = [
        m["content"].strip()
        for m in history
        if m.get("role") == "user" and m.get("content") and m["content"].strip()
    ]

    if not user_turns:
        return question

    if _looks_like_followup(question):
        # Anchor on substantive earlier questions (ones that aren't themselves
        # just follow-up phrases). Fall back to all prior user turns.
        substantive = [u for u in user_turns if not _looks_like_followup(u)]
        anchor = substantive if substantive else user_turns
        # Use the most recent substantive topic(s) plus the current phrasing.
        return " ".join(anchor[-2:] + [question])

    # A self-contained question: a little recent context still helps.
    return " ".join(user_turns[-1:] + [question])


def retrieve_context(
        question: str,
        top_k: int = 3,
        distance_threshold: float | None = None,
        history: list | None = None
):
    """
    Retrieve relevant chunks for a question.

    Returns a tuple (context, sources):
      - context: formatted string to feed the LLM, or None if nothing relevant
      - sources: list of source metadata dicts (empty if nothing relevant)
    """
    if not question or not question.strip():
        raise ValueError("Question cannot be empty.")

    if distance_threshold is None:
        distance_threshold = config.DEFAULT_DISTANCE_THRESHOLD

    retrieval_query = build_retrieval_query(question, history)
    query_embedding = generate_embedding(retrieval_query)

    search_results = search_chunks(
        query_embedding=query_embedding,
        top_k=top_k,
        distance_threshold=distance_threshold
    )

    if not search_results:
        return None, []

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

    sources = []
    for result in search_results:
        metadata = result["metadata"]
        sources.append({
            "filename": metadata.get("filename"),
            "page_number": metadata.get("page_number"),
            "chunk_id": result["chunk_id"],
            "distance": result["distance"]
        })

    return context, sources


NO_CONTEXT_ANSWER = (
    "Sorry, I couldn't find relevant information in the uploaded documents."
)


def ask_question(
        question: str,
        top_k: int = 3,
        distance_threshold: float | None = None
):
    """
    Perform Retrieval-Augmented Generation (RAG).
    """
    context, sources = retrieve_context(
        question=question,
        top_k=top_k,
        distance_threshold=distance_threshold,
    )

    if context is None:
        return {"answer": NO_CONTEXT_ANSWER, "sources": []}

    answer = generate_answer(question=question, context=context)

    return {"answer": answer, "sources": sources}
