"""
Custom admin views for email-based login
"""
from django.contrib.auth import authenticate, login
from django.contrib.auth.views import LoginView
from django.shortcuts import redirect
from django.urls import reverse, reverse_lazy
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


class EmailLoginView(LoginView):
    """
    Custom login view that accepts email or username
    """
    template_name = 'admin/login.html'
    redirect_authenticated_user = True
    success_url = reverse_lazy('admin:index')
    
    def form_valid(self, form):
        """Override to handle email-based authentication"""
        username = form.cleaned_data.get('username')
        password = form.cleaned_data.get('password')
        
        # Try to authenticate with email backend (which supports both email and username)
        user = authenticate(
            self.request,
            username=username,
            password=password
        )
        
        if user is not None and user.is_active:
            login(self.request, user)
            return redirect(self.get_success_url())
        
        return super().form_invalid(form)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def auto_login_view(request):
    """
    Auto-login view that accepts email and password via GET or POST
    Usage: /admin/auto-login/?email=user@example.com&password=pass
    """
    if request.method == 'GET':
        email = request.GET.get('email')
        password = request.GET.get('password')
    else:
        email = request.POST.get('email')
        password = request.POST.get('password')
    
    if not email or not password:
        return JsonResponse({
            'error': 'Email and password are required'
        }, status=400)
    
    # Authenticate user (works with email or username)
    user = authenticate(request, username=email, password=password)
    
    if user is not None and user.is_active and user.is_staff:
        login(request, user)
        return redirect(reverse('admin:index'))
    else:
        return JsonResponse({
            'error': 'Invalid credentials or user is not a staff member'
        }, status=401)

