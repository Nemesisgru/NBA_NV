from django.apps import AppConfig


class AuditCoreConfig(AppConfig):
    name = 'audit_core'

    def ready(self):
        from . import login_guard  # noqa: F401  (registers the failed-login signal handlers)
