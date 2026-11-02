"""Authorised college / department / cycle scope for the assistant.

The permitted departments always come from the authenticated user (permissions.scoped_department_ids).
Values sent by the client are only a requested filter; anything outside the permitted set is rejected,
never replaced by another college or department.
"""
from dataclasses import dataclass, field

from ..models import AuditCycle, Department, Institute
from ..permissions import scoped_department_ids


class ScopeError(Exception):
    def __init__(self, message, status=403):
        super().__init__(message)
        self.status = status


@dataclass
class Scope:
    user_id: int
    role: str
    department_ids: list            # authorised AND requested
    cycle: AuditCycle = None
    college_code: str = ''
    label: str = ''
    departments: list = field(default_factory=list)

    @property
    def single_department(self):
        return self.departments[0] if len(self.departments) == 1 else None

    def cache_key(self):
        """Identifies the access context; used in every cache key"""
        return f"u{self.user_id}:{self.role}:d{','.join(map(str, sorted(self.department_ids)))}:c{self.cycle.id if self.cycle else '-'}"

    def describe(self):
        return {
            'college': self.college_code or 'All authorised colleges',
            'department_ids': self.department_ids,
            'departments': [f"{d.institute.code} - {d.code}" for d in self.departments[:50]],
            'department_count': len(self.department_ids),
            'cycle_id': self.cycle.id if self.cycle else None,
            'cycle': str(self.cycle) if self.cycle else None,
            'label': self.label,
        }


def _int_or_none(value, name):
    if value in (None, '', 'all'):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ScopeError(f'Invalid {name}', 400)


def allowed_departments(request):
    """Departments the user may see (queryset)"""
    ids = scoped_department_ids(request)
    qs = Department.objects.select_related('institute').order_by('institute__code', 'code')
    return qs if ids is None else qs.filter(id__in=ids)


def resolve_scope(request, college=None, department_id=None, cycle_id=None, require_cycle=True):
    allowed = allowed_departments(request)
    allowed_ids = set(allowed.values_list('id', flat=True))
    dept_id = _int_or_none(department_id, 'department')
    cyc_id = _int_or_none(cycle_id, 'audit cycle')
    college = (college or '').strip().upper()
    if college == 'ALL':
        college = ''

    if college and not Institute.objects.filter(code=college).exists():
        raise ScopeError('Unknown college', 404)

    if dept_id is not None:
        dept = Department.objects.select_related('institute').filter(id=dept_id).first()
        if not dept:
            raise ScopeError('Department not found', 404)
        if dept_id not in allowed_ids:
            raise ScopeError('You do not have access to this department')
        if college and dept.institute.code != college:
            raise ScopeError('The department does not belong to the selected college', 400)
        departments = [dept]
    else:
        qs = allowed.filter(institute__code=college) if college else allowed
        departments = list(qs)
        if college and not departments:
            raise ScopeError('You do not have access to any department of this college')
        if not departments:
            raise ScopeError('No departments are available to you')

    cycle = None
    if cyc_id is not None:
        cycle = AuditCycle.objects.filter(id=cyc_id).first()
        if not cycle:
            raise ScopeError('Audit cycle not found', 404)
    elif require_cycle:
        raise ScopeError('Select an audit cycle', 400)

    if len(departments) == 1:
        label = f"{departments[0].institute.code} - {departments[0].code}"
    elif college:
        label = f"{college} (all {len(departments)} authorised departments)"
    else:
        label = f"All {len(departments)} authorised departments"
    if cycle:
        label += f", {cycle}"

    return Scope(
        user_id=request.user.id, role=request.role, department_ids=[d.id for d in departments],
        cycle=cycle, college_code=college or (departments[0].institute.code if dept_id else ''),
        label=label, departments=departments,
    )


def scope_options(request):
    """Colleges, departments and cycles the user may pick in the assistant"""
    depts = list(allowed_departments(request))
    colleges = sorted({d.institute.code for d in depts})
    return {
        'colleges': [{'code': c, 'name': Institute.objects.get(code=c).name} for c in colleges],
        'departments': [{'id': d.id, 'code': d.code, 'name': d.name, 'college': d.institute.code} for d in depts],
        'cycles': [{'id': c.id, 'name': str(c)} for c in ordered_cycles()],
    }


_SEMESTER = {'Odd': 0, 'Even': 1}
_TYPE = {'Mid-Semester': 0, 'End-Semester': 1}


def cycle_sort_key(c):
    return (c.academic_year, _SEMESTER.get(c.semester, 9), _TYPE.get(c.cycle_type, 9), c.id)


def ordered_cycles():
    return sorted(AuditCycle.objects.all(), key=cycle_sort_key)
