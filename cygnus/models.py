from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class FileModel(SQLModel, table=True):
    __tablename__ = "files"

    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str = Field(index=True)
    original_filename: str
    content_type: str
    size: int
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    description: Optional[str] = None
