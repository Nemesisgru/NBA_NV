import os
from django.contrib import admin
from django.urls import path, re_path, include
from django.views.static import serve
from django.conf import settings
from audit_core.home_view import frontend_home

frontend_dist = os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'frontend', 'dist'))
frontend_assets = os.path.join(frontend_dist, 'assets')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('audit_core.urls')),
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': frontend_assets}),
    re_path(r'^(?!admin|api|assets).*$', frontend_home, name='frontend_home'),
]
