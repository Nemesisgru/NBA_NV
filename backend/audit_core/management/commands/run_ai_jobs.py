import time

from django.core.management.base import BaseCommand

from audit_core.ai import jobs


class Command(BaseCommand):
    help = 'Process draft-report and evidence-extraction jobs (use --once for a single pass)'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true', help='Process pending jobs once and exit')
        parser.add_argument('--interval', type=int, default=5, help='Seconds between checks (default 5)')

    def handle(self, *args, **options):
        while True:
            n = jobs.process_pending()
            if n:
                self.stdout.write(f'Processed {n} job(s).')
            if options['once']:
                break
            time.sleep(options['interval'])
