#!/bin/bash
# Simple Django Server Startup Script
# This script starts the Django backend server from the root backend/ directory

echo "========================================"
echo "Starting Django Backend Server"
echo "========================================"
echo ""

# Change to backend directory
cd backend || exit 1

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
else
    echo "Warning: Virtual environment not found at backend/venv/"
    echo "Attempting to use system Python..."
    echo ""
fi

# Check if Django is installed
if ! python -c "import django; print('Django version:', django.get_version())" 2>/dev/null; then
    echo ""
    echo "ERROR: Django is not installed!"
    echo "Please install dependencies first:"
    echo "  cd backend"
    echo "  pip install -r requirements.txt"
    echo ""
    exit 1
fi

echo ""
echo "Running Django system check..."
python manage.py check
if [ $? -ne 0 ]; then
    echo ""
    echo "WARNING: Django system check found issues!"
    echo "Continuing anyway..."
    echo ""
fi

# Check for pending migrations
echo ""
echo "Checking for pending migrations..."
if python manage.py showmigrations --list | grep -q "\[ \]"; then
    echo "WARNING: There are pending migrations!"
    echo "Run 'python manage.py migrate' to apply them."
    echo ""
fi

echo ""
echo "========================================"
echo "Starting Django server on http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""
echo "Server will be available at:"
echo "  - API: http://localhost:8000/api/"
echo "  - Health Check: http://localhost:8000/api/health/"
echo "  - Admin: http://localhost:8000/admin/"
echo "  - GLB Upload: http://localhost:8000/api/upload-glb/"
echo ""

# Start Django development server
python manage.py runserver

# If we get here, the server has stopped
echo ""
echo "========================================"
echo "Server stopped."
echo "========================================"

