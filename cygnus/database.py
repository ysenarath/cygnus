from sqlmodel import SQLModel, create_engine, Session
from typing import Generator
import threading
from fastapi import Depends

from .config import DATABASE_URL

# Create engine with thread-safe settings
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
    pool_recycle=3600
)

def init_db() -> None:
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()

# Dependency
async def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a SQLModel session"""
    with Session(engine) as session:
        yield session
