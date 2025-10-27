"""
Flask application with REST API for user authentication.

This module sets up the Flask app with Flask-RESTx and provides
authentication endpoints.
"""

from flask import Flask, request
from flask_restx import Api, Resource, fields
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from cygnus.models import Base, User
from cygnus.config import load_config

# Load configuration
config = load_config()

# Initialize Flask app
app = Flask(__name__)
app.config["SECRET_KEY"] = config.security.secret_key

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
        Authenticate a user.
    """

    @api.expect(login_model)
    @api.response(200, "Login successful", user_model)
    @api.response(401, "Invalid credentials")
    def post(self):
        """
        Authenticate a user.

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
            if not data.get("username") or not data.get("password"):
                return {"message": "Username and password are required"}, 400
            # Find user
            user = session.query(User).filter_by(username=data["username"]).first()
            if not user or not user.check_password(data["password"]):
                return {"message": "Invalid username or password"}, 401
            return {"message": "Login successful", "user": user.to_dict()}, 200
        except Exception as e:
            return {"message": f"Error during login: {str(e)}"}, 500
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
