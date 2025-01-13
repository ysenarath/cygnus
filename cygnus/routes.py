from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session
from . import storage
from .database import get_db
from .models import FileModel

router = APIRouter(prefix="/api/files")


@router.post("/upload", response_model=FileModel)
async def upload_file(
    file: UploadFile = File(...), description: str = None, db: Session = Depends(get_db)
):
    """Upload a file to storage."""
    try:
        return await storage.save_file(file, db, description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{file_id}")
async def download_file(file_id: int, db: Session = Depends(get_db)):
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
async def list_files(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all files with pagination."""
    return storage.get_files(db, skip, limit)


@router.get("/{file_id}", response_model=FileModel)
async def get_file_info(file_id: int, db: Session = Depends(get_db)):
    """Get file metadata by ID."""
    db_file = storage.get_file(db, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    return db_file


@router.delete("/{file_id}")
async def delete_file(file_id: int, db: Session = Depends(get_db)):
    """Delete a file by ID."""
    if not storage.delete_file(db, file_id):
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "success"}
