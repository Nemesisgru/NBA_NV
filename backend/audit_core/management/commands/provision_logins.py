from django.core.management.base import BaseCommand
from audit_core.models import Auditor, Department
from audit_core.auth_utils import create_or_update_auditor_user, create_or_update_hod_user

class Command(BaseCommand):
    help = 'Provision automatic logins and passwords for all Auditors and HODs'

    def handle(self, *args, **options):
        self.stdout.write("Provisioning Auditor user logins...")
        count_a = 0
        for a in Auditor.objects.all():
            u, p = create_or_update_auditor_user(a)
            count_a += 1
        self.stdout.write(self.style.SUCCESS(f"Provisioned {count_a} Auditor user accounts with passwords."))

        self.stdout.write("Provisioning HOD user logins...")
        count_h = 0
        for d in Department.objects.all():
            u, p = create_or_update_hod_user(d)
            count_h += 1
        self.stdout.write(self.style.SUCCESS(f"Provisioned {count_h} HOD user accounts with passwords."))
