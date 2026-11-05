import os
from django.contrib import admin
from django.urls import path, re_path, include
from django.views.static import serve
from django.conf import settings
from audit_core.home_view import frontend_home

frontend_dist = os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'frontend', 'dist'))
frontend_assets = os.path.join(frontend_dist, 'assets')

import re

# Django Admin is mounted only when AUDIT_ADMIN_ENABLED=true, at AUDIT_ADMIN_PATH (see settings)
admin_path = settings.AUDIT_ADMIN_PATH
urlpatterns = [path(admin_path, admin.site.urls)] if settings.AUDIT_ADMIN_ENABLED else []
urlpatterns += [
    path('api/', include('audit_core.urls')),
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': frontend_assets}),
    re_path(r'^(?!%s|api/|assets/).*$' % re.escape(admin_path), frontend_home, name='frontend_home'),
]
