import uuid
from typing import Literal
import json

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app import config
from app import user_service
from app import auth_service
from app.auth_service import get_current_user, require_admin, require_user
from app.rag_service import (
    ask_question,
    retrieve_context,
    NO_CONTEXT_ANSWER,
    is_followup_question,
)
from app.llm_service import LLMUnavailableError, generate_title, stream_answer
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

# Allow the frontend (served from a different origin) to call the API directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Ensure the users table exists as soon as the app module is imported,
# regardless of how the app is launched (uvicorn, TestClient, etc.).
user_service.init_db()


@app.on_event("startup")
def _startup():
    # Re-ensure on startup as well (harmless if already created).
    user_service.init_db()


class EmbeddingRequest(BaseModel):
    text: str

class SearchRequest(BaseModel):
    question: str
    top_k: int = Field(default=3, ge=1, le=10)
    distance_threshold: float | None = Field(default=None, ge=0.0, le=2.0)

class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    question: str
    top_k: int = Field(default=3, ge=1, le=10)
    distance_threshold: float | None = Field(default=None, ge=0.0, le=2.0)
    # Prior conversation turns (most recent last), for memory + better retrieval.
    history: list[HistoryMessage] = Field(default_factory=list)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    # Role chosen by the user at registration time. Defaults to a regular user.
    role: Literal["user", "admin"] = "user"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str
    # Access token lifetime in seconds (lets the client schedule refresh).
    expires_in: int = config.JWT_EXPIRE_MINUTES * 60


class UserResponse(BaseModel):
    username: str
    role: str


@app.post("/api/auth/register", response_model=TokenResponse)
def register(request: RegisterRequest):
    # The account is created with the role the user selected (user or admin).
    try:
        user = user_service.create_user(
            username=request.username,
            password=request.password,
            role=request.role,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token = auth_service.create_access_token(
        username=user["username"], role=user["role"]
    )
    return TokenResponse(
        access_token=token,
        username=user["username"],
        role=user["role"],
    )


@app.post("/api/auth/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = user_service.authenticate(
        username=form_data.username, password=form_data.password
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_service.create_access_token(
        username=user["username"], role=user["role"]
    )
    return TokenResponse(
        access_token=token,
        username=user["username"],
        role=user["role"],
    )


@app.get("/api/auth/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        username=current_user["username"], role=current_user["role"]
    )


@app.post("/api/auth/refresh", response_model=TokenResponse)
def refresh(current_user: dict = Depends(get_current_user)):
    """
    Issue a fresh access token for an already-authenticated (non-expired)
    session. Used by the client for silent, proactive token refresh so the
    user is not unexpectedly logged out mid-use.
    """
    token = auth_service.create_access_token(
        username=current_user["username"], role=current_user["role"]
    )
    return TokenResponse(
        access_token=token,
        username=current_user["username"],
        role=current_user["role"],
    )


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
async def upload_pdf(
    file: UploadFile = File(...),
    _admin: dict = Depends(require_admin),
):

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

    if len(file_bytes) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large. Maximum allowed size is "
                f"{config.MAX_UPLOAD_MB} MB."
            )
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
def semantic_search(
    request: SearchRequest,
    _user: dict = Depends(require_user),
):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    threshold = (
        request.distance_threshold
        if request.distance_threshold is not None
        else config.DEFAULT_DISTANCE_THRESHOLD
    )

    try:
        query_embedding = generate_embedding(
            request.question
        )

        results = search_chunks(
            query_embedding=query_embedding,
            top_k=request.top_k,
            distance_threshold=threshold
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
def chat_with_pdf(
    request: ChatRequest,
    _user: dict = Depends(require_user),
):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    try:
        result = ask_question(
            question=request.question,
            top_k=request.top_k,
            distance_threshold=request.distance_threshold
        )

        return {
            "question": request.question,
            "answer": result["answer"],
            "sources": result["sources"]
        }

    except LLMUnavailableError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer: {str(e)}"
        )


class TitleRequest(BaseModel):
    question: str


@app.post("/api/chat/title")
def chat_title(
    request: TitleRequest,
    _user: dict = Depends(require_user),
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        title = generate_title(request.question)
        return {"title": title}
    except LLMUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate title: {str(e)}"
        )


@app.post("/api/chat/stream")
def chat_stream(
    request: ChatRequest,
    _user: dict = Depends(require_user),
):
    """
    Stream a RAG answer as newline-delimited JSON (NDJSON). Each line is one
    JSON object:
      {"type": "sources", "sources": [...]}   (sent first)
      {"type": "token", "token": "..."}       (many)
      {"type": "done"}                         (sent last)
      {"type": "error", "detail": "..."}       (on failure)
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    def event_stream():
        try:
            history = [m.model_dump() for m in request.history]

            context, sources = retrieve_context(
                question=request.question,
                top_k=request.top_k,
                distance_threshold=request.distance_threshold,
                history=history,
            )

            # For short follow-up questions ("more examples", "explain further"),
            # the answer is driven by the conversation and the model's own
            # knowledge rather than the retrieved excerpts, so the retrieved
            # chunks are not a faithful attribution. Don't show Sources then.
            followup = is_followup_question(request.question, history)
            shown_sources = [] if followup else sources

            # Always send sources first (empty when suppressed or none found).
            yield json.dumps({"type": "sources", "sources": shown_sources}) + "\n"

            if context is None:
                if history:
                    # Follow-up with no new chunks: answer using the prior
                    # conversation instead of giving up.
                    for piece in stream_answer(
                        request.question, None, history
                    ):
                        yield json.dumps({"type": "token", "token": piece}) + "\n"
                    yield json.dumps({"type": "done"}) + "\n"
                    return
                # Brand-new question with nothing relevant: canned message.
                yield json.dumps(
                    {"type": "token", "token": NO_CONTEXT_ANSWER}
                ) + "\n"
                yield json.dumps({"type": "done"}) + "\n"
                return

            for piece in stream_answer(request.question, context, history):
                yield json.dumps({"type": "token", "token": piece}) + "\n"

            yield json.dumps({"type": "done"}) + "\n"

        except LLMUnavailableError as e:
            yield json.dumps({"type": "error", "detail": str(e)}) + "\n"
        except Exception as e:  # noqa: BLE001
            yield json.dumps(
                {"type": "error", "detail": f"Streaming failed: {str(e)}"}
            ) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.get("/api/documents")
def list_documents(_admin: dict = Depends(require_admin)):

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
def remove_document(
    document_id: str,
    _admin: dict = Depends(require_admin),
):

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