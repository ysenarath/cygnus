from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class FileModel(SQLModel, table=True):
    __tablename__ = "files"

    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str = Field(index=True)
    original_filename: str
    content_type: str
    size: int
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    description: Optional[str] = None

    # Relationship
    document: Optional["DocumentModel"] = Relationship(back_populates="file")


class DocumentModel(SQLModel, table=True):
    __tablename__ = "documents"

    id: Optional[int] = Field(default=None, primary_key=True)
    file_id: int = Field(foreign_key="files.id")
    processed_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    file: FileModel = Relationship(back_populates="document")
    sentences: List["SentenceModel"] = Relationship(back_populates="document")


class SentenceModel(SQLModel, table=True):
    __tablename__ = "sentences"

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="documents.id")
    text: str
    position: int  # Order in document

    # Relationships
    document: DocumentModel = Relationship(back_populates="sentences")
    embedding: Optional["EmbeddingModel"] = Relationship(back_populates="sentence")


class EmbeddingModel(SQLModel, table=True):
    __tablename__ = "embeddings"

    id: Optional[int] = Field(default=None, primary_key=True)
    sentence_id: int = Field(foreign_key="sentences.id", unique=True)
    vector_file: str  # Path to document's vector file
    row: int  # Row number in the vector file
    model_name: str  # Name of the model used for embedding

    # Relationships
    sentence: SentenceModel = Relationship(back_populates="embedding")
