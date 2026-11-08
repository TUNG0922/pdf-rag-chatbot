
from ollama import chat

try:
    # ResponseError is raised by the ollama client for API-level errors
    # (e.g. model not found). ConnectError-style failures surface as
    # httpx/ConnectionError depending on the version, so we also catch broadly.
    from ollama import ResponseError
except ImportError:  # pragma: no cover - depends on ollama version
    ResponseError = None

from app import config


MODEL_NAME = config.LLM_MODEL


ANSWER_SYSTEM_PROMPT = """
You are a helpful, knowledgeable assistant discussing documents with the user.

You are given excerpts from the user's PDF documents and the earlier
conversation. Use the documents as your primary, authoritative source, and
use the conversation to understand follow-up questions (for example, when the
user asks for "more examples" or "explain further", they mean the topic
already being discussed).

Rules:
1. Prefer the provided document excerpts when they are relevant, and do not
   state anything that contradicts them.
2. When the documents do not fully cover what the user asks (for example they
   want more examples, deeper explanation, or a concept only touched on
   briefly), use your own general knowledge to give a helpful, accurate answer
   DIRECTLY. Never refuse or hedge just because the exact examples are not in
   the documents, and never tell the user to "look elsewhere" or "consult
   other resources" — you ARE the resource; just provide the answer. Do not
   begin with disclaimers like "the documents do not contain examples";
   simply answer the question.
3. Treat follow-up questions as a continuation of the SAME topic from the
   previous turns. If the user asks for "more examples" or "explain further",
   give more of what was JUST being discussed. Do not switch to a different
   subject just because some retrieved excerpts are about something else —
   stay on the topic the user is clearly asking about, using your own
   knowledge if needed.
4. Only say you cannot help if the question is genuinely unrelated to the
   documents AND the conversation so far, and you truly have no useful answer.
5. Give clear, well-structured, easy-to-understand answers. Use code blocks
   for code.
6. CRITICAL: Reply in the SAME language as the user's latest question. If the
   user writes in Chinese, answer entirely in Chinese. If in English, answer
   in English. Match the user's language even if the documents are in a
   different language. Only code, identifiers, and proper nouns may stay in
   their original form.
"""


class LLMUnavailableError(RuntimeError):
    """Raised when the local Ollama server or model is not reachable/usable."""


def _to_llm_error(exc: Exception) -> "LLMUnavailableError":
    """Normalize an exception from the ollama client into a clear error."""
    message = str(exc).lower()

    if ResponseError is not None and isinstance(exc, ResponseError):
        return LLMUnavailableError(
            f"The language model '{MODEL_NAME}' is not available in "
            f"Ollama. Pull it first with: ollama pull {MODEL_NAME}"
        )

    if (
        "connection" in message
        or "refused" in message
        or "connect" in message
        or "timed out" in message
        or "timeout" in message
    ):
        return LLMUnavailableError(
            "Could not reach the Ollama server. Make sure Ollama is "
            "installed and running (start it with 'ollama serve')."
        )

    return LLMUnavailableError(
        f"Failed to generate an answer from the local LLM: {exc}"
    )


def _build_user_prompt(question: str, context: str | None) -> str:
    if context:
        return f"""
    Context from PDF documents:

    {context}

    User Question:
    {question}

    Please answer based on the context above and the earlier conversation.
    """

    # Follow-up turn with no newly retrieved excerpts: rely on the ongoing
    # conversation rather than claiming the context is empty.
    return f"""
    This is a follow-up question in an ongoing conversation. No new document
    excerpts were retrieved for it, so rely on the EARLIER CONVERSATION above
    to answer. The user is continuing the same topic (for example asking for
    more examples or further explanation). Do NOT say the context is empty or
    that you cannot find information; instead continue helpfully based on what
    was already discussed, providing additional examples or detail as asked.

    User Question:
    {question}
    """


# How many prior turns to include for memory (keeps the prompt bounded).
MAX_HISTORY_MESSAGES = 6


def _build_messages(question: str, context: str | None, history: list | None = None):
    """
    Assemble the Ollama message list: system prompt, prior conversation turns
    (for memory), then the current question grounded in the retrieved context.
    """
    messages = [{"role": "system", "content": ANSWER_SYSTEM_PROMPT}]

    if history:
        for m in history[-MAX_HISTORY_MESSAGES:]:
            role = m.get("role")
            content = m.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    messages.append(
        {"role": "user", "content": _build_user_prompt(question, context)}
    )
    return messages


def generate_answer(question: str, context: str | None = None, history: list | None = None) -> str:
    """
    Generate an answer using retrieved PDF context (non-streaming).

    Raises:
        LLMUnavailableError: if the Ollama server/model is unavailable.
    """
    try:
        response = chat(
            model=MODEL_NAME,
            messages=_build_messages(question, context, history),
            options={"temperature": 0.2},
        )
    except Exception as exc:  # noqa: BLE001
        raise _to_llm_error(exc) from exc

    return response.message.content


def stream_answer(question: str, context: str | None = None, history: list | None = None):
    """
    Stream the answer token-by-token. Yields string chunks.

    Raises:
        LLMUnavailableError: if the Ollama server/model is unavailable
            (raised before the first chunk is produced).
    """
    try:
        stream = chat(
            model=MODEL_NAME,
            messages=_build_messages(question, context, history),
            options={"temperature": 0.2},
            stream=True,
        )
        for part in stream:
            piece = part.get("message", {}).get("content", "")
            if piece:
                yield piece
    except Exception as exc:  # noqa: BLE001
        raise _to_llm_error(exc) from exc


def generate_title(question: str) -> str:
    """
    Produce a short, descriptive conversation title that summarizes what the
    user is asking (not just a truncation of their prompt).

    Falls back to a trimmed version of the question if the LLM is unavailable
    or returns something unusable.
    """
    system_prompt = (
        "Summarize the user's question into a short, human-readable title of "
        "3 to 6 words. Use normal spacing and Title Case. Do not add quotes or "
        "a trailing period.\n"
        "Example: question 'how do I reset my password?' -> Resetting Your "
        "Password\n"
        "Reply with only the title."
    )

    def fallback() -> str:
        text = " ".join(question.strip().split())
        return text[:40] + ("..." if len(text) > 40 else "") if text else "New chat"

    try:
        response = chat(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            options={"temperature": 0.2},
        )
        title = (response.message.content or "").strip()
    except Exception as exc:  # noqa: BLE001
        raise _to_llm_error(exc) from exc

    # Sanitize: drop surrounding quotes, a leading "Title:" label, collapse
    # whitespace, and trim trailing punctuation.
    title = title.replace("\n", " ").strip().strip('"').strip("'")
    if title.lower().startswith("title:"):
        title = title[len("title:"):].strip()
    title = " ".join(title.split()).rstrip(".!?,;:")

    # If the model returned an unusable run-on blob (a long word with no
    # spaces), fall back to the question instead of showing garbage.
    if not title or (" " not in title and len(title) > 18):
        return fallback()

    if len(title) > 60:
        title = title[:60].rstrip() + "..."
    return title
