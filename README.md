# PDF RAG Chatbot

A free, **fully local** PDF question-answering chatbot built with Retrieval-Augmented
Generation (RAG). Upload a PDF, then chat with it in natural language — no paid cloud
APIs required, everything runs on your machine.

It has role-based accounts (admins manage PDFs, users chat), streaming answers,
multilingual support, per-user chat history, and a modern Mantine UI with light/dark
mode.

## How it works

```
PDF ──▶ extract text (PyMuPDF) ──▶ smart chunking ──▶ embeddings (sentence-transformers)
                                                              │
                                                              ▼
                                                        ChromaDB (vector store)
                                                              │
question ──▶ embed ──▶ similarity search ──▶ relevant chunks ──▶ local LLM (Ollama) ──▶ answer
```

For follow-up questions ("give me more examples"), the retrieval query is anchored to
the conversation topic and prior turns are sent to the model so it keeps context.

## Tech stack

**Backend (Python / FastAPI)**
- FastAPI — REST API with streaming (NDJSON) responses
- PyMuPDF (`fitz`) — PDF text extraction
- sentence-transformers — multilingual embeddings (`paraphrase-multilingual-MiniLM-L12-v2`)
- ChromaDB — local persistent vector database (stored in `data/chroma_db`)
- Ollama — local LLM inference (default model `qwen2.5:3b`)
- SQLite + bcrypt + PyJWT — user accounts and JWT auth

**Frontend (React / TypeScript)**
- React 19 + Vite
- Mantine (UI components, notifications, modals, dropzone) + Tabler icons
- react-router-dom, axios, react-markdown + react-syntax-highlighter

---

## Prerequisites

1. **Python 3.10+**
2. **Node.js 18+** (for the frontend)
3. **Ollama** — install from https://ollama.com, then pull the model:
   ```bash
   ollama pull qwen2.5:3b
   ```
   Make sure the Ollama server is running — start it with `ollama serve`, or just
   open the Ollama desktop app.

---

## Setup & startup

The app has two parts: a **backend** (FastAPI) and a **frontend** (React/Vite). Run
each in its own terminal. Ollama must be running in the background.

### 0. Start Ollama (first terminal, or desktop app)

```bash
ollama serve
# (one time) pull the model if you haven't:
ollama pull qwen2.5:3b
```

### 1. Backend (second terminal)

From the project root:

```bash
# (Recommended) create and activate a virtual environment
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API at http://127.0.0.1:8000
uvicorn app.main:app --reload
```

Interactive API docs: http://127.0.0.1:8000/docs

### 2. Frontend (third terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` calls to the backend at
`http://127.0.0.1:8000`.

### 3. First run

1. Go to http://localhost:5173 — you'll be redirected to the login page.
2. Click **Register** and create an account. Choose a role:
   - **Admin** — can upload and manage PDFs (no chat).
   - **User** — can chat with the uploaded PDFs.
3. Log in. Admins land on **Manage PDFs**; users land on the **chat** view.
4. As an admin, upload a PDF. Then log in as a user and start asking questions.

### Windows note (Application Control / PATH)

If PowerShell blocks `uvicorn.exe` or `vite.exe` (an Application Control policy), or a
command isn't found right after installing Node/Python, invoke them through the trusted
interpreter instead:

```powershell
# backend
python -m uvicorn app.main:app --reload
# frontend
node node_modules\vite\bin\vite.js
```

---

## Features

- **Fully local RAG** — PDF text extraction, embeddings, vector search, and LLM
  inference all run on your machine. No data leaves your computer; no API keys.
- **Authentication & roles** — register/login with JWT; **silent token refresh** keeps
  you signed in. Role-based access:
  - **Admin**: upload, list, and delete PDFs (document management only).
  - **User**: chat and semantic search over the indexed PDFs.
- **Streaming answers** — responses stream in token-by-token (like ChatGPT) for a
  responsive feel.
- **Conversation memory** — follow-up questions ("more examples", "explain further")
  stay on topic by anchoring retrieval to the conversation and passing prior turns to
  the model.
- **Smart chat titles** — each conversation is auto-titled with a short LLM-generated
  summary of your first question (e.g. "Dependency Injection Explained").
- **Per-user chat history** — multiple conversations, stored per account, with
  **New chat**, select, and delete (with a confirmation dialog). Persisted in the
  browser (localStorage).
- **Copy & edit prompts** — copy any of your messages, or edit a sent prompt inline and
  resend to regenerate the answer.
- **Source attribution** — answers grounded in the documents show the source files and
  page numbers. Follow-ups answered from conversation/general knowledge don't show
  misleading sources.
- **Syntax-highlighted code** — code in answers renders in highlighted code blocks with
  a language label and copy button, visually distinct from the explanation text.
- **Multilingual** — ask in English or Chinese (and other languages the embedding model
  supports); the assistant replies in the same language as your question.
- **Modern UI** — Mantine components, a collapsible/resizable sidebar, and light/dark
  mode toggle.

---

## Configuration

All tunable settings live in `app/config.py` and can be overridden with environment
variables (no code changes needed):

| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins |
| `MAX_UPLOAD_MB` | `25` | Maximum PDF upload size (MB) |
| `CHUNK_SIZE` | `500` | Max characters per chunk |
| `CHUNK_OVERLAP` | `100` | Overlap characters between chunks |
| `DEFAULT_DISTANCE_THRESHOLD` | `0.80` | Cosine-distance cutoff for retrieval (lower = stricter) |
| `EMBEDDING_MODEL` | `...paraphrase-multilingual-MiniLM-L12-v2` | Embedding model name |
| `LLM_MODEL` | `qwen2.5:3b` | Ollama model used for answers |
| `JWT_SECRET` | *(insecure dev default)* | Secret used to sign JWT tokens — **set this in production** |
| `JWT_EXPIRE_MINUTES` | `1440` | Access token lifetime (minutes) |
| `AUTH_DB_PATH` | `data/auth.db` | SQLite file storing user accounts |

Example (Windows PowerShell), using a bigger model for better answers:
```powershell
$env:LLM_MODEL = "qwen2.5:7b"; uvicorn app.main:app --reload
```

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Create an account (role `user` or `admin`) |
| `POST` | `/api/auth/login` | — | Log in (form-encoded), returns a JWT |
| `GET` | `/api/auth/me` | any | Current user info |
| `POST` | `/api/auth/refresh` | any | Issue a fresh token (silent refresh) |
| `POST` | `/api/pdf/upload` | admin | Upload & index a PDF (multipart `file`) |
| `GET` | `/api/documents` | admin | List indexed documents |
| `DELETE` | `/api/documents/{document_id}` | admin | Delete a document and its chunks |
| `POST` | `/api/search` | user | Semantic search over indexed chunks |
| `POST` | `/api/chat` | user | Ask a question (non-streaming RAG answer + sources) |
| `POST` | `/api/chat/stream` | user | Ask a question (streaming NDJSON answer) |
| `POST` | `/api/chat/title` | user | Generate a short conversation title |
| `POST` | `/api/embedding/test` | — | Inspect an embedding for given text |

Authenticated endpoints expect an `Authorization: Bearer <token>` header. `/api/search`
and `/api/chat*` accept an optional `distance_threshold` (0.0–2.0) and `top_k` (1–10).
Chat endpoints also accept an optional `history` array for conversation memory.

Example (login then chat):
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -d "username=alice&password=secret123" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this document about?", "top_k": 3}'
```

---

## Authentication & roles

- User accounts live in a local **SQLite** database (`data/auth.db`, configurable via
  `AUTH_DB_PATH`). Passwords are hashed with **bcrypt**; sessions use **JWT** tokens
  with silent refresh.
- At registration you choose a role: **admin** (manage PDFs) or **user** (chat). The
  role comes from the stored account — you only enter credentials at login, and are
  routed to the correct view automatically.
- Backend enforces roles: upload/document endpoints require admin; chat/search require a
  regular user.

> Set a strong `JWT_SECRET` environment variable in any non-local deployment. The
> default is an insecure development placeholder.

---

## Future improvements

Ideas for extending the project:

- **OpenAI (and other cloud LLM) support + side-by-side comparison.** Add an optional
  OpenAI-backed answer path alongside the local Ollama one, and a UI toggle / split view
  to run the **same question through both** and compare the outputs (quality, speed,
  cost). This would make it easy to benchmark the local `qwen2.5:3b` model against, say,
  `gpt-4o-mini`, and let users pick a provider per query. Implementation sketch:
  - A `LLM_PROVIDER` setting (`ollama` | `openai`) plus `OPENAI_API_KEY`.
  - A thin provider interface so `generate_answer` / `stream_answer` can dispatch to
    either backend.
  - A "Compare" mode in the chat UI that renders two answer columns for one prompt.
- **Pluggable embedding / reranking** — optionally use OpenAI embeddings or add a
  cross-encoder reranker to improve retrieval precision.
- **Server-side chat history** — persist conversations in the database (instead of
  browser localStorage) so history follows the user across devices, with proper refresh
  tokens for long-lived sessions.
- **Better chunking** — semantic/section-aware chunking and cross-page merging for more
  coherent retrieval context.
- **Multi-document & citations** — filter/scope chat to specific documents and link each
  answer sentence to its exact source span.
- **Streaming via SSE/WebSocket** and request cancellation (stop generation).
- **Observability & evaluation** — log retrieval hits/distances and add a small eval set
  to measure answer quality across models/thresholds.
- **Production hardening** — rate limiting, HTTPS, Docker Compose for one-command setup,
  and tests/CI.

---

## Notes & limitations

- Designed for **local / personal use**. Add rate limiting and HTTPS before exposing it
  to the public internet.
- The first request after startup is slower because the embedding model loads lazily.
- If a chat request returns **503**, the Ollama server is not running or the configured
  model has not been pulled — see Prerequisites.
- Chat history is stored in the browser (localStorage), so it is per-browser and cleared
  if you clear site data. See Future improvements for server-side history.
- The default `qwen2.5:3b` is small and fast but limited; set `LLM_MODEL` to a larger
  model (e.g. `qwen2.5:7b`) for noticeably better answers.
```
