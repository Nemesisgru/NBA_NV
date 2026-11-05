import re
import secrets
import string

from django.contrib.auth.models import User
from django.utils import timezone

_ALPHABET = string.ascii_letters + string.digits
_SYMBOLS = '@#%&*!?'


def generate_password(length=14):
    """Random password with upper, lower, digit and symbol (never derived from a name or code)"""
    while True:
        chars = [secrets.choice(_ALPHABET) for _ in range(length - 2)] + [secrets.choice(_SYMBOLS), secrets.choice(string.digits)]
        secrets.SystemRandom().shuffle(chars)
        pwd = ''.join(chars)
        if any(c.islower() for c in pwd) and any(c.isupper() for c in pwd):
            return pwd


def set_must_change(user, value=True):
    from .models import AccountSecurity
    sec, _ = AccountSecurity.objects.get_or_create(user=user)
    sec.must_change_password = value
    if not value:
        sec.password_changed_at = timezone.now()
    sec.save()


def must_change_password(user):
    sec = getattr(user, 'security', None) if user and user.is_authenticated else None
    try:
        return bool(sec and sec.must_change_password)
    except Exception:
        return False

def slugify_name(name):
    # e.g. "Dr.A.Oorkalan" -> "oorkalan", "Mr.K.Rajaguru" -> "rajaguru"
    clean = re.sub(r'^(dr|mr|mrs|ms|prof)\.?', '', name, flags=re.IGNORECASE).strip()
    clean = re.sub(r'[^a-zA-Z0-9]+', '', clean).lower()
    return clean or "user"

def create_or_update_auditor_user(auditor, password=None, reset=False):
    slug = slugify_name(auditor.name)
    username = f"auditor.{slug}"
    # ensure uniqueness
    base_username = username
    counter = 1
    while User.objects.filter(username=username).exclude(id=auditor.user_id if auditor.user else None).exists():
        username = f"{base_username}{counter}"
        counter += 1

    # A password is set only for a new login, an explicit password or a reset; existing logins keep theirs
    if auditor.user and password is None and not reset:
        user = auditor.user
        user.username = username
        user.email = auditor.email or f"{username}@krgi.edu"
        user.save()
        return username, None

    pwd = password or generate_password()
    if auditor.user:
        user = auditor.user
        user.username = username
        user.email = auditor.email or f"{username}@krgi.edu"
        user.set_password(pwd)
        user.save()
    else:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': auditor.email or f"{username}@krgi.edu"}
        )
        user.set_password(pwd)
        user.save()
        auditor.user = user

    auditor.initial_password = pwd
    auditor.save(update_fields=['user', 'initial_password'])
    set_must_change(user, True)
    return username, pwd

def create_or_update_hod_user(department, password=None, reset=False):
    inst = department.institute.code.lower()
    dept_code = department.code.lower().replace('&', '').replace(' ', '').replace('(', '').replace(')', '')
    username = f"hod.{inst}.{dept_code}"
    
    if department.hod_user and password is None and not reset:
        user = department.hod_user
        user.username = username
        user.email = department.hod_email or f"{username}@{inst}.ac.in"
        user.save()
        return username, None

    pwd = password or generate_password()
    if department.hod_user:
        user = department.hod_user
        user.username = username
        user.email = department.hod_email or f"{username}@{inst}.ac.in"
        user.set_password(pwd)
        user.save()
    else:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': department.hod_email or f"{username}@{inst}.ac.in"}
        )
        user.set_password(pwd)
        user.save()
        department.hod_user = user

    department.hod_initial_password = pwd
    department.save(update_fields=['hod_user', 'hod_initial_password'])
    set_must_change(user, True)
    return username, pwd
