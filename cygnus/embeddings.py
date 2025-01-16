import numpy as np
from pathlib import Path
from typing import List, Tuple
import json
import mimetypes
from sentence_transformers import SentenceTransformer
import hnswlib
from sqlmodel import Session
import nltk

from cygnus.storage import STORAGE_DIR
from .config import config, EMBEDDINGS_DIR
from .models import FileModel, DocumentModel, SentenceModel, EmbeddingModel

# Download required NLTK data
nltk.download("punkt", quiet=True)


class EmbeddingProcessor:
    def __init__(self):
        self.model_name = config["embeddings"]["model"]
        self.model = SentenceTransformer(
            self.model_name, device=config["embeddings"]["device"]
        )
        self.batch_size = config["embeddings"]["batch_size"]
        self.max_length = config["embeddings"]["max_length"]

    def process_document(self, file_model: FileModel, db: Session) -> DocumentModel:
        """Process a document: split into sentences and generate embeddings."""
        # Create document record
        doc = DocumentModel(file_id=file_model.id)
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # Read file content based on file type
        file_path = STORAGE_DIR / Path(file_model.filename)
        mime_type, _ = mimetypes.guess_type(str(file_path))

        if mime_type == "application/pdf":
            try:
                import PyPDF2

                with open(file_path, "rb") as file:
                    reader = PyPDF2.PdfReader(file)
                    text = " ".join(page.extract_text() for page in reader.pages)
            except ImportError:
                # Fallback to text if PyPDF2 is not installed
                text = file_path.read_text(errors="ignore")
        elif mime_type and mime_type.startswith("text/"):
            # Handle text files (including markdown, txt, etc)
            text = file_path.read_text(errors="ignore")
        else:
            # For unknown types, try reading as text
            text = file_path.read_text(errors="ignore")

        # Split into sentences
        sentences = nltk.sent_tokenize(text)

        # Create sentence records and generate embeddings
        for position, text in enumerate(sentences):
            sentence = SentenceModel(document_id=doc.id, text=text, position=position)
            db.add(sentence)
            db.commit()
            db.refresh(sentence)

        # Generate embeddings for all sentences in batches
        all_embeddings = self.model.encode(
            sentences,
            batch_size=self.batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
        )

        # Save all embeddings to a single file for this document
        vector_file = f"doc_{doc.id}.npy"
        vector_path = EMBEDDINGS_DIR / vector_file
        np.save(vector_path, all_embeddings)

        # Create embedding records with row numbers
        for row, sentence in enumerate(
            db.query(SentenceModel)
            .filter(SentenceModel.document_id == doc.id)
            .order_by(SentenceModel.position)
        ):
            emb_model = EmbeddingModel(
                sentence_id=sentence.id,
                vector_file=vector_file,
                row=row,
                model_name=self.model_name,
            )
            db.add(emb_model)

        db.commit()
        return doc


class VectorIndex:
    def __init__(self):
        self.index_path = EMBEDDINGS_DIR / "vector_index.bin"
        self.mapping_path = EMBEDDINGS_DIR / "vector_mapping.json"
        self.dim = None
        self.index = None

    def create_index(self, db: Session):
        """Create a new vector index from all embeddings."""
        # Get all embeddings grouped by document
        embeddings = (
            db.query(EmbeddingModel)
            .order_by(EmbeddingModel.vector_file, EmbeddingModel.row)
            .all()
        )
        if not embeddings:
            return

        # Load first document's embeddings to get dimensions
        first_doc_vectors = np.load(EMBEDDINGS_DIR / embeddings[0].vector_file)
        self.dim = first_doc_vectors.shape[1]

        # Initialize index
        self.index = hnswlib.Index(space=config["index"]["metric"], dim=self.dim)
        self.index.init_index(
            max_elements=len(embeddings) * 2,  # Allow for growth
            ef_construction=config["index"]["ef_construction"],
            M=config["index"]["M"],
        )

        # Add vectors to index
        vectors = []
        mapping = {}  # Map index positions to sentence IDs
        current_file = None
        current_vectors = None

        for i, emb in enumerate(embeddings):
            if current_file != emb.vector_file:
                current_file = emb.vector_file
                current_vectors = np.load(EMBEDDINGS_DIR / current_file)

            vector = current_vectors[emb.row]
            vectors.append(vector)
            mapping[i] = emb.sentence_id

        self.index.add_items(np.array(vectors), np.arange(len(vectors)))

        # Save index and mapping
        self.index.save_index(str(self.index_path))
        with open(self.mapping_path, "w") as f:
            json.dump(mapping, f)

    def load_index(self, db: Session = None):
        """Load existing index if available."""
        if not db:
            return False
        if not (self.index_path.exists() and self.mapping_path.exists()):
            return False

        # Load mapping
        with open(self.mapping_path) as f:
            mapping = json.load(f)
            self.mapping = {
                int(k): v for k, v in mapping.items()
            }  # Convert string keys to int

        # Load first document's embeddings to get dimensions
        first_emb = db.query(EmbeddingModel).first()
        if not first_emb:
            return False
        first_vectors = np.load(EMBEDDINGS_DIR / first_emb.vector_file)
        self.dim = first_vectors.shape[1]

        # Load index
        self.index = hnswlib.Index(space=config["index"]["metric"], dim=self.dim)
        self.index.load_index(str(self.index_path), max_elements=len(self.mapping) * 2)
        return True

    def search(
        self, query: str, k: int = 5, db: Session = None
    ) -> List[Tuple[SentenceModel, float]]:
        """Search for similar sentences."""
        if not self.index:
            if not self.load_index(db):
                return []

        # Generate query embedding
        model = SentenceTransformer(config["embeddings"]["model"])
        query_vector = model.encode(
            [query], batch_size=1, show_progress_bar=False, normalize_embeddings=True
        )[0]

        # Search index
        labels, distances = self.index.knn_query(query_vector, k=k)

        if not db:
            return list(zip(labels[0], distances[0]))

        # Get sentence records
        results = []
        for label, distance in zip(labels[0], distances[0]):
            sentence_id = self.mapping[label]
            sentence = (
                db.query(SentenceModel).filter(SentenceModel.id == sentence_id).first()
            )
            if sentence:
                results.append((sentence, distance))

        return results


# Global instances
processor = EmbeddingProcessor()
vector_index = VectorIndex()
