"""
Database models for the Cygnus application.

This module defines SQLAlchemy models for user authentication and file management.
"""

from datetime import datetime
from enum import Enum as PyEnum
import uuid

from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, Enum, BigInteger, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import DeclarativeBase, relationship
from werkzeug.security import check_password_hash, generate_password_hash

Base: DeclarativeBase = declarative_base()


class PermissionLevel(PyEnum):
    """
    Enumeration for permission levels.
    
    Attributes
    ----------
    OWNER : str
        Full control over the resource.
    EDITOR : str
        Can view and edit the resource.
    VIEWER : str
        Can only view the resource.
    """
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class ResourceType(PyEnum):
    """
    Enumeration for resource types.
    
    Attributes
    ----------
    FILE : str
        A file resource.
    FOLDER : str
        A folder resource.
    """
    FILE = "file"
    FOLDER = "folder"


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


class Resource(Base):
    """
    Resource model for files and folders.

    Attributes
    ----------
    id : int
        Primary key for the resource.
    resource_id : str
        Unique identifier for the resource (UUID).
    name : str
        Name of the file or folder.
    resource_type : ResourceType
        Type of resource (file or folder).
    parent_id : int
        ID of the parent folder (NULL for root items).
    owner_id : int
        ID of the user who owns the resource.
    file_size : int
        Size of the file in bytes (NULL for folders).
    mime_type : str
        MIME type of the file (NULL for folders).
    is_deleted : bool
        Soft delete flag.
    created_at : datetime
        Timestamp when the resource was created.
    updated_at : datetime
        Timestamp when the resource was last updated.
    """

    __tablename__ = "resources"

    id = Column(Integer, primary_key=True)
    resource_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    resource_type = Column(Enum(ResourceType), nullable=False)
    parent_id = Column(Integer, ForeignKey("resources.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", backref="owned_resources")
    parent = relationship("Resource", remote_side=[id], backref="children")
    permissions = relationship("Permission", back_populates="resource", cascade="all, delete-orphan")

    def to_dict(self, include_permissions=False):
        """
        Convert the resource object to a dictionary.

        Parameters
        ----------
        include_permissions : bool
            Whether to include permissions in the output.

        Returns
        -------
        dict
            A dictionary representation of the resource.
        """
        result = {
            "id": self.id,
            "resource_id": self.resource_id,
            "name": self.name,
            "type": self.resource_type.value,
            "parent_id": self.parent_id,
            "owner_id": self.owner_id,
            "owner": self.owner.username if self.owner else None,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_permissions:
            result["permissions"] = [p.to_dict() for p in self.permissions]
        
        return result


class Permission(Base):
    """
    Permission model for resource access control.

    Attributes
    ----------
    id : int
        Primary key for the permission.
    resource_id : int
        ID of the resource.
    user_id : int
        ID of the user who has permission.
    permission_level : PermissionLevel
        Level of permission (owner, editor, viewer).
    created_at : datetime
        Timestamp when the permission was granted.
    """

    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission_level = Column(Enum(PermissionLevel), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    resource = relationship("Resource", back_populates="permissions")
    user = relationship("User", backref="permissions")

    def to_dict(self):
        """
        Convert the permission object to a dictionary.

        Returns
        -------
        dict
            A dictionary representation of the permission.
        """
        return {
            "id": self.id,
            "resource_id": self.resource_id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "permission_level": self.permission_level.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
