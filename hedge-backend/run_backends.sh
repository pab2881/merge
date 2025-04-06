#!/bin/bash

# Kill any existing processes on ports 3002 and 8000
echo "Stopping any existing backend services..."
kill -9 $(lsof -ti :3002) 2>/dev/null
kill -9 $(lsof -ti :8000) 2>/dev/null

# Activate your virtual environment
echo "Activating virtual environment..."
source hedge-venv/bin/activate

# Start backend_app.py on port 3002
echo "Starting Betfair backend on port 3002..."
python backend_app.py &
BACKEND_PID=$!

# Start enhanced_backend.py on port 8000
echo "Starting enhanced backend on port 8000..."
python enhanced_backend.py &
ENHANCED_BACKEND_PID=$!

echo "Both backends started successfully!"
echo "Betfair backend running on http://localhost:3002"
echo "Enhanced backend running on http://localhost:8000"

# Wait for both processes
wait $BACKEND_PID $ENHANCED_BACKEND_PID