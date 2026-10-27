import re
from django.contrib.auth.models import User

def slugify_name(name):
    # e.g. "Dr.A.Oorkalan" -> "oorkalan", "Mr.K.Rajaguru" -> "rajaguru"
    clean = re.sub(r'^(dr|mr|mrs|ms|prof)\.?', '', name, flags=re.IGNORECASE).strip()
    clean = re.sub(r'[^a-zA-Z0-9]+', '', clean).lower()
    return clean or "user"

def create_or_update_auditor_user(auditor, password=None):
    slug = slugify_name(auditor.name)
    username = f"auditor.{slug}"
    # ensure uniqueness
    base_username = username
    counter = 1
    while User.objects.filter(username=username).exclude(id=auditor.user_id if auditor.user else None).exists():
        username = f"{base_username}{counter}"
        counter += 1

    pwd = password or auditor.initial_password or f"Audit@{slug.capitalize() or '2025'}#"
    
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
    return username, pwd

def create_or_update_hod_user(department, password=None):
    inst = department.institute.code.lower()
    dept_code = department.code.lower().replace('&', '').replace(' ', '').replace('(', '').replace(')', '')
    username = f"hod.{inst}.{dept_code}"
    
    pwd = password or department.hod_initial_password or f"Hod@{department.code.replace(' ', '')}2025#"

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
    return username, pwd
