
from sentence_transformers import SentenceTransformer


# Multilingual embedding model
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Keep one model instance in memory.
# We don't want to reload the model every time we generate embeddings.
_model = None


def get_embedding_model():
    global _model

    if _model is None:
        print("Loading embedding model...")

        _model = SentenceTransformer(MODEL_NAME)

        print("Embedding model loaded successfully!")

    return _model


def generate_embedding(text: str):
    """
    Convert one text into an embedding vector.
    """

    model = get_embedding_model()

    embedding = model.encode(
        text,
        normalize_embeddings=True
    )

    return embedding.tolist()


def generate_embeddings(texts: list[str]):
    """
    Convert multiple text chunks into embedding vectors.
    """

    if not texts:
        return []

    model = get_embedding_model()

    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True
    )

    return embeddings.tolist()
