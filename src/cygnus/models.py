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


class NodeType(PyEnum):
    """
    Enumeration for node types.
    
    Attributes
    ----------
    FILE : str
        A file node.
    FOLDER : str
        A folder node.
    """
    FILE = "file"
    FOLDER = "folder"


class IndexingStatus(PyEnum):
    """
    Enumeration for document indexing status.
    
    Attributes
    ----------
    PENDING : str
        Document is queued for indexing.
    PROCESSING : str
        Document is currently being indexed.
    COMPLETED : str
        Document indexing completed successfully.
    FAILED : str
        Document indexing failed.
    """
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


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


class Node(Base):
    """
    Node model for files and folders in the file system.

    Attributes
    ----------
    id : int
        Primary key for the node.
    node_id : str
        Unique identifier for the node (UUID).
    name : str
        Name of the file or folder.
    node_type : NodeType
        Type of node (file or folder).
    parent_id : int
        ID of the parent folder (NULL for root items).
    owner_id : int
        ID of the user who owns the node.
    file_size : int
        Size of the file in bytes (NULL for folders).
    mime_type : str
        MIME type of the file (NULL for folders).
    is_deleted : bool
        Soft delete flag.
    created_at : datetime
        Timestamp when the node was created.
    updated_at : datetime
        Timestamp when the node was last updated.
    """

    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True)
    node_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    node_type = Column(Enum(NodeType), nullable=False)
    parent_id = Column(Integer, ForeignKey("nodes.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", backref="owned_nodes")
    parent = relationship("Node", remote_side=[id], backref="children")
    permissions = relationship("Permission", back_populates="node", cascade="all, delete-orphan")

    def to_dict(self, include_permissions=False):
        """
        Convert the node object to a dictionary.

        Parameters
        ----------
        include_permissions : bool
            Whether to include permissions in the output.

        Returns
        -------
        dict
            A dictionary representation of the node.
        """
        result = {
            "id": self.id,
            "node_id": self.node_id,
            "name": self.name,
            "type": self.node_type.value,
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
    Permission model for node access control.

    Attributes
    ----------
    id : int
        Primary key for the permission.
    node_id : int
        ID of the node.
    user_id : int
        ID of the user who has permission.
    permission_level : PermissionLevel
        Level of permission (owner, editor, viewer).
    created_at : datetime
        Timestamp when the permission was granted.
    """

    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission_level = Column(Enum(PermissionLevel), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    node = relationship("Node", back_populates="permissions")
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
            "node_id": self.node_id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "permission_level": self.permission_level.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Document(Base):
    """
    Document indexing tracking model.

    Links to Node model for file information.
    Tracks indexing status and metadata.

    Attributes
    ----------
    id : int
        Primary key for the document.
    node_id : int
        Foreign key to nodes table.
    status : IndexingStatus
        Current indexing status.
    indexed_date : datetime
        Timestamp when indexing completed.
    chunk_count : int
        Number of chunks created from the document.
    error_message : str
        Error details if indexing failed.
    retry_count : int
        Number of retry attempts made.
    created_at : datetime
        Timestamp when the document record was created.
    """

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    status = Column(Enum(IndexingStatus), default=IndexingStatus.PENDING)
    indexed_date = Column(DateTime, nullable=True)
    chunk_count = Column(Integer, default=0)
    error_message = Column(String(1000), nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to Node
    node = relationship("Node", backref="document_index")

    def to_dict(self):
        """
        Convert the document object to a dictionary.

        Returns
        -------
        dict
            A dictionary representation of the document.
        """
        return {
            "id": self.id,
            "node_id": self.node_id,
            "status": self.status.value,
            "indexed_date": self.indexed_date.isoformat() if self.indexed_date else None,
            "chunk_count": self.chunk_count,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
