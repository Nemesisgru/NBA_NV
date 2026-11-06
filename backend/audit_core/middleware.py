import json
import logging

from django.conf import settings
from django.core.exceptions import BadRequest
from django.http import Http404, JsonResponse

from .login_guard import client_ip

log = logging.getLogger('audit_core.security')


class AdminAccessMiddleware:
    """Django Admin only when enabled, and only for the allowed addresses (others get a plain 404)"""

    def __init__(self, get_response):
        self.get_response = get_response
        self.prefix = '/' + settings.AUDIT_ADMIN_PATH

    def __call__(self, request):
        if request.path.startswith(self.prefix):
            allowed = settings.AUDIT_ADMIN_ALLOWED_IPS
            if not settings.AUDIT_ADMIN_ENABLED or (allowed and client_ip(request) not in allowed):
                raise Http404()
        return self.get_response(request)


class ApiErrorMiddleware:
    """API errors as JSON: malformed requests get 400, unexpected errors a generic 500 (details only in the log)"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        if not request.path.startswith('/api/'):
            return None
        if isinstance(exception, (BadRequest, json.JSONDecodeError, UnicodeDecodeError)):
            return JsonResponse({'error': 'Malformed request'}, status=400)
        if isinstance(exception, Http404):
            return JsonResponse({'error': 'Not found'}, status=404)
        if settings.DEBUG:
            return None  # show the normal debug page while developing
        log.exception('unhandled API error path=%s', request.path)
        return JsonResponse({'error': 'An unexpected error occurred. Please try again.'}, status=500)


def json_body(request):
    """The request body as a JSON object; anything else is a 400 'Malformed request'"""
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except (ValueError, UnicodeDecodeError):
        raise BadRequest('Malformed JSON')
    if not isinstance(data, dict):
        raise BadRequest('Expected a JSON object')
    return data


class ContentSecurityPolicyMiddleware:
    """Adds the site's Content-Security-Policy unless the view set its own (e.g. the printable report).
    Django Admin is left out: it is off by default and limited to the office address when on."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.admin_prefix = '/' + settings.AUDIT_ADMIN_PATH

    def __call__(self, request):
        response = self.get_response(request)
        if 'Content-Security-Policy' not in response and not request.path.startswith(self.admin_prefix):
            response['Content-Security-Policy'] = settings.AUDIT_CSP
        return response
