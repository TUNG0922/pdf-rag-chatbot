"""
Centralized configuration.

Values can be overridden via environment variables, which makes it easy to
tune behavior without editing code (e.g. in Docker or CI).
"""

import os


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _get_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# --- CORS -------------------------------------------------------------------
# Comma-separated list of allowed origins for the frontend dev/prod servers.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# --- Upload limits ----------------------------------------------------------
# Maximum accepted PDF upload size, in megabytes.
MAX_UPLOAD_MB = _get_int("MAX_UPLOAD_MB", 25)
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# --- Chunking ---------------------------------------------------------------
CHUNK_SIZE = _get_int("CHUNK_SIZE", 500)
CHUNK_OVERLAP = _get_int("CHUNK_OVERLAP", 100)

# --- Retrieval --------------------------------------------------------------
# Default cosine-distance threshold used to filter out irrelevant chunks.
# Lower = stricter. Can be overridden per request.
# The multilingual MiniLM model places genuinely relevant chunks around
# 0.6-0.7, so 0.75 keeps relevant content while still rejecting off-topic
# chatter (which tends to sit at 0.85+).
DEFAULT_DISTANCE_THRESHOLD = _get_float("DEFAULT_DISTANCE_THRESHOLD", 0.75)

# --- Models -----------------------------------------------------------------
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:3b")

# --- Auth -------------------------------------------------------------------
# JWT signing secret. MUST be overridden in production via env var.
JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "dev-insecure-change-me-please-set-JWT_SECRET-in-production",
)
JWT_ALGORITHM = "HS256"
# Access token lifetime in minutes.
JWT_EXPIRE_MINUTES = _get_int("JWT_EXPIRE_MINUTES", 60 * 24)

# Path to the SQLite database holding user accounts.
AUTH_DB_PATH = os.getenv("AUTH_DB_PATH", "data/auth.db")
