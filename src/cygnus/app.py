"""
Flask application with REST API for user authentication and file management.

This module sets up the Flask app with Flask-RESTx and provides
authentication and file management endpoints.
"""

from flask import Flask, request, send_file
from flask_restx import Api, Resource, fields
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from sqlalchemy import create_engine, or_, and_
from sqlalchemy.orm import sessionmaker, scoped_session
from datetime import timedelta
import os
import mimetypes
from werkzeug.utils import secure_filename

from cygnus.models import (
    Base,
    User,
    Node,
    Permission,
    PermissionLevel,
    NodeType,
    Document,
    IndexingStatus,
)
from cygnus.config import load_config
from cygnus.indexer import get_indexer

# Load configuration
config = load_config()

# Initialize Flask app
app = Flask(__name__)
app.config["SECRET_KEY"] = config.security.secret_key

# JWT Configuration
app.config["JWT_SECRET_KEY"] = config.security.jwt_secret_key
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
    seconds=config.security.jwt_access_token_expires
)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(
    seconds=config.security.jwt_refresh_token_expires
)
app.config["JWT_ALGORITHM"] = config.security.jwt_algorithm

# Initialize JWT Manager
jwt = JWTManager(app)

# Token blacklist for logout functionality
token_blacklist = set()


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """
    Check if token has been revoked.

    Parameters
    ----------
    jwt_header : dict
        JWT header.
    jwt_payload : dict
        JWT payload containing claims.

    Returns
    -------
    bool
        True if token is revoked, False otherwise.
    """
    jti = jwt_payload["jti"]
    return jti in token_blacklist


# Enable CORS for frontend communication
frontend_url = f"{config.app.scheme}{config.app.host}:{config.app.port}"
print("Frontend URL for CORS:", frontend_url)
CORS(app, resources={r"/api/*": {"origins": frontend_url}})

# Initialize Flask-RESTx
api = Api(
    app,
    version="1.0",
    title="Cygnus API",
    description="File management system with sharing and permissions",
    doc="/api/docs",
)

# Create namespaces
auth_ns = api.namespace("api/auth", description="Authentication operations")
files_ns = api.namespace("api/files", description="File management operations")

# Storage directory setup
# Get storage directory from config (relative to project root)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
STORAGE_DIR = os.path.join(project_root, config.storage.directory)
os.makedirs(STORAGE_DIR, exist_ok=True)

# Database setup
engine = create_engine(config.database.url, echo=config.database.echo)
Base.metadata.create_all(engine)
Session = scoped_session(sessionmaker(bind=engine))


# Define API models for documentation
register_model = api.model(
    "Register",
    {
        "username": fields.String(required=True, description="Username"),
        "email": fields.String(required=True, description="Email address"),
        "password": fields.String(required=True, description="Password"),
    },
)

login_model = api.model(
    "Login",
    {
        "username": fields.String(required=True, description="Username"),
        "password": fields.String(required=True, description="Password"),
    },
)

user_model = api.model(
    "User",
    {
        "id": fields.Integer(description="User ID"),
        "username": fields.String(description="Username"),
        "email": fields.String(description="Email address"),
        "created_at": fields.String(description="Account creation timestamp"),
    },
)

# File management models
folder_create_model = api.model(
    "FolderCreate",
    {
        "name": fields.String(required=True, description="Folder name"),
        "parent_id": fields.Integer(description="Parent folder ID (optional)"),
    },
)

permission_model = api.model(
    "Permission",
    {
        "user_id": fields.Integer(required=True, description="User ID"),
        "permission_level": fields.String(
            required=True,
            description="Permission level (owner, editor, viewer)",
            enum=["owner", "editor", "viewer"],
        ),
    },
)

node_model = api.model(
    "Node",
    {
        "id": fields.Integer(description="Node ID"),
        "node_id": fields.String(description="Unique node identifier"),
        "name": fields.String(description="Node name"),
        "type": fields.String(description="Node type (file or folder)"),
        "parent_id": fields.Integer(description="Parent folder ID"),
        "owner_id": fields.Integer(description="Owner user ID"),
        "owner": fields.String(description="Owner username"),
        "file_size": fields.Integer(description="File size in bytes"),
        "mime_type": fields.String(description="MIME type"),
        "created_at": fields.String(description="Creation timestamp"),
        "updated_at": fields.String(description="Last update timestamp"),
    },
)


@auth_ns.route("/register")
class Register(Resource):
    """
    User registration endpoint.

    Methods
    -------
    post()
        Register a new user.
    """

    @api.expect(register_model)
    @api.response(201, "User successfully created", user_model)
    @api.response(400, "Validation error or user already exists")
    def post(self):
        """
        Register a new user.

        Returns
        -------
        dict
            Success message and user data, or error message.
        int
            HTTP status code.
        """
        session = Session()
        try:
            data = request.json
            # Validate required fields
            if (
                not data.get("username")
                or not data.get("email")
                or not data.get("password")
            ):
                return {"message": "Username, email, and password are required"}, 400
            # Check if user already exists
            existing_user = (
                session.query(User)
                .filter(
                    (User.username == data["username"]) | (User.email == data["email"])
                )
                .first()
            )
            if existing_user:
                return {"message": "Username or email already exists"}, 400
            # Create new user
            user = User(username=data["username"], email=data["email"])
            user.set_password(data["password"])
            session.add(user)
            session.commit()
            return {"message": "User created successfully", "user": user.to_dict()}, 201
        except Exception as e:
            session.rollback()
            return {"message": f"Error creating user: {str(e)}"}, 500
        finally:
            session.close()


@auth_ns.route("/login")
class Login(Resource):
    """
    User login endpoint.

    Methods
    -------
    post()
        Authenticate a user and return JWT tokens.
    """

    @api.expect(login_model)
    @api.response(200, "Login successful with JWT tokens")
    @api.response(401, "Invalid credentials")
    def post(self):
        """
        Authenticate a user and return JWT tokens.

        Returns
        -------
        dict
            Access token, refresh token, and user data, or error message.
        int
            HTTP status code.
        """
        session = Session()
        try:
            data = request.json
            # Validate required fields
            if not data.get("username") or not data.get("password"):
                return {"message": "Username and password are required"}, 400
            # Find user
            user = session.query(User).filter_by(username=data["username"]).first()
            if not user or not user.check_password(data["password"]):
                return {"message": "Invalid username or password"}, 401

            # Create JWT tokens with user ID as identity
            access_token = create_access_token(identity=str(user.id))
            refresh_token = create_refresh_token(identity=str(user.id))

            return {
                "message": "Login successful",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": user.to_dict(),
            }, 200
        except Exception as e:
            return {"message": f"Error during login: {str(e)}"}, 500
        finally:
            session.close()


@auth_ns.route("/refresh")
class TokenRefresh(Resource):
    """
    Token refresh endpoint.

    Methods
    -------
    post()
        Refresh access token using refresh token.
    """

    @jwt_required(refresh=True)
    @api.response(200, "Token refreshed successfully")
    @api.response(401, "Invalid or expired refresh token")
    def post(self):
        """
        Refresh access token using refresh token.

        Returns
        -------
        dict
            New access token.
        int
            HTTP status code.

        Notes
        -----
        Requires valid refresh token in Authorization header.
        """
        try:
            # Get identity from refresh token
            identity = get_jwt_identity()
            # Create new access token
            access_token = create_access_token(identity=identity)
            return {"access_token": access_token}, 200
        except Exception as e:
            return {"message": f"Error refreshing token: {str(e)}"}, 500


@auth_ns.route("/logout")
class Logout(Resource):
    """
    User logout endpoint.

    Methods
    -------
    post()
        Logout user by revoking tokens.
    """

    @jwt_required(verify_type=False)
    @api.response(200, "Logout successful")
    @api.response(401, "Invalid token")
    def post(self):
        """
        Logout user by adding token to blacklist.

        Returns
        -------
        dict
            Success message.
        int
            HTTP status code.

        Notes
        -----
        Requires valid access or refresh token in Authorization header.
        Accepts both access and refresh tokens for logout.
        """
        try:
            # Get token JTI and add to blacklist
            jti = get_jwt()["jti"]
            token_blacklist.add(jti)
            return {"message": "Logout successful"}, 200
        except Exception as e:
            return {"message": f"Error during logout: {str(e)}"}, 500


@auth_ns.route("/profile")
class Profile(Resource):
    """
    Protected user profile endpoint.

    Methods
    -------
    get()
        Get current user profile.
    """

    @jwt_required()
    @api.response(200, "Profile retrieved successfully", user_model)
    @api.response(401, "Invalid or expired token")
    @api.response(404, "User not found")
    def get(self):
        """
        Get current user profile.

        Returns
        -------
        dict
            User profile data.
        int
            HTTP status code.

        Notes
        -----
        Requires valid access token in Authorization header.
        """
        session = Session()
        try:
            # Get user ID from JWT
            user_id = get_jwt_identity()
            # Find user
            user = session.query(User).filter_by(id=int(user_id)).first()
            if not user:
                return {"message": "User not found"}, 404
            return {"user": user.to_dict()}, 200
        except Exception as e:
            return {"message": f"Error retrieving profile: {str(e)}"}, 500
        finally:
            session.close()


# Helper functions for file management
def get_user_permission(session, node_id, user_id):
    """
    Get user's permission level for a node.

    Parameters
    ----------
    session : Session
        Database session.
    node_id : int
        Node ID.
    user_id : int
        User ID.

    Returns
    -------
    str or None
        Permission level string or None if no permission.
    """
    node = session.query(Node).filter_by(id=node_id).first()
    if not node:
        return None

    # Owner has full permissions
    if node.owner_id == user_id:
        return "owner"

    # Check explicit permissions
    permission = (
        session.query(Permission)
        .filter_by(node_id=node_id, user_id=user_id)
        .first()
    )

    if permission:
        return permission.permission_level.value

    return None


def has_permission(session, node_id, user_id, required_level):
    """
    Check if user has required permission level.

    Parameters
    ----------
    session : Session
        Database session.
    node_id : int
        Node ID.
    user_id : int
        User ID.
    required_level : str
        Required permission level (owner, editor, viewer).

    Returns
    -------
    bool
        True if user has required permission, False otherwise.
    """
    user_level = get_user_permission(session, node_id, user_id)

    if not user_level:
        return False

    # Permission hierarchy: owner > editor > viewer
    levels = {"owner": 3, "editor": 2, "viewer": 1}

    return levels.get(user_level, 0) >= levels.get(required_level, 0)


def get_accessible_nodes(session, user_id, parent_id=None):
    """
    Get all nodes accessible to a user.

    Parameters
    ----------
    session : Session
        Database session.
    user_id : int
        User ID.
    parent_id : int or None
        Parent folder ID to filter by.

    Returns
    -------
    list
        List of accessible nodes.
    """
    # Get nodes owned by user or shared with user
    owned = (
        session.query(Node)
        .filter_by(owner_id=user_id, parent_id=parent_id, is_deleted=False)
        .all()
    )

    # Get nodes shared with user
    shared_permissions = session.query(Permission).filter_by(user_id=user_id).all()
    shared_node_ids = [p.node_id for p in shared_permissions]

    shared = (
        session.query(Node)
        .filter(
            and_(
                Node.id.in_(shared_node_ids),
                Node.parent_id == parent_id,
                Node.is_deleted == False,
            )
        )
        .all()
        if shared_node_ids
        else []
    )

    # Combine and deduplicate
    all_nodes = {r.id: r for r in owned + shared}

    return list(all_nodes.values())


# File management endpoints
@files_ns.route("/folders")
class FolderList(Resource):
    """
    Folder creation endpoint.

    Methods
    -------
    post()
        Create a new folder.
    """

    @jwt_required()
    @api.expect(folder_create_model)
    @api.response(201, "Folder created successfully", node_model)
    @api.response(400, "Validation error")
    @api.response(404, "Parent folder not found")
    def post(self):
        """
        Create a new folder.

        Returns
        -------
        dict
            Created folder data.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())
            data = request.json

            if not data.get("name"):
                return {"message": "Folder name is required"}, 400

            # Validate parent folder if specified
            parent_id = data.get("parent_id")
            if parent_id:
                parent = (
                    session.query(Node)
                    .filter_by(
                        id=parent_id,
                        node_type=NodeType.FOLDER,
                        is_deleted=False,
                    )
                    .first()
                )

                if not parent:
                    return {"message": "Parent folder not found"}, 404

                # Check if user has editor permission on parent
                if not has_permission(session, parent_id, user_id, "editor"):
                    return {
                        "message": "No permission to create folder in this location"
                    }, 403

            # Create folder
            folder = Node(
                name=data["name"],
                node_type=NodeType.FOLDER,
                parent_id=parent_id,
                owner_id=user_id,
            )

            session.add(folder)
            session.commit()

            # Create owner permission
            permission = Permission(
                node_id=folder.id,
                user_id=user_id,
                permission_level=PermissionLevel.OWNER,
            )
            session.add(permission)
            session.commit()

            return {
                "message": "Folder created successfully",
                "folder": folder.to_dict(),
            }, 201
        except Exception as e:
            session.rollback()
            return {"message": f"Error creating folder: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/upload")
class FileUpload(Resource):
    """
    File upload endpoint.

    Methods
    -------
    post()
        Upload a file.
    """

    @jwt_required()
    @api.response(201, "File uploaded successfully", node_model)
    @api.response(400, "Validation error")
    def post(self):
        """
        Upload a file.

        Returns
        -------
        dict
            Uploaded file data.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())

            if "file" not in request.files:
                return {"message": "No file provided"}, 400

            file = request.files["file"]
            if file.filename == "":
                return {"message": "No file selected"}, 400

            parent_id = request.form.get("parent_id")
            if parent_id:
                parent_id = int(parent_id)
                parent = (
                    session.query(Node)
                    .filter_by(
                        id=parent_id,
                        node_type=NodeType.FOLDER,
                        is_deleted=False,
                    )
                    .first()
                )

                if not parent:
                    return {"message": "Parent folder not found"}, 404

                if not has_permission(session, parent_id, user_id, "editor"):
                    return {"message": "No permission to upload to this location"}, 403

            # Create file node
            filename = secure_filename(file.filename)
            mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

            file_node = Node(
                name=filename,
                node_type=NodeType.FILE,
                parent_id=parent_id,
                owner_id=user_id,
                mime_type=mime_type,
                file_size=0,  # Will update after saving
            )

            session.add(file_node)
            session.flush()  # Get the ID before committing

            # Save file to storage with node_id as filename
            file_path = os.path.join(STORAGE_DIR, file_node.node_id)
            file.save(file_path)

            # Update file size
            file_node.file_size = os.path.getsize(file_path)

            # Create owner permission
            permission = Permission(
                node_id=file_node.id,
                user_id=user_id,
                permission_level=PermissionLevel.OWNER,
            )
            session.add(permission)
            
            # Create document indexing record
            document = Document(
                node_id=file_node.id,
                status=IndexingStatus.PENDING,
            )
            session.add(document)
            session.commit()

            return {
                "message": "File uploaded successfully",
                "file": file_node.to_dict(),
                "document_id": document.id,
            }, 201
        except Exception as e:
            session.rollback()
            return {"message": f"Error uploading file: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/list")
class NodeList(Resource):
    """
    Node listing endpoint.

    Methods
    -------
    get()
        List nodes in a folder with pagination support.
    """

    @jwt_required()
    @api.response(200, "Nodes retrieved successfully")
    def get(self):
        """
        List nodes accessible to the user with pagination.

        Returns
        -------
        dict
            List of nodes with pagination metadata.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())
            parent_id = request.args.get("parent_id")
            
            # Pagination parameters
            page = int(request.args.get("page", 1))
            page_size = int(request.args.get("page_size", 50))
            
            # Validate pagination parameters
            if page < 1:
                page = 1
            if page_size < 1 or page_size > 500:
                page_size = 50

            if parent_id:
                parent_id = int(parent_id)
                # Verify parent exists and user has access
                parent = (
                    session.query(Node)
                    .filter_by(id=parent_id, is_deleted=False)
                    .first()
                )

                if not parent:
                    return {"message": "Parent folder not found"}, 404

                if not has_permission(session, parent_id, user_id, "viewer"):
                    return {"message": "No permission to access this folder"}, 403

            # Get all accessible nodes
            all_nodes = get_accessible_nodes(session, user_id, parent_id)
            total_count = len(all_nodes)
            
            # Calculate pagination
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_nodes = all_nodes[start_idx:end_idx]
            total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

            return {
                "nodes": [r.to_dict() for r in paginated_nodes],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total_count,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1
                }
            }, 200
        except Exception as e:
            return {"message": f"Error listing nodes: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/download/<int:node_id>")
class FileDownload(Resource):
    """
    File download endpoint.

    Methods
    -------
    get()
        Download a file.
    """

    @jwt_required()
    @api.response(200, "File downloaded successfully")
    @api.response(404, "File not found")
    def get(self, node_id):
        """
        Download a file.

        Parameters
        ----------
        node_id : int
            Node ID.

        Returns
        -------
        File
            File content.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())

            node = (
                session.query(Node)
                .filter_by(
                    id=node_id, node_type=NodeType.FILE, is_deleted=False
                )
                .first()
            )

            if not node:
                return {"message": "File not found"}, 404

            if not has_permission(session, node_id, user_id, "viewer"):
                return {"message": "No permission to access this file"}, 403

            file_path = os.path.join(STORAGE_DIR, node.node_id)

            if not os.path.exists(file_path):
                return {"message": "File not found on disk"}, 404

            return send_file(
                file_path,
                as_attachment=True,
                download_name=node.name,
                mimetype=node.mime_type,
            )
        except Exception as e:
            return {"message": f"Error downloading file: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/<int:node_id>/share")
class NodeShare(Resource):
    """
    Node sharing endpoint.

    Methods
    -------
    post()
        Share a node with another user.
    get()
        Get permissions for a node.
    delete()
        Remove a user's permission.
    """

    @jwt_required()
    @api.expect(permission_model)
    @api.response(201, "Permission granted successfully")
    def post(self, node_id):
        """
        Share a node with another user.

        Parameters
        ----------
        node_id : int
            Node ID.

        Returns
        -------
        dict
            Success message.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())
            data = request.json

            # Check if user is owner
            node = (
                session.query(Node)
                .filter_by(id=node_id, is_deleted=False)
                .first()
            )

            if not node:
                return {"message": "Node not found"}, 404

            if node.owner_id != user_id:
                return {"message": "Only owner can share nodes"}, 403

            # Validate target user exists
            target_user_id = data.get("user_id")
            target_user = session.query(User).filter_by(id=target_user_id).first()

            if not target_user:
                return {"message": "Target user not found"}, 404

            if target_user_id == user_id:
                return {"message": "Cannot share with yourself"}, 400

            # Check permission level
            permission_level = data.get("permission_level")
            if permission_level not in ["owner", "editor", "viewer"]:
                return {"message": "Invalid permission level"}, 400

            # Check if permission already exists
            existing = (
                session.query(Permission)
                .filter_by(node_id=node_id, user_id=target_user_id)
                .first()
            )

            if existing:
                # Update existing permission
                existing.permission_level = PermissionLevel[permission_level.upper()]
                session.commit()
                return {"message": "Permission updated successfully"}, 200

            # Create new permission
            permission = Permission(
                node_id=node_id,
                user_id=target_user_id,
                permission_level=PermissionLevel[permission_level.upper()],
            )
            session.add(permission)
            session.commit()

            return {"message": "Permission granted successfully"}, 201
        except Exception as e:
            session.rollback()
            return {"message": f"Error sharing node: {str(e)}"}, 500
        finally:
            session.close()

    @jwt_required()
    @api.response(200, "Permissions retrieved successfully")
    def get(self, node_id):
        """
        Get permissions for a node.

        Parameters
        ----------
        node_id : int
            Node ID.

        Returns
        -------
        dict
            List of permissions.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())

            node = (
                session.query(Node)
                .filter_by(id=node_id, is_deleted=False)
                .first()
            )

            if not node:
                return {"message": "Node not found"}, 404

            # Only owner can view permissions
            if node.owner_id != user_id:
                return {"message": "Only owner can view permissions"}, 403

            permissions = (
                session.query(Permission).filter_by(node_id=node_id).all()
            )

            return {"permissions": [p.to_dict() for p in permissions]}, 200
        except Exception as e:
            return {"message": f"Error retrieving permissions: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/<int:node_id>/share/<int:user_id>")
class NodeUnshare(Resource):
    """
    Remove sharing permission endpoint.

    Methods
    -------
    delete()
        Remove a user's permission to a node.
    """

    @jwt_required()
    @api.response(200, "Permission removed successfully")
    def delete(self, node_id, user_id):
        """
        Remove a user's permission.

        Parameters
        ----------
        node_id : int
            Node ID.
        user_id : int
            User ID to remove permission from.

        Returns
        -------
        dict
            Success message.
        int
            HTTP status code.
        """
        session = Session()
        try:
            current_user_id = int(get_jwt_identity())

            node = (
                session.query(Node)
                .filter_by(id=node_id, is_deleted=False)
                .first()
            )

            if not node:
                return {"message": "Node not found"}, 404

            if node.owner_id != current_user_id:
                return {"message": "Only owner can remove permissions"}, 403

            permission = (
                session.query(Permission)
                .filter_by(node_id=node_id, user_id=user_id)
                .first()
            )

            if not permission:
                return {"message": "Permission not found"}, 404

            # Cannot remove owner's permission
            if permission.permission_level == PermissionLevel.OWNER:
                return {"message": "Cannot remove owner permission"}, 400

            session.delete(permission)
            session.commit()

            return {"message": "Permission removed successfully"}, 200
        except Exception as e:
            session.rollback()
            return {"message": f"Error removing permission: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/<int:node_id>")
class NodeDetail(Resource):
    """
    Node detail endpoint.

    Methods
    -------
    get()
        Get node details.
    put()
        Update node (rename/move).
    delete()
        Delete a node.
    """

    @jwt_required()
    @api.response(200, "Node retrieved successfully", node_model)
    def get(self, node_id):
        """
        Get node details.

        Parameters
        ----------
        node_id : int
            Node ID.

        Returns
        -------
        dict
            Node data.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())

            node = (
                session.query(Node)
                .filter_by(id=node_id, is_deleted=False)
                .first()
            )

            if not node:
                return {"message": "Node not found"}, 404

            if not has_permission(session, node_id, user_id, "viewer"):
                return {"message": "No permission to access this node"}, 403

            return {"node": node.to_dict(include_permissions=True)}, 200
        except Exception as e:
            return {"message": f"Error retrieving node: {str(e)}"}, 500
        finally:
            session.close()

    @jwt_required()
    @api.response(200, "Node updated successfully")
    def put(self, node_id):
        """
        Update node (rename/move).

        Parameters
        ----------
        node_id : int
            Node ID.

        Returns
        -------
        dict
            Updated node data.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())
            data = request.json

            node = (
                session.query(Node)
                .filter_by(id=node_id, is_deleted=False)
                .first()
            )

            if not node:
                return {"message": "Node not found"}, 404

            if not has_permission(session, node_id, user_id, "editor"):
                return {"message": "No permission to edit this node"}, 403

            # Update name if provided
            if "name" in data:
                node.name = data["name"]

            # Move to new parent if provided
            if "parent_id" in data:
                new_parent_id = data["parent_id"]
                if new_parent_id:
                    new_parent = (
                        session.query(Node)
                        .filter_by(
                            id=new_parent_id,
                            node_type=NodeType.FOLDER,
                            is_deleted=False,
                        )
                        .first()
                    )

                    if not new_parent:
                        return {"message": "New parent folder not found"}, 404

                    if not has_permission(session, new_parent_id, user_id, "editor"):
                        return {
                            "message": "No permission to move to this location"
                        }, 403

                node.parent_id = new_parent_id

            session.commit()

            return {
                "message": "Node updated successfully",
                "node": node.to_dict(),
            }, 200
        except Exception as e:
            session.rollback()
            return {"message": f"Error updating node: {str(e)}"}, 500
        finally:
            session.close()

    @jwt_required()
    @api.response(200, "Node deleted successfully")
    def delete(self, node_id):
        """
        Delete a node (soft delete).

        Parameters
        ----------
        node_id : int
            Node ID.

        Returns
        -------
        dict
            Success message.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())

            node = (
                session.query(Node)
                .filter_by(id=node_id, is_deleted=False)
                .first()
            )

            if not node:
                return {"message": "Node not found"}, 404

            # Only owner can delete
            if node.owner_id != user_id:
                return {"message": "Only owner can delete nodes"}, 403

            # Soft delete
            node.is_deleted = True
            session.commit()

            return {"message": "Node deleted successfully"}, 200
        except Exception as e:
            session.rollback()
            return {"message": f"Error deleting node: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/<int:node_id>/indexing-status")
class FileIndexingStatus(Resource):
    """
    Document indexing status endpoint.

    Methods
    -------
    get()
        Get indexing status for a file.
    """

    @jwt_required()
    @api.response(200, "Indexing status retrieved successfully")
    @api.response(404, "File not found")
    def get(self, node_id):
        """
        Get indexing status for a file.

        Parameters
        ----------
        node_id : int
            Node ID.

        Returns
        -------
        dict
            Indexing status and metadata.
        int
            HTTP status code.
        """
        session = Session()
        try:
            user_id = int(get_jwt_identity())

            # Get node
            node = (
                session.query(Node)
                .filter_by(id=node_id, node_type=NodeType.FILE, is_deleted=False)
                .first()
            )

            if not node:
                return {"message": "File not found"}, 404

            if not has_permission(session, node_id, user_id, "viewer"):
                return {"message": "No permission to access this file"}, 403

            # Get document indexing record
            document = session.query(Document).filter_by(node_id=node_id).first()

            if not document:
                return {
                    "status": "not_indexed",
                    "message": "File has not been queued for indexing"
                }, 200

            return {
                "file": {
                    "id": node.id,
                    "name": node.name,
                    "size": node.file_size,
                    "mime_type": node.mime_type,
                },
                "indexing": document.to_dict(),
            }, 200
        except Exception as e:
            return {"message": f"Error retrieving indexing status: {str(e)}"}, 500
        finally:
            session.close()


@files_ns.route("/search")
class DocumentSearch(Resource):
    """
    Document search endpoint.

    Methods
    -------
    post()
        Search documents using semantic search.
    """

    @jwt_required()
    @api.response(200, "Search completed successfully")
    def post(self):
        """
        Search documents using semantic search.

        Returns
        -------
        dict
            Search results.
        int
            HTTP status code.
        """
        try:
            data = request.json

            if not data or not data.get("query"):
                return {"message": "Query is required"}, 400

            query = data.get("query")
            n_results = data.get("n_results", 10)

            # Validate n_results
            if n_results < 1 or n_results > 100:
                n_results = 10

            # Get indexer and perform search
            indexer = get_indexer()
            results = indexer.search(query, n_results=n_results)

            return {
                "query": query,
                "results": results,
                "count": len(results),
            }, 200
        except Exception as e:
            return {"message": f"Error searching documents: {str(e)}"}, 500


@files_ns.route("/stats")
class IndexingStats(Resource):
    """
    Indexing statistics endpoint.

    Methods
    -------
    get()
        Get indexing statistics.
    """

    @jwt_required()
    @api.response(200, "Statistics retrieved successfully")
    def get(self):
        """
        Get indexing statistics.

        Returns
        -------
        dict
            Indexing statistics.
        int
            HTTP status code.
        """
        try:
            # Get indexer and retrieve stats
            indexer = get_indexer()
            stats = indexer.get_stats()

            return {"stats": stats}, 200
        except Exception as e:
            return {"message": f"Error retrieving statistics: {str(e)}"}, 500


def run_app():
    """
    Run the Flask application.

    Returns
    -------
    None

    Notes
    -----
    Uses configuration from config.yaml for host, port, and debug settings.
    """
    app.run(host=config.api.host, port=config.api.port, debug=config.api.debug)


if __name__ == "__main__":
    run_app()
