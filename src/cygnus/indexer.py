"""
Document indexing system using ChromaDB and background processing.

This module provides the DocumentIndexer class for extracting text from documents,
chunking them, generating embeddings, and storing them in ChromaDB for semantic search.
"""

import os
import logging
import threading
import time
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from docling.document_converter import DocumentConverter
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from cygnus.models import Document, Node, IndexingStatus, Base
from cygnus.config import load_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DocumentIndexer:
    """
    Document indexing system with ChromaDB backend.

    This class handles document text extraction, chunking, embedding generation,
    and storage in ChromaDB. It runs background workers to process pending documents.

    Parameters
    ----------
    config_path : Path | str | None, optional
        Path to configuration file. If None, uses default path.

    Attributes
    ----------
    config : Config
        Application configuration.
    chroma_client : chromadb.Client
        ChromaDB persistent client.
    collection : chromadb.Collection
        ChromaDB collection for documents.
    embedding_model : SentenceTransformer
        Sentence transformer model for generating embeddings.
    db_session : scoped_session
        Database session factory.
    workers : List[threading.Thread]
        List of worker threads.
    stop_event : threading.Event
        Event to signal workers to stop.

    Examples
    --------
    >>> indexer = DocumentIndexer()
    >>> indexer.start()
    >>> # Indexer will now process pending documents in the background
    >>> indexer.stop()
    """

    def __init__(self, config_path: Path | str | None = None):
        """
        Initialize the document indexer.

        Parameters
        ----------
        config_path : Path | str | None, optional
            Path to configuration file.
        """
        # Load configuration
        self.config = load_config(config_path)
        
        # Set up paths
        project_root = Path(__file__).parent.parent.parent
        self.chroma_dir = project_root / "instance" / "chroma_data"
        self.storage_dir = project_root / self.config.storage.directory
        self.logs_dir = project_root / "instance" / "logs"
        
        # Create directories
        self.chroma_dir.mkdir(parents=True, exist_ok=True)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        
        # Set up file logging
        log_file = self.logs_dir / "indexer.log"
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(
            logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        )
        logger.addHandler(file_handler)
        
        # Initialize ChromaDB
        logger.info(f"Initializing ChromaDB at {self.chroma_dir}")
        self.chroma_client = chromadb.PersistentClient(
            path=str(self.chroma_dir),
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Get or create collection
        self.collection = self.chroma_client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
        
        # Initialize embedding model
        logger.info(f"Loading embedding model: {self.config.indexing.embedding_model}")
        self.embedding_model = SentenceTransformer(self.config.indexing.embedding_model)
        
        # Initialize database session
        engine = create_engine(self.config.database.url, echo=False)
        Base.metadata.create_all(engine)
        self.db_session = scoped_session(sessionmaker(bind=engine))
        
        # Worker management
        self.workers: List[threading.Thread] = []
        self.stop_event = threading.Event()
        
        logger.info("DocumentIndexer initialized successfully")

    def start(self):
        """
        Start background worker threads.

        Returns
        -------
        None

        Notes
        -----
        Creates and starts worker threads based on config.indexing.num_workers.
        Workers run in daemon mode and will stop when the main process exits.
        """
        logger.info(f"Starting {self.config.indexing.num_workers} worker threads")
        
        for i in range(self.config.indexing.num_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"IndexWorker-{i}",
                daemon=True
            )
            worker.start()
            self.workers.append(worker)
        
        logger.info(f"Started {len(self.workers)} worker threads")

    def stop(self):
        """
        Stop all worker threads gracefully.

        Returns
        -------
        None

        Notes
        -----
        Sets the stop event and waits for all workers to finish their current tasks.
        """
        logger.info("Stopping worker threads")
        self.stop_event.set()
        
        for worker in self.workers:
            worker.join(timeout=30)
        
        self.workers.clear()
        logger.info("All worker threads stopped")

    def _worker_loop(self):
        """
        Main worker loop to process pending documents.

        Returns
        -------
        None

        Notes
        -----
        Continuously checks for pending documents and processes them.
        Runs until stop_event is set.
        """
        worker_name = threading.current_thread().name
        logger.info(f"{worker_name} started")
        
        while not self.stop_event.is_set():
            try:
                self.process_pending_documents()
                time.sleep(10)  # Check every 10 seconds
            except Exception as e:
                logger.error(f"{worker_name} error: {str(e)}", exc_info=True)
                time.sleep(30)  # Wait longer on error
        
        logger.info(f"{worker_name} stopped")

    def process_pending_documents(self):
        """
        Process all pending documents in the queue.

        Returns
        -------
        None

        Notes
        -----
        Queries database for documents with PENDING status and processes them.
        Updates document status to PROCESSING during processing.
        """
        session = self.db_session()
        try:
            # Get pending documents
            pending_docs = session.query(Document).filter(
                Document.status == IndexingStatus.PENDING
            ).limit(10).all()
            
            if not pending_docs:
                return
            
            logger.info(f"Found {len(pending_docs)} pending documents to process")
            
            for doc in pending_docs:
                try:
                    # Update status to processing
                    doc.status = IndexingStatus.PROCESSING
                    session.commit()
                    
                    # Process the document
                    self._index_document(doc)
                    
                    logger.info(f"Successfully indexed document {doc.id}")
                    
                except Exception as e:
                    logger.error(f"Error processing document {doc.id}: {str(e)}", exc_info=True)
                    self._handle_indexing_error(doc, str(e))
        
        except Exception as e:
            logger.error(f"Error in process_pending_documents: {str(e)}", exc_info=True)
        finally:
            session.close()

    def _index_document(self, doc: Document):
        """
        Index a single document.

        Parameters
        ----------
        doc : Document
            Document record to index.

        Returns
        -------
        None

        Raises
        ------
        ValueError
            If file format is not supported.
        FileNotFoundError
            If file does not exist.

        Notes
        -----
        Extracts text, chunks it, generates embeddings, and stores in ChromaDB.
        Updates document status to COMPLETED on success.
        """
        session = self.db_session()
        try:
            # Get node info
            node = session.query(Node).filter_by(id=doc.node_id).first()
            if not node:
                raise ValueError(f"Node {doc.node_id} not found")
            
            # Get file path
            file_path = self.storage_dir / node.node_id
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            logger.info(f"Indexing document: {node.name} (ID: {doc.id})")
            
            # Extract text
            text = self._extract_text(str(file_path))
            
            if not text or not text.strip():
                raise ValueError("No text extracted from document")
            
            # Chunk text
            chunks = self._chunk_text(text)
            
            if not chunks:
                raise ValueError("No chunks created from text")
            
            logger.info(f"Created {len(chunks)} chunks for document {doc.id}")
            
            # Generate embeddings
            embeddings = self.embedding_model.encode(chunks, show_progress_bar=False)
            
            # Prepare ChromaDB data
            ids = [f"{doc.id}_chunk_{i}" for i in range(len(chunks))]
            metadatas = [
                {
                    "document_id": doc.id,
                    "node_id": node.id,
                    "filename": node.name,
                    "upload_date": node.created_at.isoformat(),
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                }
                for i in range(len(chunks))
            ]
            
            # Add to ChromaDB
            self.collection.add(
                ids=ids,
                embeddings=embeddings.tolist(),
                documents=chunks,
                metadatas=metadatas
            )
            
            # Update document status
            doc.status = IndexingStatus.COMPLETED
            doc.indexed_date = datetime.utcnow()
            doc.chunk_count = len(chunks)
            doc.error_message = None
            session.commit()
            
            logger.info(f"Successfully indexed document {doc.id} with {len(chunks)} chunks")
        
        except Exception as e:
            session.rollback()
            raise
        finally:
            session.close()

    def _extract_text(self, file_path: str) -> str:
        """
        Extract text from document using Docling.

        Parameters
        ----------
        file_path : str
            Path to the document file.

        Returns
        -------
        str
            Extracted text content in Markdown format.

        Raises
        ------
        ValueError
            If file format is not supported.
        Exception
            If text extraction fails.

        Examples
        --------
        >>> text = indexer._extract_text("document.pdf")
        >>> print(text[:100])
        """
        try:
            logger.info(f"Extracting text from: {file_path}")
            converter = DocumentConverter()
            result = converter.convert(file_path)
            text = result.document.export_to_markdown()
            logger.info(f"Extracted {len(text)} characters from {file_path}")
            return text
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {str(e)}")
            raise

    def _chunk_text(self, text: str) -> List[str]:
        """
        Split text into semantic chunks.

        Parameters
        ----------
        text : str
            Text to chunk.

        Returns
        -------
        List[str]
            List of text chunks.

        Notes
        -----
        Uses the chunking strategy from config. If "semantic", respects
        sentence and paragraph boundaries. If "fixed", uses fixed-size chunks.
        Chunks have max size of config.indexing.chunk_size characters with
        config.indexing.chunk_overlap overlap.

        Examples
        --------
        >>> chunks = indexer._chunk_text("Long document text...")
        >>> len(chunks)
        5
        """
        chunks = []
        chunk_size = self.config.indexing.chunk_size
        overlap = self.config.indexing.chunk_overlap
        strategy = self.config.indexing.chunking_strategy
        
        if strategy == "semantic":
            # Split by paragraphs first
            paragraphs = text.split('\n\n')
            current_chunk = ""
            
            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                
                # If adding this paragraph would exceed chunk size
                if len(current_chunk) + len(para) > chunk_size:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                        # Keep overlap from end of current chunk
                        if overlap > 0:
                            current_chunk = current_chunk[-overlap:]
                        else:
                            current_chunk = ""
                    
                    # If paragraph itself is too long, split by sentences
                    if len(para) > chunk_size:
                        sentences = re.split(r'(?<=[.!?])\s+', para)
                        for sentence in sentences:
                            if len(current_chunk) + len(sentence) > chunk_size:
                                if current_chunk:
                                    chunks.append(current_chunk.strip())
                                    if overlap > 0:
                                        current_chunk = current_chunk[-overlap:]
                                    else:
                                        current_chunk = ""
                            current_chunk += " " + sentence
                    else:
                        current_chunk += " " + para
                else:
                    if current_chunk:
                        current_chunk += "\n\n" + para
                    else:
                        current_chunk = para
            
            # Add remaining chunk
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
        
        else:  # Fixed strategy
            for i in range(0, len(text), chunk_size - overlap):
                chunk = text[i:i + chunk_size]
                if chunk.strip():
                    chunks.append(chunk.strip())
        
        return chunks

    def _handle_indexing_error(self, doc: Document, error_message: str):
        """
        Handle indexing errors with retry logic.

        Parameters
        ----------
        doc : Document
            Document that failed to index.
        error_message : str
            Error message from the indexing attempt.

        Returns
        -------
        None

        Notes
        -----
        Increments retry count. If retry count < max_retries, sets status
        back to PENDING for retry. Otherwise, sets status to FAILED.
        """
        session = self.db_session()
        try:
            doc.retry_count += 1
            doc.error_message = error_message[:1000]  # Truncate to fit column
            
            if doc.retry_count < self.config.indexing.max_retries:
                doc.status = IndexingStatus.PENDING
                logger.info(f"Document {doc.id} will be retried (attempt {doc.retry_count})")
            else:
                doc.status = IndexingStatus.FAILED
                logger.error(f"Document {doc.id} failed after {doc.retry_count} attempts")
            
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error updating document status: {str(e)}")
        finally:
            session.close()

    def search(self, query: str, n_results: int = 10, filter_metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Search for documents using semantic search.

        Parameters
        ----------
        query : str
            Search query text.
        n_results : int, optional
            Number of results to return (default: 10).
        filter_metadata : Dict[str, Any] | None, optional
            Metadata filters to apply.

        Returns
        -------
        List[Dict[str, Any]]
            List of search results with document text and metadata.

        Examples
        --------
        >>> results = indexer.search("machine learning algorithms", n_results=5)
        >>> for result in results:
        ...     print(result['document'], result['metadata'])
        """
        try:
            # Generate query embedding
            query_embedding = self.embedding_model.encode([query], show_progress_bar=False)[0]
            
            # Search ChromaDB
            results = self.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=n_results,
                where=filter_metadata
            )
            
            # Format results
            formatted_results = []
            if results['documents']:
                for i, doc in enumerate(results['documents'][0]):
                    formatted_results.append({
                        'document': doc,
                        'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                        'distance': results['distances'][0][i] if results['distances'] else None,
                    })
            
            return formatted_results
        
        except Exception as e:
            logger.error(f"Error searching documents: {str(e)}", exc_info=True)
            return []

    def get_stats(self) -> Dict[str, Any]:
        """
        Get indexing statistics.

        Returns
        -------
        Dict[str, Any]
            Statistics including counts by status and total collection size.

        Examples
        --------
        >>> stats = indexer.get_stats()
        >>> print(stats)
        {'total': 100, 'pending': 5, 'processing': 2, 'completed': 90, 'failed': 3}
        """
        session = self.db_session()
        try:
            total = session.query(Document).count()
            pending = session.query(Document).filter_by(status=IndexingStatus.PENDING).count()
            processing = session.query(Document).filter_by(status=IndexingStatus.PROCESSING).count()
            completed = session.query(Document).filter_by(status=IndexingStatus.COMPLETED).count()
            failed = session.query(Document).filter_by(status=IndexingStatus.FAILED).count()
            
            collection_count = self.collection.count()
            
            return {
                'total': total,
                'pending': pending,
                'processing': processing,
                'completed': completed,
                'failed': failed,
                'collection_size': collection_count,
            }
        finally:
            session.close()


# Singleton instance
_indexer_instance: Optional[DocumentIndexer] = None
_indexer_lock = threading.Lock()


def get_indexer(config_path: Path | str | None = None) -> DocumentIndexer:
    """
    Get or create singleton DocumentIndexer instance.

    Parameters
    ----------
    config_path : Path | str | None, optional
        Path to configuration file.

    Returns
    -------
    DocumentIndexer
        Singleton DocumentIndexer instance.

    Notes
    -----
    Thread-safe singleton pattern. Only one instance is created per process.

    Examples
    --------
    >>> indexer = get_indexer()
    >>> indexer.start()
    """
    global _indexer_instance
    
    if _indexer_instance is None:
        with _indexer_lock:
            if _indexer_instance is None:
                _indexer_instance = DocumentIndexer(config_path)
    
    return _indexer_instance
