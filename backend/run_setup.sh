#!/bin/bash
# Setup script for Django backend

echo "Setting up Django backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Create superuser (optional - uncomment if needed)
# python manage.py createsuperuser

# Load sample data
echo "Loading sample data..."
python manage.py shell < setup.py

echo "Setup complete!"
echo "Run 'python manage.py runserver' to start the development server"

