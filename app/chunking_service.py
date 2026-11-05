
def split_text_into_chunks(
        text: str,
        chunk_size: int = 500,
        chunk_overlap: int = 100
):
    """
    Split text into smaller chunks.

    Args:
        text: Original text.
        chunk_size: Maximum number of characters per chunk.
        chunk_overlap: Number of overlapping characters.

    Returns:
        A list of text chunks.
    """

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

    while start < len(text):

        end = start + chunk_size

        chunk = text[start:end]

        chunks.append(chunk)

        start += chunk_size - chunk_overlap

    return chunks
