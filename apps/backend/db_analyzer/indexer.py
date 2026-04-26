from __future__ import annotations

from typing import Any

import chromadb
import ollama

from db_analyzer.schema import SchemaInfo, schema_to_chunks

CHROMA_PATH = ".chroma_db"
COLLECTION_NAME = "db_schema"


class OllamaEmbeddingFunction:
    name = "ollama"
    default_space = " cosine"
    supported_spaces = ["cosine"]
    is_legacy = False

    def __init__(self, model_name: str = "nomic-embed-text"):
        self.model_name = model_name

    def _embed(self, texts: list[str]) -> list[list[float]]:
        embeddings = []
        for t in texts:
            response = ollama.embeddings(model=self.model_name, prompt=t)
            emb = response["embedding"]
            embeddings.append([float(x) for x in emb])
        return embeddings

    def __call__(self, input: Any) -> list[list[float]]:
        return self._embed(input)

    def embed_documents(self, input: Any) -> list[list[float]]:
        return self._embed(input)

    def embed_query(self, input: Any) -> list[list[float]]:
        if isinstance(input, str):
            input = [input]
        return self._embed(input)

    def embed_with_retries(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts)

    def build_from_config(self, config: dict) -> "OllamaEmbeddingFunction":
        return OllamaEmbeddingFunction(
            model_name=config.get("model_name", "nomic-embed-text")
        )

    def get_config(self) -> dict:
        return {"model_name": self.model_name}

    def validate_config(self, config: dict) -> None:
        pass

    def validate_config_update(self, old_config: dict, new_config: dict) -> None:
        pass


def get_ef():
    return OllamaEmbeddingFunction()


def index_schema(schema: SchemaInfo) -> chromadb.Collection:
    chunks = schema_to_chunks(schema)

    client = chromadb.PersistentClient(path=CHROMA_PATH)

    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(COLLECTION_NAME, embedding_function=get_ef())  # type: ignore[arg-type]

    collection.add(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks],
    )

    return collection


def load_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    return client.get_collection(COLLECTION_NAME, embedding_function=get_ef())  # type: ignore[arg-type]


def retrieve_schema_chunks(
    question: str, collection: chromadb.Collection, top_k: int = 4
) -> list[dict]:
    results = collection.query(
        query_texts=[question],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )
    chunks = []
    documents = results.get("documents", [[]]) or [[]]
    metadatas = results.get("metadatas", [[]]) or [[]]
    distances = results.get("distances", [[]]) or [[]]

    if documents and documents[0]:
        for doc, meta, dist in zip(
            documents[0], metadatas[0] or [], distances[0] or []
        ):
            chunks.append(
                {
                    "text": doc,
                    "metadata": meta,
                    "score": round(1 - dist, 3),
                }
            )
    return chunks
