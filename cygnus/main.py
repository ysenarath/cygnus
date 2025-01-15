from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db, SessionDep
from .routes import router as files_router

app = FastAPI(title="Cygnus API")

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],  # Vite's default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    init_db()


# Include file routes
app.include_router(files_router)


@app.get("/api/health")
async def health_check(db: SessionDep):
    """Health check endpoint that also verifies database connection"""
    try:
        # Test database connection
        db.exec("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}
