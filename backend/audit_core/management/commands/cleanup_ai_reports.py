from django.core.management.base import BaseCommand

from audit_core.ai.reports import cleanup_old_reports


class Command(BaseCommand):
    help = 'Delete AI draft reports (database rows and files) older than AUDIT_AI REPORT_RETENTION_DAYS'

    def handle(self, *args, **options):
        removed = cleanup_old_reports()
        self.stdout.write(self.style.SUCCESS(f'Removed {removed} expired draft report(s).'))
