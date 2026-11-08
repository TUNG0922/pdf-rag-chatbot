from app import config


# Boundary characters, ordered from strongest (paragraph break) to weakest
# (any whitespace). When a chunk reaches chunk_size we try to back off to the
# nearest boundary so we don't cut words or sentences in half.
_SENTENCE_ENDINGS = (". ", "! ", "? ", "。", "！", "？", "\n")


def _find_split_point(text: str, start: int, hard_end: int) -> int:
    """
    Find the best position to end a chunk that starts at ``start`` and may
    extend up to ``hard_end`` (exclusive).

    Preference order:
      1. A paragraph break ("\\n\\n") within the window.
      2. A sentence ending (., !, ?, CJK equivalents, newline).
      3. Any whitespace.
      4. Fall back to a hard cut at ``hard_end``.

    Only boundaries in the second half of the window are considered, so we
    don't produce tiny chunks.
    """

    window = text[start:hard_end]

    # Lower bound keeps chunks from becoming too small.
    min_len = len(window) // 2

    # 1. Paragraph break
    para = window.rfind("\n\n")
    if para >= min_len:
        return start + para + 2

    # 2. Sentence endings
    best = -1
    for ending in _SENTENCE_ENDINGS:
        pos = window.rfind(ending)
        if pos >= min_len:
            best = max(best, pos + len(ending))
    if best != -1:
        return start + best

    # 3. Any whitespace
    space = window.rfind(" ")
    if space >= min_len:
        return start + space + 1

    # 4. Hard cut
    return hard_end


def split_text_into_chunks(
        text: str,
        chunk_size: int = None,
        chunk_overlap: int = None
):
    """
    Split text into smaller chunks, preferring natural boundaries
    (paragraphs, sentences, then whitespace) over hard character cuts.

    Args:
        text: Original text.
        chunk_size: Maximum number of characters per chunk.
        chunk_overlap: Number of overlapping characters between chunks.

    Returns:
        A list of text chunks (stripped, non-empty).
    """

    if chunk_size is None:
        chunk_size = config.CHUNK_SIZE
    if chunk_overlap is None:
        chunk_overlap = config.CHUNK_OVERLAP

    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than 0")

    if chunk_overlap < 0:
        raise ValueError("chunk_overlap cannot be negative")

    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")

    text = text.strip()

    if not text:
        return []

    chunks = []

    start = 0
    text_length = len(text)

    while start < text_length:

        hard_end = min(start + chunk_size, text_length)

        # If the remaining text fits in one chunk, take it all.
        if hard_end >= text_length:
            end = text_length
        else:
            end = _find_split_point(text, start, hard_end)

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= text_length:
            break

        # Advance, keeping an overlap. Guard against non-progress.
        next_start = end - chunk_overlap
        if next_start <= start:
            next_start = end
        start = next_start

    return chunks
