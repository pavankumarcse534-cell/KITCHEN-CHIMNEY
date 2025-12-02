from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'categories', views.CategoryViewSet)
router.register(r'designs', views.ChimneyDesignViewSet, basename='design')
router.register(r'projects', views.UserProjectViewSet, basename='project')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'contact', views.ContactMessageViewSet, basename='contact')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/profile/', views.profile, name='profile'),
    path('stats/', views.stats, name='stats'),
    path('health/', views.health_check, name='health'),
    path('upload-glb/', views.upload_glb, name='upload-glb'),
    path('upload-image/', views.upload_image, name='upload-image'),
    path('upload-3d-object/', views.upload_3d_object, name='upload-3d-object'),
    path('get-model-by-type/', views.get_model_by_type, name='get-model-by-type'),
    path('get-all-model-types/', views.get_all_model_types, name='get-all-model-types'),
    path('list-models/', views.list_all_models, name='list-models'),
    path('delete-model/', views.delete_model_by_type, name='delete-model-by-type'),
    path('convert-glb-to-dwg/', views.convert_glb_to_dwg_view, name='convert-glb-to-dwg'),
]

