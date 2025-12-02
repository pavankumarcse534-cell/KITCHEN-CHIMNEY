# Chimney Craft 3D - Django Backend

Django REST API backend for the Kitchen Chimney Design System.

## Features

- RESTful API for managing chimney design projects
- Project CRUD operations
- Item management (nested under projects)
- CORS enabled for frontend integration
- Django Admin interface for data management

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   # On Windows
   python -m venv venv
   venv\Scripts\activate

   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create a superuser (optional, for admin access):**
   ```bash
   python manage.py createsuperuser
   ```

6. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://localhost:8000/api/`

## API Endpoints

### Projects

- `GET /api/projects/` - List all projects
- `POST /api/projects/` - Create a new project
- `GET /api/projects/{id}/` - Get project details (includes items)
- `PUT /api/projects/{id}/` - Update a project
- `PATCH /api/projects/{id}/` - Partially update a project
- `DELETE /api/projects/{id}/` - Delete a project

### Items

- `GET /api/items/` - List all items (optional query param: `?project={project_id}`)
- `POST /api/items/` - Create a new item
- `GET /api/items/{id}/` - Get item details
- `PUT /api/items/{id}/` - Update an item
- `PATCH /api/items/{id}/` - Partially update an item
- `DELETE /api/items/{id}/` - Delete an item

### Nested Item Endpoints (under Projects)

- `GET /api/projects/{id}/items/` - Get all items for a project
- `POST /api/projects/{id}/items/` - Create an item for a project
- `PUT /api/projects/{id}/items/{item_id}/` - Update a project's item
- `PATCH /api/projects/{id}/items/{item_id}/` - Partially update a project's item
- `DELETE /api/projects/{id}/items/{item_id}/` - Delete a project's item

## API Examples

### Create a Project

```bash
POST /api/projects/
Content-Type: application/json

{
  "project_name": "Kitchen Renovation",
  "client_name": "John Doe",
  "customer_code": "CUST001",
  "date": "2024-01-15",
  "location": "New York",
  "drawing_type": "shop",
  "sheet_type": "304",
  "dim_section1": 100.0,
  "dim_section2": 60.0,
  "dim_section3": 80.0,
  "dim_section4": 40.0
}
```

### Create an Item for a Project

```bash
POST /api/projects/1/items/
Content-Type: application/json

{
  "item_code": "ITEM001",
  "location": "Main Kitchen",
  "model": "CHIM-2024",
  "length": 90.0,
  "width": 50.0,
  "height": 70.0,
  "exhaust_collar_dm": "150mm",
  "filter_item_code": "FILT001",
  "filter_dimension": "30x30",
  "filter_qty": 2,
  "filter_length": "30cm",
  "watts": 1200.0
}
```

## Project Model Fields

- `project_name` (required)
- `client_name` (required)
- `customer_code`
- `date`
- `location`
- `drawing_type` (choices: 'shop', 'production', 'both')
- `sheet_type` (choices: '202', '304')
- `dim_section1`, `dim_section2`, `dim_section3`, `dim_section4`
- `created_at`, `updated_at` (auto-generated)

## Item Model Fields

- `project` (ForeignKey to Project, required)
- `item_code`
- `location`
- `model`
- `length`, `width`, `height`
- `exhaust_collar_dm`
- `filter_item_code`
- `filter_dimension`
- `filter_qty`
- `filter_length`
- `watts`
- `created_at`, `updated_at` (auto-generated)

## Django Admin

Access the admin interface at `http://localhost:8000/admin/` after creating a superuser.

## CORS Configuration

CORS is configured to allow requests from:
- `http://localhost:8080` (Vite default)
- `http://127.0.0.1:8080`
- `http://localhost:5173` (Vite alternative port)
- `http://127.0.0.1:5173`

For production, update `CORS_ALLOWED_ORIGINS` in `settings.py` and set `CORS_ALLOW_ALL_ORIGINS = False`.

## Database

The default database is SQLite (`db.sqlite3`). For production, consider using PostgreSQL or MySQL by updating the `DATABASES` setting in `settings.py`.

## Security Notes

⚠️ **Important for Production:**

1. Change `SECRET_KEY` in `settings.py`
2. Set `DEBUG = False`
3. Update `ALLOWED_HOSTS` with your domain
4. Configure proper CORS origins
5. Use a production database (PostgreSQL recommended)
6. Set up proper authentication and permissions
7. Use environment variables for sensitive settings

## Frontend Integration

Update your frontend API calls to point to `http://localhost:8000/api/` when running the backend locally.

Example fetch call:
```javascript
fetch('http://localhost:8000/api/projects/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(projectData)
})
```


