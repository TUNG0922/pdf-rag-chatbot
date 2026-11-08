
import fitz

from app import config
from app.chunking_service import split_text_into_chunks


def extract_text_from_pdf(file_bytes: bytes):
    pdf_document = fitz.open(
        stream=file_bytes,
        filetype="pdf"
    )

    pages = []
    chunks = []

    for page_number, page in enumerate(pdf_document, start=1):
        text = page.get_text("text").strip()

        pages.append({
            "page_number": page_number,
            "text": text
        })

        if not text:
            continue

        page_chunks = split_text_into_chunks(
            text=text,
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP
        )

        for chunk_index, chunk_text in enumerate(page_chunks):
            chunks.append({
                "page_number": page_number,
                "chunk_index": chunk_index,
                "text": chunk_text
            })

    pdf_document.close()

    return {
        "pages": pages,
        "chunks": chunks
    }
