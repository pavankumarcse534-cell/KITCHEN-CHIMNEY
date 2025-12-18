"""
Django settings for chimney_craft_backend project.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent  # Root of the entire project

# Load environment variables from .env file
load_dotenv(os.path.join(BASE_DIR, '.env'))


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-change-this-in-production-!@#$%^&*()'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['*']


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # CORS middleware must be as high as possible, before CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'chimney_craft_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main', 'dist'),  # Frontend build directory
            os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main'),  # Frontend source directory
            os.path.join(PROJECT_ROOT),  # Root directory for index.html
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'chimney_craft_backend.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom authentication backends - allows email-based login
AUTHENTICATION_BACKENDS = [
    'api.backends.EmailBackend',  # Custom backend for email login
    'django.contrib.auth.backends.ModelBackend',  # Default username backend
]

# Logout redirect URL - redirects to admin login page after logout
LOGOUT_REDIRECT_URL = '/admin/'

# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Additional static files directories for frontend (only add if they exist)
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'api', 'static'),
]
frontend_dist_assets = os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main', 'dist', 'assets')
frontend_public = os.path.join(PROJECT_ROOT, 'chimney-craft-3d-main', 'public')
if os.path.exists(frontend_dist_assets):
    STATICFILES_DIRS.append(frontend_dist_assets)
if os.path.exists(frontend_public):
    STATICFILES_DIRS.append(frontend_public)

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# File upload size limits (for large GLB files)
# Default Django limit is 2.5MB, increasing to 500MB for large 3D models
DATA_UPLOAD_MAX_MEMORY_SIZE = 524288000  # 500 MB in bytes
FILE_UPLOAD_MAX_MEMORY_SIZE = 524288000  # 500 MB in bytes
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10240  # Increase field limit if needed

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
}

# CORS settings for frontend integration
# In DEBUG mode, allow all origins for easier development
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True
else:
    # Production: Only allow specific origins
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8080",
        # Add network IP addresses (update with your actual IP)
        "http://192.168.0.107:5173",  # Update this with your network IP
        "http://192.168.0.107:3000",
        "http://192.168.0.107:8080",
    ]
    CORS_ALLOW_CREDENTIALS = True

# Explicitly allow media files to be accessed via CORS
CORS_URLS_REGEX = r'^/api/.*$|^/media/.*$'

# Additional CORS settings for media files
CORS_EXPOSE_HEADERS = ['Content-Type', 'Content-Length', 'Accept-Ranges', 'Content-Disposition']

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'HEAD',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-csrftoken',
    'x-requested-with',
]

