"""Give every auditor and HOD a new random password and write the list to login.md (git-ignored).

Run once before the site goes live (old passwords followed a guessable pattern and were in git):
    python manage.py rotate_passwords --yes
Every rotated user must change the password at first login. Superusers keep their password but
must also change it at their next login (use --skip-admin to leave them alone).
Nothing is printed to the terminal except counts.
"""
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from audit_core.auth_utils import create_or_update_auditor_user, create_or_update_hod_user, set_must_change
from audit_core.models import Auditor, Department


class Command(BaseCommand):
    help = 'Reset all auditor and HOD passwords to new random ones and write them to login.md'

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Confirm: every auditor and HOD gets a new password')
        parser.add_argument('--skip-admin', action='store_true', help='Do not require superusers to change their password')
        parser.add_argument('--output', default=str(Path(__file__).resolve().parents[4] / 'login.md'),
                            help='Where to write the credentials list (default: login.md in the project folder)')

    def handle(self, *args, **opts):
        if not opts['yes']:
            raise CommandError('This replaces every auditor and HOD password. Run again with --yes to confirm.')

        hods, auditors = [], []
        for d in Department.objects.select_related('institute').order_by('institute__code', 'code'):
            username, pwd = create_or_update_hod_user(d, reset=True)
            hods.append((d.institute.code, d.code, d.hod_name or '', username, d.hod_email or '', pwd))
        for a in Auditor.objects.select_related('institute').order_by('institute__code', 'sl_no', 'name'):
            username, pwd = create_or_update_auditor_user(a, reset=True)
            auditors.append((a.institute.code if a.institute else '', a.name, a.dept_name or '', a.designation or '',
                             username, a.email or '', pwd))
        admins = 0
        if not opts['skip_admin']:
            for u in User.objects.filter(is_superuser=True):
                set_must_change(u, True)
                admins += 1

        def esc(v):
            return str(v).replace('|', '\\|')

        lines = [
            '# KRGI Academic Audit System: Login Credentials',
            '',
            f"Generated {timezone.localtime():%d-%b-%Y %H:%M} by `manage.py rotate_passwords`. CONFIDENTIAL: share each "
            "line only with that person. This file is git-ignored; never commit or email it as a whole.",
            'Every user must choose a new password at first login; these passwords then stop working.',
            '',
            '## Heads of Department',
            '',
            '| College | Dept | HOD | Username | Email (also accepted) | Password |',
            '|---|---|---|---|---|---|',
            *[f"| {' | '.join(esc(v) for v in row)} |" for row in hods],
            '',
            '## Auditors',
            '',
            '| College | Name | Dept | Designation | Username | Email (also accepted) | Password |',
            '|---|---|---|---|---|---|---|',
            *[f"| {' | '.join(esc(v) for v in row)} |" for row in auditors],
            '',
            '## Admin',
            '',
            'The Admin password was not changed' + (', but it must be changed at the next login.' if admins else '.'),
            '',
        ]
        out = Path(opts['output'])
        out.write_text('\n'.join(lines), encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(
            f'New passwords: {len(hods)} HODs, {len(auditors)} auditors. Admins required to change: {admins}. '
            f'List written to {out}'))
