
import chromadb


# Create a persistent ChromaDB client.
# Database files will be saved inside data/chroma_db.
client = chromadb.PersistentClient(
    path="data/chroma_db"
)


# Get an existing collection or create a new one.
collection = client.get_or_create_collection(
    name="pdf_chunks",
    metadata={
        "hnsw:space": "cosine"
    }
)


def save_chunks(
        document_id: str,
        filename: str,
        chunks: list[dict],
        embeddings: list[list[float]]
):
    if len(chunks) != len(embeddings):
        raise ValueError(
            "The number of chunks and embeddings must match."
        )

    if not chunks:
        return 0

    ids = []
    documents = []
    metadatas = []

    for index, chunk in enumerate(chunks):
        ids.append(f"{document_id}_{index}")

        documents.append(chunk["text"])

        metadatas.append({
            "document_id": document_id,
            "filename": filename,
            "page_number": chunk["page_number"],
            "chunk_index": chunk["chunk_index"]
        })

    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

    return len(ids)


def search_chunks(
        query_embedding: list[float],
        top_k: int = 3,
        distance_threshold: float = 0.5
):
    total_chunks = collection.count()

    if total_chunks == 0:
        return []

    result_count = min(top_k, total_chunks)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=result_count,
        include=[
            "documents",
            "metadatas",
            "distances"
        ]
    )

    search_results = []

    for index in range(len(results["ids"][0])):

        distance = results["distances"][0][index]

        # Filter out irrelevant search results
        if distance > distance_threshold:
            continue

        search_results.append({
            "chunk_id": results["ids"][0][index],
            "text": results["documents"][0][index],
            "metadata": results["metadatas"][0][index],
            "distance": distance
        })

    return search_results

def get_documents():
    """
    Retrieve all uploaded documents from ChromaDB.
    """

    # Get all chunks and their metadata
    result = collection.get(
        include=["metadatas"]
    )

    documents_map = {}

    metadatas = result["metadatas"]

    for metadata in metadatas:

        document_id = metadata["document_id"]
        filename = metadata["filename"]
        page_number = metadata["page_number"]

        # First time seeing this document
        if document_id not in documents_map:
            documents_map[document_id] = {
                "document_id": document_id,
                "filename": filename,
                "total_chunks": 0,
                "pages": set()
            }

        # Count chunks belonging to this document
        documents_map[document_id]["total_chunks"] += 1

        # Track unique page numbers
        documents_map[document_id]["pages"].add(page_number)

    # Convert the dictionary into a list
    documents = []

    for document in documents_map.values():

        documents.append({
            "document_id": document["document_id"],
            "filename": document["filename"],
            "total_chunks": document["total_chunks"],
            "total_pages": len(document["pages"])
        })

    return documents

def delete_document(document_id: str):
    """
    Delete all chunks belonging to a document.
    """

    # Find all chunks belonging to this document
    result = collection.get(
        where={
            "document_id": document_id
        },
        include=["metadatas"]
    )

    chunk_ids = result["ids"]

    # Document does not exist
    if not chunk_ids:
        return 0

    # Delete all chunks belonging to this document
    collection.delete(
        where={
            "document_id": document_id
        }
    )

    return len(chunk_ids)