# Chimney Craft 3D - Django Backend

Django REST API backend for the Chimney Craft 3D application.

## Features

- **User Authentication**: Token-based authentication for secure API access
- **Chimney Designs**: CRUD operations for 3D chimney designs
- **User Projects**: Save and manage user's custom 3D chimney projects
- **Categories**: Organize designs by categories
- **Orders**: Order management system
- **Contact Messages**: Contact form functionality
- **CORS Support**: Configured for frontend integration

## Installation

1. **Create a virtual environment** (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Run migrations**:
```bash
python manage.py migrate
```

4. **Create a superuser** (optional, for admin access):
```bash
python manage.py createsuperuser
```

5. **Run the development server**:
```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

## API Endpoints

### Authentication
- `POST /api/auth/register/` - Register a new user
- `POST /api/auth/login/` - Login and get token
- `POST /api/auth/logout/` - Logout (requires authentication)
- `GET /api/auth/profile/` - Get user profile (requires authentication)

### Categories
- `GET /api/categories/` - List all categories
- `POST /api/categories/` - Create category (requires authentication)
- `GET /api/categories/{id}/` - Get category details
- `PUT/PATCH /api/categories/{id}/` - Update category
- `DELETE /api/categories/{id}/` - Delete category

### Designs
- `GET /api/designs/` - List all active designs
  - Query parameters:
    - `category` - Filter by category ID
    - `featured=true` - Filter featured designs
    - `search` - Search in title and description
- `POST /api/designs/` - Create design (requires authentication)
- `GET /api/designs/{id}/` - Get design details
- `PUT/PATCH /api/designs/{id}/` - Update design
- `DELETE /api/designs/{id}/` - Delete design
- `POST /api/designs/{id}/duplicate/` - Duplicate a design

### Projects
- `GET /api/projects/` - List user's projects (requires authentication)
- `POST /api/projects/` - Create project (requires authentication)
- `GET /api/projects/{id}/` - Get project details
- `PUT/PATCH /api/projects/{id}/` - Update project
- `DELETE /api/projects/{id}/` - Delete project
- `GET /api/projects/public/` - Get all public projects

### Orders
- `GET /api/orders/` - List orders (user's orders, or all if staff)
- `POST /api/orders/` - Create order (requires authentication)
- `GET /api/orders/{id}/` - Get order details
- `PUT/PATCH /api/orders/{id}/` - Update order

### Contact
- `POST /api/contact/` - Submit contact message (public)
- `GET /api/contact/` - List messages (admin only)

### Statistics
- `GET /api/stats/` - Get public statistics (public)

## Authentication

The API uses token-based authentication. After registering or logging in, include the token in your requests:

```
Authorization: Token <your-token-here>
```

### Example Registration Request:
```json
POST /api/auth/register/
{
  "username": "user123",
  "email": "user@example.com",
  "password": "securepassword",
  "password_confirm": "securepassword",
  "first_name": "John",
  "last_name": "Doe"
}
```

### Example Login Request:
```json
POST /api/auth/login/
{
  "username": "user123",
  "password": "securepassword"
}
```

## Frontend Integration

The backend is configured to accept requests from:
- `http://localhost:3000` (React default)
- `http://localhost:5173` (Vite default)

To add more origins, update `CORS_ALLOWED_ORIGINS` in `settings.py`.

## Example API Usage

### Fetch all designs:
```javascript
fetch('http://localhost:8000/api/designs/')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Create a project (authenticated):
```javascript
fetch('http://localhost:8000/api/projects/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Token your-token-here'
  },
  body: JSON.stringify({
    name: 'My Custom Chimney',
    description: 'A beautiful chimney design',
    design_data: { /* your 3D design data */ },
    model_data: { /* your 3D model data */ }
  })
})
  .then(response => response.json())
  .then(data => console.log(data));
```

## Media Files

Uploaded files (images, 3D models) are stored in the `media/` directory. Make sure this directory exists and is writable.

## Admin Panel

Access the Django admin panel at `http://localhost:8000/admin/` after creating a superuser.

## Production Deployment

Before deploying to production:

1. Change `SECRET_KEY` in `settings.py`
2. Set `DEBUG = False`
3. Update `ALLOWED_HOSTS`
4. Configure a production database (PostgreSQL recommended)
5. Set up proper static file serving
6. Configure HTTPS
7. Update CORS settings for your production domain

## License

This project is part of the Chimney Craft 3D application.

