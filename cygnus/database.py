from fastapi import Depends
from sqlmodel import Session, SQLModel, create_engine
from typing import Annotated, Generator

from .config import DATABASE_URL

# Create engine with thread-safe settings
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
    pool_recycle=3600,
)


def init_db() -> None:
    """Initialize database tables.

    Args:
        recreate: If True, drop all tables before creating them.
    """
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Dependency that provides a SQLModel session"""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
