from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ItemViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'items', ItemViewSet, basename='item')

urlpatterns = [
    path('', include(router.urls)),
]


