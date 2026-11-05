import uuid

from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.rag_service import ask_question
from app.pdf_service import extract_text_from_pdf
from app.embedding_service import (
    generate_embedding,
    generate_embeddings
)
from app.vector_db_service import (
    save_chunks,
    search_chunks,
    get_documents,
    delete_document
)

app = FastAPI(
    title="PDF RAG Chatbot",
    description="A free, locally running PDF AI assistant",
    version="1.0.0",
)


class EmbeddingRequest(BaseModel):
    text: str

class SearchRequest(BaseModel):
    question: str
    top_k: int = 3
class ChatRequest(BaseModel):
    question: str
    top_k: int = 3
@app.get("/")
def root():
    return {
        "message": "PDF RAG Chatbot API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.post("/api/pdf/upload")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded PDF file is empty."
        )

    try:
        # Step 1: Extract text and create chunks
        result = extract_text_from_pdf(file_bytes)

        pages = result["pages"]
        chunks = result["chunks"]

        total_text = "\n".join(
            page["text"] for page in pages
        )

        if not total_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No extractable text found in PDF."
            )

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="No text chunks generated from PDF."
            )

        # Step 2: Generate a unique document ID
        document_id = str(uuid.uuid4())

        # Step 3: Generate embeddings for all chunks
        chunk_texts = [
            chunk["text"] for chunk in chunks
        ]

        embeddings = generate_embeddings(chunk_texts)

        # Step 4: Save chunks and embeddings into ChromaDB
        saved_count = save_chunks(
            document_id=document_id,
            filename=file.filename,
            chunks=chunks,
            embeddings=embeddings
        )

        return {
            "message": "PDF uploaded and indexed successfully",
            "document_id": document_id,
            "filename": file.filename,
            "total_pages": len(pages),
            "total_characters": len(total_text),
            "total_chunks": len(chunks),
            "saved_chunks": saved_count
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF: {str(e)}"
        )

    finally:
        await file.close()


@app.post("/api/embedding/test")
def test_embedding(request: EmbeddingRequest):

    if not request.text.strip():
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty."
        )

    try:
        embedding = generate_embedding(request.text)

        return {
            "original_text": request.text,
            "model": "paraphrase-multilingual-MiniLM-L12-v2",
            "vector_dimension": len(embedding),
            "embedding_preview": embedding[:10]
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate embedding: {str(e)}"
        )

@app.post("/api/search")
def semantic_search(request: SearchRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    if request.top_k < 1 or request.top_k > 10:
        raise HTTPException(
            status_code=400,
            detail="top_k must be between 1 and 10."
        )

    try:
        query_embedding = generate_embedding(
            request.question
        )

        results = search_chunks(
            query_embedding=query_embedding,
            top_k=request.top_k,
            distance_threshold=0.5
        )

        # No sufficiently relevant chunks found
        if not results:
            return {
                "question": request.question,
                "total_results": 0,
                "message": "Sorry, I couldn't find relevant information in the uploaded documents.",
                "results": []
            }

        return {
            "question": request.question,
            "total_results": len(results),
            "results": results
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic search failed: {str(e)}"
        )

@app.post("/api/chat")
def chat_with_pdf(request: ChatRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    if request.top_k < 1 or request.top_k > 10:
        raise HTTPException(
            status_code=400,
            detail="top_k must be between 1 and 10."
        )

    try:
        result = ask_question(
            question=request.question,
            top_k=request.top_k
        )

        return {
            "question": request.question,
            "answer": result["answer"],
            "sources": result["sources"]
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {str(e)}"
        )

@app.get("/api/documents")
def list_documents():

    try:
        documents = get_documents()

        return {
            "total_documents": len(documents),
            "documents": documents
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve documents: {str(e)}"
        )

@app.delete("/api/documents/{document_id}")
def remove_document(document_id: str):

    try:
        deleted_chunks = delete_document(document_id)

        if deleted_chunks == 0:
            raise HTTPException(
                status_code=404,
                detail="Document not found."
            )

        return {
            "message": "Document deleted successfully",
            "document_id": document_id,
            "deleted_chunks": deleted_chunks
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document: {str(e)}"
        )