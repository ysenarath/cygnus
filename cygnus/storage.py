import shutil
from pathlib import Path
from fastapi import UploadFile
from sqlmodel import Session, select
import uuid

from .config import CONFIG_DIR
from .models import FileModel

STORAGE_DIR = CONFIG_DIR / "files"

# Ensure storage directory exists
if not STORAGE_DIR.exists():
    STORAGE_DIR.mkdir(parents=True)


async def save_file(
    file: UploadFile, db: Session, description: str = None
) -> FileModel:
    """
    Save an uploaded file to storage and record its metadata in the database.
    """
    # Generate unique filename
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4()}{ext}"

    # Save file to storage
    file_path = STORAGE_DIR / filename
    with file_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    # Create database record
    db_file = FileModel(
        filename=filename,
        original_filename=file.filename,
        content_type=file.content_type,
        size=file_path.stat().st_size,
        description=description,
    )

    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return db_file


def get_file_path(filename: str) -> Path:
    """Get the full path for a stored file."""
    return STORAGE_DIR / filename


def get_files(db: Session, skip: int = 0, limit: int = 100):
    """Get list of files with pagination."""
    return db.exec(
        select(FileModel)
        .offset(skip)
        .limit(limit)
        .order_by(FileModel.uploaded_at.desc())
    ).all()


def get_file(db: Session, file_id: int):
    """Get file metadata by ID."""
    return db.get(FileModel, file_id)


def delete_file(db: Session, file_id: int) -> bool:
    """Delete a file and its metadata."""
    db_file = get_file(db, file_id)
    if not db_file:
        return False

    # Delete physical file
    file_path = get_file_path(db_file.filename)
    if file_path.exists():
        file_path.unlink()

    # Delete database record
    db.delete(db_file)
    db.commit()

    return True
