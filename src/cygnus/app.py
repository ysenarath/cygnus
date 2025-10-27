"""
Flask application with REST API for user authentication.

This module sets up the Flask app with Flask-RESTx and provides
authentication endpoints.
"""

from flask import Flask, request
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
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from datetime import timedelta

from cygnus.models import Base, User
from cygnus.config import load_config

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
    title="Cygnus Authentication API",
    description="A simple authentication API with user registration and login",
    doc="/api/docs",
)

# Create namespace for authentication
auth_ns = api.namespace("api/auth", description="Authentication operations")

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
