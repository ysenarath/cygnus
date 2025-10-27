"""
Database models for the Cygnus application.

This module defines SQLAlchemy models for user authentication.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import DeclarativeBase
from werkzeug.security import check_password_hash, generate_password_hash

Base: DeclarativeBase = declarative_base()


class User(Base):
    """
    User model for authentication.

    Attributes
    ----------
    id : int
        Primary key for the user.
    username : str
        Unique username for the user.
    email : str
        Unique email address for the user.
    password_hash : str
        Hashed password for the user.
    created_at : datetime
        Timestamp when the user was created.

    Methods
    -------
    set_password(password)
        Hash and set the user's password.
    check_password(password)
        Verify the user's password.
    to_dict()
        Convert the user object to a dictionary.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def set_password(self, password):
        """
        Hash and set the user's password.

        Parameters
        ----------
        password : str
            The plain text password to hash and store.

        Returns
        -------
        None
        """
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """
        Verify the user's password.

        Parameters
        ----------
        password : str
            The plain text password to verify.

        Returns
        -------
        bool
            True if the password is correct, False otherwise.
        """
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """
        Convert the user object to a dictionary.

        Returns
        -------
        dict
            A dictionary representation of the user (excluding password_hash).
        """
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
