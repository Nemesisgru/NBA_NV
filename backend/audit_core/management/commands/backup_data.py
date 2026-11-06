"""Back up the database and the uploaded evidence files.

    python manage.py backup_data                      # into backend/backups (git-ignored)
    python manage.py backup_data --dest D:\\AuditBackups --keep 30
    python manage.py backup_data --verify             # also test-opens the copy (restore check)

SQLite is copied with SQLite's online backup, so it is consistent while the site is running. For
PostgreSQL use pg_dump instead (see README). Schedule it daily, e.g. with Windows Task Scheduler:
    schtasks /Create /SC DAILY /ST 02:00 /TN "KRGI audit backup" /TR "python E:\\NBA_NV\\backend\\manage.py backup_data"
Copy the backup folder to another machine or drive as well: backups contain logins and audit data.
"""
import shutil
import sqlite3
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = 'Back up the SQLite database and evidence files, keeping the newest copies'

    def add_arguments(self, parser):
        parser.add_argument('--dest', default=str(settings.BASE_DIR / 'backups'))
        parser.add_argument('--keep', type=int, default=14, help='How many backups to keep (oldest are deleted)')
        parser.add_argument('--verify', action='store_true', help='Open the copy and check it is readable')

    def handle(self, *args, **opts):
        if connection.vendor != 'sqlite':
            raise CommandError('This command backs up SQLite. For PostgreSQL use: pg_dump -Fc krgi_audit > backup.dump')
        dest = Path(opts['dest'])
        dest.mkdir(parents=True, exist_ok=True)
        stamp = timezone.localtime().strftime('%Y%m%d-%H%M%S')

        db_copy = dest / f'backup-db-{stamp}.sqlite3'
        src = sqlite3.connect(settings.DATABASES['default']['NAME'])
        out = sqlite3.connect(db_copy)
        with out:
            src.backup(out)
        src.close()
        out.close()

        evidence_dir = Path(settings.AUDIT_EVIDENCE['DIR'])
        ev_zip = None
        if evidence_dir.exists() and any(evidence_dir.iterdir()):
            ev_zip = dest / f'backup-evidence-{stamp}.zip'
            with zipfile.ZipFile(ev_zip, 'w', zipfile.ZIP_DEFLATED) as z:
                for f in evidence_dir.rglob('*'):
                    if f.is_file():
                        z.write(f, f.relative_to(evidence_dir))

        if opts['verify']:
            check = sqlite3.connect(f'file:{db_copy}?mode=ro', uri=True)
            ok = check.execute('PRAGMA integrity_check').fetchone()[0]
            tables = check.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
            rows = check.execute('SELECT count(*) FROM audit_core_department').fetchone()[0]
            check.close()
            if ok != 'ok':
                raise CommandError(f'The backup copy failed the integrity check: {ok}')
            self.stdout.write(f'Verified: integrity ok, {tables} tables, {rows} departments.')

        for pattern in ('backup-db-*.sqlite3', 'backup-evidence-*.zip'):  # only files made by this command
            old = sorted(dest.glob(pattern))[:-opts['keep']] if opts['keep'] > 0 else []
            for f in old:
                f.unlink()
        size = db_copy.stat().st_size / 1_048_576
        self.stdout.write(self.style.SUCCESS(
            f'Backup written: {db_copy.name} ({size:.1f} MB)' + (f' and {ev_zip.name}' if ev_zip else '') + f' in {dest}'))
        self.stdout.write('To restore: stop the site, copy the backup-db-*.sqlite3 file over backend/db.sqlite3, start it again.')
