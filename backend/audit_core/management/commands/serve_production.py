"""Run the site with the Waitress production server (instead of the development server).

    python manage.py serve_production                 # 127.0.0.1:8000, for nginx / IIS in front
    python manage.py serve_production --port 8080 --threads 12

Put nginx (or IIS) with the HTTPS certificate in front and forward to this address; do not expose it
directly. On Linux, gunicorn works the same way: gunicorn audit_backend.wsgi -b 127.0.0.1:8000 -w 3
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Serve the site with Waitress (production WSGI server)'

    def add_arguments(self, parser):
        parser.add_argument('--host', default='127.0.0.1')
        parser.add_argument('--port', type=int, default=8000)
        parser.add_argument('--threads', type=int, default=8)

    def handle(self, *args, **opts):
        if settings.DEBUG:
            raise CommandError('AUDIT_DEBUG is on. Turn it off for the website (see backend/deploy.env.example).')
        if not (settings.WHITENOISE_ROOT / 'index.html').exists():
            raise CommandError('frontend/dist is missing. Run "npm run build" in frontend/ first.')
        from waitress import serve
        from audit_backend.wsgi import application
        self.stdout.write(f"Serving on http://{opts['host']}:{opts['port']} with {opts['threads']} threads "
                          f"(hosts: {', '.join(settings.ALLOWED_HOSTS)}). Press Ctrl+C to stop.")
        proxy = {}
        if getattr(settings, 'SECURE_PROXY_SSL_HEADER', None):
            # Behind nginx / IIS on this machine: trust its client address and https headers only
            proxy = {'trusted_proxy': '127.0.0.1', 'trusted_proxy_headers': 'x-forwarded-for x-forwarded-proto'}
        serve(application, host=opts['host'], port=opts['port'], threads=opts['threads'],
              clear_untrusted_proxy_headers=True, **proxy)
