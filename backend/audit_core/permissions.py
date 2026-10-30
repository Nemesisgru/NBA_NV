from functools import wraps
from django.db.models import Q
from django.http import JsonResponse
from .models import AuditAssignment

# ATR fields each role may change; anything else in the payload is ignored
HOD_ATR_FIELDS = {'root_cause', 'action_plan', 'target_date', 'completed_date', 'evidence_ref', 'status', 'hod_remarks'}
AUDITOR_ATR_FIELDS = {'auditor_signoff', 'auditor_feedback'}


def user_role(user):
    """'Admin' | 'Auditor' | 'HOD', or None for anonymous / unlinked accounts"""
    if not user or not user.is_authenticated:
        return None
    if getattr(user, 'auditor_profile', None):
        return 'Auditor'
    if getattr(user, 'hod_department', None):
        return 'HOD'
    if user.is_superuser or user.is_staff:
        return 'Admin'
    return None


def auditor_assignments(auditor):
    return AuditAssignment.objects.filter(Q(auditor_1=auditor) | Q(auditor_2=auditor))


def criteria_for(assignment, auditor):
    crit = assignment.auditor_1_criteria if assignment.auditor_1_id == auditor.id else assignment.auditor_2_criteria
    return crit or assignment.assigned_criteria or []


def scoped_department_ids(request):
    """Department ids the user may see, or None meaning all departments (Admin)"""
    if request.role == 'Admin':
        return None
    if request.role == 'HOD':
        return {request.user.hod_department.id}
    return set(auditor_assignments(request.user.auditor_profile).values_list('department_id', flat=True))


def can_view_department(request, dept_id):
    ids = scoped_department_ids(request)
    try:
        return ids is None or int(dept_id) in ids
    except (TypeError, ValueError):
        return False


def can_edit_criterion(request, dept_id, cycle_id, criterion_code):
    """Admin edits everything; an auditor only the criteria assigned to them for that department and cycle"""
    if request.role == 'Admin':
        return True
    if request.role != 'Auditor':
        return False
    auditor = request.user.auditor_profile
    ass = auditor_assignments(auditor).filter(department_id=dept_id, cycle_id=cycle_id).first()
    return bool(ass) and criterion_code in criteria_for(ass, auditor)


def role_required(*roles):
    """Reject anonymous users (401) and users outside `roles` (403); sets request.role"""
    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            role = user_role(request.user)
            if role is None:
                return JsonResponse({'error': 'Login required'}, status=401)
            if roles and role not in roles:
                return JsonResponse({'error': 'You do not have access to this action'}, status=403)
            request.role = role
            return view(request, *args, **kwargs)
        return wrapper
    return decorator


def forbidden(msg='You do not have access to this department'):
    return JsonResponse({'error': msg}, status=403)
