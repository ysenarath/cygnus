#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to cleanup processes on exit
cleanup() {
    echo "Cleaning up processes..."
    jobs -p | xargs -I{} kill {} 2>/dev/null
    exit 0
}

# Trap cleanup function
trap cleanup SIGINT SIGTERM EXIT

# Ensure we're in the project root directory
cd "$(dirname "$0")"

# Check if Poetry is installed
if ! command_exists poetry; then
    echo "Poetry is not installed. Installing Poetry..."
    curl -sSL https://install.python-poetry.org | python3 -
    
    # Add Poetry to PATH for this session
    export PATH="/Users/yasas/.local/bin:$PATH"
    
    # Verify Poetry installation
    if ! command_exists poetry; then
        echo "Failed to install Poetry. Please install it manually and try again."
        exit 1
    fi
fi

# Install Python dependencies using Poetry
echo "Installing Python dependencies..."
poetry install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend && npm install
cd ..

# Start both services
echo "Starting services..."
# Start the backend first to ensure it's available when frontend loads
poetry run uvicorn "cygnus.main:app" --reload --port 8000 & 
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
