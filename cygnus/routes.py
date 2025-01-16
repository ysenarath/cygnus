from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlmodel import Session
from . import storage
from . import embeddings
from .database import get_session
from .models import FileModel

router = APIRouter(prefix="/api/files")


@router.post("/upload", response_model=FileModel)
async def upload_file(
    file: UploadFile = File(...),
    description: str = None,
    process: bool = True,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_session),
):
    """Upload a file to storage and optionally process it."""
    try:
        file_model = await storage.save_file(file, db, description)
        if process:
            # Process document and rebuild index in background
            def process_and_index():
                embeddings.processor.process_document(file_model, db)
                embeddings.vector_index.create_index(db)

            background_tasks.add_task(process_and_index)
        return file_model
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index")
async def create_index(
    background_tasks: BackgroundTasks, db: Session = Depends(get_session)
):
    """Create or rebuild the vector search index."""
    try:
        background_tasks.add_task(embeddings.vector_index.create_index, db)
        return {"status": "Index creation started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_documents(query: str, k: int = 5, db: Session = Depends(get_session)):
    """Search for similar sentences across all documents."""
    try:
        results = embeddings.vector_index.search(query, k, db)
        return [
            {
                "text": result[0].text,
                "score": float(result[1]),
                "document_id": result[0].document_id,
                "position": result[0].position,
            }
            for result in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{file_id}")
async def download_file(file_id: int, db: Session = Depends(get_session)):
    """Download a file by ID."""
    db_file = storage.get_file(db, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = storage.get_file_path(db_file.filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found in storage")

    return FileResponse(
        path=file_path,
        filename=db_file.original_filename,
        media_type=db_file.content_type,
    )


@router.get("/list", response_model=List[FileModel])
async def list_files(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_session)
):
    """List all files with pagination."""
    return storage.get_files(db, skip, limit)


@router.get("/{file_id}", response_model=FileModel)
async def get_file_info(file_id: int, db: Session = Depends(get_session)):
    """Get file metadata by ID."""
    db_file = storage.get_file(db, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    return db_file


@router.delete("/{file_id}")
async def delete_file(file_id: int, db: Session = Depends(get_session)):
    """Delete a file by ID."""
    if not storage.delete_file(db, file_id):
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "success"}
