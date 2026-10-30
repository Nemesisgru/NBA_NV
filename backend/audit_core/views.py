import json
import csv
import io
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from .models import (
    Institute, Department, Auditor, AuditCycle, Criterion,
    MetricItem, AuditAssignment, AuditEvaluation, ActionTakenReport, AuditSettings
)
from .auth_utils import create_or_update_auditor_user, create_or_update_hod_user
from .permissions import (
    HOD_ATR_FIELDS, AUDITOR_ATR_FIELDS, user_role, auditor_assignments, criteria_for,
    scoped_department_ids, can_view_department, can_edit_criterion, role_required, forbidden
)

def get_settings():
    s = AuditSettings.objects.first()
    if not s:
        s = AuditSettings.objects.create()
    return s

def calculate_grade(percentage, settings):
    if percentage is None:
        return ''
    if percentage > (settings.y_threshold * 100):
        return 'Y'
    elif percentage >= (settings.c_threshold * 100):
        return 'C'
    elif percentage >= (settings.w_threshold * 100):
        return 'W'
    else:
        return 'D'

@csrf_exempt
def auth_login_view(request):
    """User login endpoint for Admin, Auditors, and HODs"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body.decode('utf-8'))
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return JsonResponse({'error': 'Username and password required'}, status=400)

    # Allow signing in with the account email (e.g. hod.cs@krct.ac.in) as well as the username
    if '@' in username:
        by_email = User.objects.filter(email__iexact=username).first()
        if by_email:
            username = by_email.username

    user = authenticate(username=username, password=password)
    if not user:
        return JsonResponse({'error': 'Invalid username or password'}, status=401)
    if user_role(user) is None:
        return JsonResponse({'error': 'This account has no Admin, Auditor or HOD role'}, status=403)

    login(request, user)
    return JsonResponse({'status': 'success', 'user': user_payload(user)})

def auth_me_view(request):
    """Current session user, used by the frontend to restore a login after page reload"""
    if user_role(request.user) is None:
        return JsonResponse({'error': 'Login required'}, status=401)
    return JsonResponse({'status': 'success', 'user': user_payload(request.user)})

@csrf_exempt
def auth_logout_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    logout(request)
    return JsonResponse({'status': 'success'})

def user_payload(user):
    """Profile, role and assigned scope returned to the frontend after login"""
    role = user_role(user)
    auditor_info = None
    hod_info = None

    if role == 'Auditor':
        auditor = user.auditor_profile
        # Find all assigned departments for this auditor
        assignments = auditor_assignments(auditor).select_related('department__institute')
        assigned_list = []
        for ass in assignments:
            assigned_list.append({
                'cycle_id': ass.cycle_id,
                'department_id': ass.department_id,
                'department_code': ass.department.code,
                'institute_code': ass.department.institute.code,
                'assigned_criteria': criteria_for(ass, auditor)
            })
        auditor_info = {
            'auditor_id': auditor.id,
            'name': auditor.name,
            'designation': auditor.designation,
            'institute_code': auditor.institute.code if auditor.institute else '',
            'dept_name': auditor.dept_name,
            'assignments': assigned_list
        }

    elif role == 'HOD':
        dept = user.hod_department
        hod_info = {
            'department_id': dept.id,
            'department_code': dept.code,
            'department_name': dept.name,
            'institute_code': dept.institute.code,
            'hod_name': dept.hod_name,
            'hod_email': dept.hod_email
        }

    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': role,
        'auditor_info': auditor_info,
        'hod_info': hod_info
    }

@role_required()
def bootstrap_data(request):
    """Initial app configuration and reference data, limited to the user's scope (credentials for Admin only)"""
    settings = get_settings()
    is_admin = request.role == 'Admin'
    dept_ids = scoped_department_ids(request)

    dept_qs = Department.objects.select_related('institute', 'hod_user').order_by('institute__code', 'id')
    if dept_ids is not None:
        dept_qs = dept_qs.filter(id__in=dept_ids)

    departments = []
    for d in dept_qs:
        departments.append({
            'id': d.id,
            'institute_id': d.institute_id,
            'institute_code': d.institute.code,
            'code': d.code,
            'name': d.name,
            'hod_name': d.hod_name,
            'hod_email': d.hod_email,
            'hod_username': d.hod_user.username if (is_admin and d.hod_user) else '',
            'hod_initial_password': d.hod_initial_password if is_admin else '',
        })

    visible_institutes = {d['institute_code'] for d in departments}
    institutes = [i for i in Institute.objects.values('id', 'code', 'name') if is_admin or i['code'] in visible_institutes]

    cycles = list(AuditCycle.objects.values('id', 'academic_year', 'cycle_type', 'semester', 'is_active'))
    active_cycle = AuditCycle.objects.filter(is_active=True).first()
    if not active_cycle and cycles:
        active_cycle = AuditCycle.objects.first()

    criteria = []
    for c in Criterion.objects.order_by('order').all():
        criteria.append({
            'id': c.id,
            'code': c.code,
            'title': c.title,
            'order': c.order,
            'metric_count': c.metrics.filter(is_header=False).count(),
            'max_marks': sum(m.max_marks for m in c.metrics.filter(is_header=False))
        })

    # The auditor pool (with login credentials) is only needed by the Admin allocation page
    auditors = []
    auditor_qs = Auditor.objects.filter(is_active=True) if is_admin else Auditor.objects.none()
    for a in auditor_qs.select_related('institute', 'user').order_by('sl_no', 'name'):
        auditors.append({
            'id': a.id,
            'sl_no': a.sl_no,
            'name': a.name,
            'username': a.user.username if a.user else '',
            'initial_password': a.initial_password,
            'institute_code': a.institute.code if a.institute else '',
            'dept_name': a.dept_name,
            'designation': a.designation,
            'experience': a.experience,
            'email': a.email
        })

    return JsonResponse({
        'institutes': institutes,
        'departments': departments,
        'cycles': cycles,
        'active_cycle_id': active_cycle.id if active_cycle else None,
        'criteria': criteria,
        'auditors': auditors,
        'settings': {
            'y_threshold': settings.y_threshold,
            'c_threshold': settings.c_threshold,
            'w_threshold': settings.w_threshold,
            'rubric_max_score': settings.rubric_max_score,
            'physical_gap_threshold': settings.physical_gap_threshold,
        }
    })

@role_required()
def criterion_detail(request, criterion_code):
    """Detailed rubric items & current evaluations for a criterion and department"""
    dept_id = request.GET.get('department_id')
    cycle_id = request.GET.get('cycle_id')

    crit = Criterion.objects.filter(code=criterion_code.upper()).first()
    if not crit:
        return JsonResponse({'error': 'Criterion not found'}, status=404)
    if dept_id and not can_view_department(request, dept_id):
        return forbidden()

    eval_map = {}
    if dept_id and cycle_id:
        evals = AuditEvaluation.objects.filter(department_id=dept_id, cycle_id=cycle_id, metric__criterion=crit)
        for ev in evals:
            eval_map[ev.metric_id] = {
                'id': ev.id,
                'items_checked': ev.items_checked,
                'valid_items': ev.valid_items,
                'validated_value': ev.validated_value,
                'marks_obtained': ev.marks_obtained,
                'percentage': ev.percentage,
                'grade': ev.grade,
                'auditor_remarks': ev.auditor_remarks,
                'evidence_status': ev.evidence_status,
                'physical_check_result': ev.physical_check_result,
                'is_flagged_for_atr': ev.is_flagged_for_atr,
            }

    items = []
    for m in crit.metrics.order_by('order').all():
        ev = eval_map.get(m.id, {})
        items.append({
            'id': m.id,
            'code': m.code,
            'is_header': m.is_header,
            'key_aspect': m.key_aspect,
            'auditor_verifies': m.auditor_verifies,
            'valid_condition': m.valid_condition,
            'sampling_unit': m.sampling_unit,
            'sample_percent': m.sample_percent,
            'min_sample': m.min_sample,
            'how_to_sample': m.how_to_sample,
            'rubric_Y': m.rubric_Y,
            'rubric_C': m.rubric_C,
            'rubric_W': m.rubric_W,
            'rubric_D': m.rubric_D,
            'unit': m.unit,
            'max_marks': m.max_marks,
            'benchmark': m.benchmark,
            'evaluation': ev
        })

    return JsonResponse({
        'criterion': {
            'code': crit.code,
            'title': crit.title,
            'description': crit.description,
            'order': crit.order
        },
        'can_edit': bool(dept_id and cycle_id) and can_edit_criterion(request, dept_id, cycle_id, crit.code),
        'metrics': items
    })

@csrf_exempt
@role_required('Admin', 'Auditor')
def save_evaluation(request):
    """Save an individual metric evaluation with live calculations and automatic ATR for < 60%"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body.decode('utf-8'))
    dept_id = data.get('department_id')
    cycle_id = data.get('cycle_id')
    metric_id = data.get('metric_id')

    if not dept_id or not cycle_id or not metric_id:
        return JsonResponse({'error': 'Missing required fields'}, status=400)

    metric = MetricItem.objects.filter(id=metric_id).first()
    if not metric:
        return JsonResponse({'error': 'Metric not found'}, status=404)
    if metric.is_header:
        return JsonResponse({'error': f'{metric.code} is a section header and cannot be scored'}, status=400)
    if not Department.objects.filter(id=dept_id).exists():
        return JsonResponse({'error': 'Department not found'}, status=404)
    if not AuditCycle.objects.filter(id=cycle_id).exists():
        return JsonResponse({'error': 'Audit cycle not found'}, status=404)
    if not can_edit_criterion(request, dept_id, cycle_id, metric.criterion.code):
        return forbidden(f'{metric.criterion.code} of this department is not assigned to you for this audit cycle')

    settings = get_settings()

    items_checked = data.get('items_checked')
    valid_items = data.get('valid_items')
    auditor_remarks = data.get('auditor_remarks', '')
    evidence_status = data.get('evidence_status', 'Complete')
    physical_check_result = data.get('physical_check_result', 'Matches claim')
    is_flagged = data.get('is_flagged_for_atr', False)

    try:
        items_checked = round(float(items_checked), 2) if items_checked is not None and str(items_checked) != '' else None
    except:
        items_checked = None

    try:
        valid_items = round(float(valid_items), 2) if valid_items is not None and str(valid_items) != '' else None
    except:
        valid_items = None

    validated_value = None
    marks_obtained = None
    percentage = None
    grade = ''

    if valid_items is not None and items_checked is not None and items_checked > 0:
        if metric.unit == '%':
            validated_value = round((valid_items / items_checked) * 100, 2)
        else:
            validated_value = round(valid_items, 2)

    if validated_value is not None:
        benchmark = metric.benchmark if metric.benchmark and metric.benchmark > 0 else 100.0
        ratio = min(validated_value / benchmark, 1.0)
        marks_obtained = round(metric.max_marks * ratio, 2)
        if metric.max_marks > 0:
            percentage = round((marks_obtained / metric.max_marks) * 100, 2)
            grade = calculate_grade(percentage, settings)
        else:
            percentage = 100.0
            grade = 'Y'

    # USER REQUIREMENT: Marks below 60% in any category are automatically added to the ATR!
    if percentage is not None and percentage < 60.0:
        is_flagged = True
    elif grade in ['W', 'D']:
        is_flagged = True

    eval_obj, created = AuditEvaluation.objects.update_or_create(
        department_id=dept_id,
        cycle_id=cycle_id,
        metric=metric,
        defaults={
            'items_checked': items_checked,
            'valid_items': valid_items,
            'validated_value': validated_value,
            'marks_obtained': marks_obtained,
            'percentage': percentage,
            'grade': grade,
            'auditor_remarks': auditor_remarks,
            'evidence_status': evidence_status,
            'physical_check_result': physical_check_result,
            'is_flagged_for_atr': is_flagged
        }
    )

    # Automatically create or ensure ATR stub exists if flagged or score < 60%
    if is_flagged:
        pct_display = f"{percentage}%" if percentage is not None else "Below benchmark"
        ActionTakenReport.objects.get_or_create(
            evaluation=eval_obj,
            defaults={
                'root_cause': f'Identified score below benchmark ({pct_display}) for {metric.key_aspect[:50]}.',
                'action_plan': 'Departmental corrective measure required.',
                'status': 'Open',
                'hod_remarks': ''
            }
        )

    return JsonResponse({
        'status': 'success',
        'evaluation': {
            'id': eval_obj.id,
            'items_checked': eval_obj.items_checked,
            'valid_items': eval_obj.valid_items,
            'validated_value': eval_obj.validated_value,
            'marks_obtained': eval_obj.marks_obtained,
            'percentage': eval_obj.percentage,
            'grade': eval_obj.grade,
            'auditor_remarks': eval_obj.auditor_remarks,
            'evidence_status': eval_obj.evidence_status,
            'physical_check_result': eval_obj.physical_check_result,
            'is_flagged_for_atr': eval_obj.is_flagged_for_atr,
        }
    })

@role_required()
def criterion_summary(request):
    """Aggregated summary matching Excel 'Criterion Summary' tab (C1 to C9)"""
    dept_id = request.GET.get('department_id')
    cycle_id = request.GET.get('cycle_id')

    if not dept_id or not cycle_id:
        return JsonResponse({'error': 'department_id and cycle_id required'}, status=400)
    if not can_view_department(request, dept_id):
        return forbidden()

    dept = Department.objects.filter(id=dept_id).first()
    cycle = AuditCycle.objects.filter(id=cycle_id).first()
    if not dept or not cycle:
        return JsonResponse({'error': 'Department or cycle not found'}, status=404)
    settings = get_settings()

    summary_rows = []
    total_max_marks = 0
    total_obtained_marks = 0
    total_y = 0
    total_c = 0
    total_w = 0
    total_d = 0
    total_unscored = 0

    criteria = Criterion.objects.order_by('order').all()
    for crit in criteria:
        metric_items = crit.metrics.filter(is_header=False)
        c_max = sum(m.max_marks for m in metric_items)
        
        evals = AuditEvaluation.objects.filter(department_id=dept_id, cycle_id=cycle_id, metric__in=metric_items)
        c_obtained = sum(ev.marks_obtained for ev in evals if ev.marks_obtained is not None)
        
        pct = round((c_obtained / c_max) * 100, 2) if c_max > 0 else 0
        grade = calculate_grade(pct, settings) if evals.exists() else '-'

        count_y = evals.filter(grade='Y').count()
        count_c = evals.filter(grade='C').count()
        count_w = evals.filter(grade='W').count()
        count_d = evals.filter(grade='D').count()
        scored_count = evals.filter(~Q(grade='')).count()
        unscored = metric_items.count() - scored_count

        summary_rows.append({
            'code': crit.code,
            'title': crit.title,
            'max_marks': round(c_max, 1),
            'validated_marks': round(c_obtained, 2),
            'percentage': pct,
            'grade': grade,
            'count_y': count_y,
            'count_c': count_c,
            'count_w': count_w,
            'count_d': count_d,
            'unscored': unscored
        })

        total_max_marks += c_max
        total_obtained_marks += c_obtained
        total_y += count_y
        total_c += count_c
        total_w += count_w
        total_d += count_d
        total_unscored += unscored

    overall_pct = round((total_obtained_marks / total_max_marks) * 100, 2) if total_max_marks > 0 else 0
    overall_grade = calculate_grade(overall_pct, settings)

    return JsonResponse({
        'department': {
            'id': dept.id,
            'code': dept.code,
            'name': dept.name,
            'institute': dept.institute.code
        },
        'cycle': {
            'id': cycle.id,
            'academic_year': cycle.academic_year,
            'cycle_type': cycle.cycle_type,
            'semester': cycle.semester
        },
        'rows': summary_rows,
        'totals': {
            'max_marks': round(total_max_marks, 1),
            'validated_marks': round(total_obtained_marks, 2),
            'percentage': overall_pct,
            'grade': overall_grade,
            'count_y': total_y,
            'count_c': total_c,
            'count_w': total_w,
            'count_d': total_d,
            'unscored': total_unscored
        }
    })

@role_required('Admin')
def dashboard_overview(request):
    """Cross-department & cross-institute overview matching Excel 'KRGI Dashboard'"""
    cycle_id = request.GET.get('cycle_id')
    cycle = AuditCycle.objects.filter(id=cycle_id).first() if cycle_id else AuditCycle.objects.filter(is_active=True).first()
    if not cycle:
        cycle = AuditCycle.objects.first()

    settings = get_settings()
    institutes = Institute.objects.all()

    institute_cards = []
    department_matrix = []

    criteria_list = list(Criterion.objects.order_by('order').values('code', 'title'))

    for inst in institutes:
        depts = inst.departments.all()
        dept_scores = []

        for d in depts:
            evals = AuditEvaluation.objects.filter(department=d, cycle=cycle)
            metrics = MetricItem.objects.filter(is_header=False)
            total_max = sum(m.max_marks for m in metrics)
            total_obtained = sum(ev.marks_obtained for ev in evals if ev.marks_obtained is not None)
            pct = round((total_obtained / total_max) * 100, 2) if total_max > 0 else 0
            grade = calculate_grade(pct, settings) if evals.exists() else '-'

            crit_scores = {}
            for c in criteria_list:
                c_metrics = metrics.filter(criterion__code=c['code'])
                c_max = sum(m.max_marks for m in c_metrics)
                c_evals = evals.filter(metric__criterion__code=c['code'])
                c_obt = sum(ev.marks_obtained for ev in c_evals if ev.marks_obtained is not None)
                c_pct = round((c_obt / c_max) * 100, 1) if c_max > 0 else 0
                crit_scores[c['code']] = {
                    'pct': c_pct,
                    'grade': calculate_grade(c_pct, settings) if c_evals.exists() else '-'
                }

            row_data = {
                'department_id': d.id,
                'department_code': d.code,
                'department_name': d.name,
                'institute_code': inst.code,
                'overall_pct': pct,
                'overall_grade': grade,
                'y_count': evals.filter(grade='Y').count(),
                'c_count': evals.filter(grade='C').count(),
                'w_count': evals.filter(grade='W').count(),
                'd_count': evals.filter(grade='D').count(),
                'criteria': crit_scores,
                'has_data': evals.exists()
            }
            department_matrix.append(row_data)
            if evals.exists():
                dept_scores.append(pct)

        avg_pct = round(sum(dept_scores) / len(dept_scores), 2) if dept_scores else 0
        inst_grade = calculate_grade(avg_pct, settings) if dept_scores else '-'

        institute_cards.append({
            'institute_code': inst.code,
            'institute_name': inst.name,
            'departments_audited': len(dept_scores),
            'total_departments': depts.count(),
            'average_pct': avg_pct,
            'grade': inst_grade
        })

    return JsonResponse({
        'cycle': {
            'id': cycle.id if cycle else None,
            'name': str(cycle) if cycle else ''
        },
        'criteria': criteria_list,
        'institutes': institute_cards,
        'department_matrix': department_matrix
    })

@role_required('Admin')
def comparison_view(request):
    """Multi-department comparison analytics"""
    dept_ids = request.GET.getlist('department_ids')
    cycle_id = request.GET.get('cycle_id')
    settings = get_settings()

    if not dept_ids:
        dept_ids = list(Department.objects.values_list('id', flat=True)[:3])

    departments = Department.objects.filter(id__in=dept_ids).select_related('institute')
    criteria = Criterion.objects.order_by('order').all()

    comparison_data = []
    radar_labels = [c.code for c in criteria]

    for dept in departments:
        evals = AuditEvaluation.objects.filter(department=dept, cycle_id=cycle_id)
        crit_pcts = []
        for c in criteria:
            c_metrics = MetricItem.objects.filter(criterion=c, is_header=False)
            c_max = sum(m.max_marks for m in c_metrics)
            c_evals = evals.filter(metric__criterion=c)
            c_obt = sum(ev.marks_obtained for ev in c_evals if ev.marks_obtained is not None)
            pct = round((c_obt / c_max) * 100, 1) if c_max > 0 else 0
            crit_pcts.append(pct)

        total_metrics = MetricItem.objects.filter(is_header=False)
        total_max = sum(m.max_marks for m in total_metrics)
        total_obt = sum(ev.marks_obtained for ev in evals if ev.marks_obtained is not None)
        overall_pct = round((total_obt / total_max) * 100, 1) if total_max > 0 else 0

        comparison_data.append({
            'department_id': dept.id,
            'label': f"{dept.institute.code} - {dept.code}",
            'overall_pct': overall_pct,
            'overall_grade': calculate_grade(overall_pct, settings) if evals.exists() else '-',
            'scores': crit_pcts,
            'grade_counts': {
                'Y': evals.filter(grade='Y').count(),
                'C': evals.filter(grade='C').count(),
                'W': evals.filter(grade='W').count(),
                'D': evals.filter(grade='D').count(),
            }
        })

    return JsonResponse({
        'radar_labels': radar_labels,
        'criteria': [{'code': c.code, 'title': c.title} for c in criteria],
        'departments': comparison_data
    })

@role_required()
def atr_list(request):
    """Listing Action Taken Reports with filters (non-admins only see their own departments)"""
    dept_id = request.GET.get('department_id')
    if dept_id and not can_view_department(request, dept_id):
        return forbidden()
    scope_ids = scoped_department_ids(request)
    cycle_id = request.GET.get('cycle_id')
    status = request.GET.get('status')
    grade = request.GET.get('grade')
    institute = request.GET.get('institute_code')
    criterion = request.GET.get('criterion_code')

    query = ActionTakenReport.objects.select_related(
        'evaluation__department', 'evaluation__metric__criterion', 'evaluation__cycle'
    )

    if scope_ids is not None:
        query = query.filter(evaluation__department_id__in=scope_ids)
    if dept_id:
        query = query.filter(evaluation__department_id=dept_id)
    if cycle_id:
        query = query.filter(evaluation__cycle_id=cycle_id)
    if status:
        query = query.filter(status=status)
    if grade:
        query = query.filter(evaluation__grade=grade)
    if institute:
        query = query.filter(evaluation__department__institute__code=institute)
    if criterion:
        query = query.filter(evaluation__metric__criterion__code=criterion)

    atrs = []
    for item in query.order_by('evaluation__department__institute__code', 'evaluation__department__code',
                               'evaluation__metric__criterion__order', 'evaluation__metric__order'):
        ev = item.evaluation
        atrs.append({
            'atr_id': item.id,
            'evaluation_id': ev.id,
            'department_id': ev.department_id,
            'department_code': ev.department.code,
            'institute_code': ev.department.institute.code,
            'criterion_code': ev.metric.criterion.code,
            'metric_code': ev.metric.code,
            'key_aspect': ev.metric.key_aspect,
            'grade': ev.grade,
            'percentage': ev.percentage,
            'marks_obtained': ev.marks_obtained,
            'max_marks': ev.metric.max_marks,
            'auditor_remarks': ev.auditor_remarks,
            'root_cause': item.root_cause,
            'action_plan': item.action_plan,
            'target_date': str(item.target_date) if item.target_date else '',
            'completed_date': str(item.completed_date) if item.completed_date else '',
            'evidence_ref': item.evidence_ref,
            'status': item.status,
            'hod_remarks': item.hod_remarks,
            'auditor_signoff': item.auditor_signoff,
            'auditor_feedback': item.auditor_feedback,
        })

    return JsonResponse({'atrs': atrs})

@csrf_exempt
@role_required()
def update_atr(request):
    """HOD fills root cause / action plan; Auditor signs off; Admin may change everything"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body.decode('utf-8'))
    atr_id = data.get('atr_id')
    eval_id = data.get('evaluation_id')

    if atr_id:
        atr = ActionTakenReport.objects.filter(id=atr_id).select_related('evaluation').first()
    elif eval_id:
        ev = AuditEvaluation.objects.filter(id=eval_id).first()
        if not ev:
            return JsonResponse({'error': 'Evaluation not found'}, status=404)
        if not can_view_department(request, ev.department_id):
            return forbidden()
        atr, _ = ActionTakenReport.objects.get_or_create(evaluation=ev)
    else:
        return JsonResponse({'error': 'atr_id or evaluation_id required'}, status=400)

    if not atr:
        return JsonResponse({'error': 'ATR not found'}, status=404)
    if not can_view_department(request, atr.evaluation.department_id):
        return forbidden()

    # Drop fields this role is not allowed to change
    if request.role == 'HOD':
        data = {k: v for k, v in data.items() if k in HOD_ATR_FIELDS}
    elif request.role == 'Auditor':
        data = {k: v for k, v in data.items() if k in AUDITOR_ATR_FIELDS}

    if 'root_cause' in data: atr.root_cause = data['root_cause']
    if 'action_plan' in data: atr.action_plan = data['action_plan']
    if 'target_date' in data: atr.target_date = data['target_date'] or None
    if 'completed_date' in data: atr.completed_date = data['completed_date'] or None
    if 'evidence_ref' in data: atr.evidence_ref = data['evidence_ref']
    if 'status' in data: atr.status = data['status']
    if 'hod_remarks' in data: atr.hod_remarks = data['hod_remarks']
    if 'auditor_signoff' in data: atr.auditor_signoff = bool(data['auditor_signoff'])
    if 'auditor_feedback' in data: atr.auditor_feedback = data['auditor_feedback']

    atr.save()
    return JsonResponse({'status': 'success', 'atr_id': atr.id, 'new_status': atr.status})

@role_required('Admin')
def assignments_list(request):
    """List auditor assignments by cycle with individual auditor criteria"""
    cycle_id = request.GET.get('cycle_id')
    cycle = AuditCycle.objects.filter(id=cycle_id).first() if cycle_id else AuditCycle.objects.filter(is_active=True).first()
    if not cycle:
        cycle = AuditCycle.objects.first()

    assignments = []
    for a in AuditAssignment.objects.filter(cycle=cycle).select_related('department__institute', 'auditor_1__user', 'auditor_2__user'):
        assignments.append({
            'id': a.id,
            'department_id': a.department_id,
            'department_code': a.department.code,
            'department_name': a.department.name,
            'institute_code': a.department.institute.code,
            'auditor_1': {
                'id': a.auditor_1.id,
                'name': a.auditor_1.name,
                'username': a.auditor_1.user.username if a.auditor_1 and a.auditor_1.user else '',
                'institute': a.auditor_1.institute.code if a.auditor_1 and a.auditor_1.institute else '',
                'dept': a.auditor_1.dept_name
            } if a.auditor_1 else None,
            'auditor_2': {
                'id': a.auditor_2.id,
                'name': a.auditor_2.name,
                'username': a.auditor_2.user.username if a.auditor_2 and a.auditor_2.user else '',
                'institute': a.auditor_2.institute.code if a.auditor_2 and a.auditor_2.institute else '',
                'dept': a.auditor_2.dept_name
            } if a.auditor_2 else None,
            'auditor_1_criteria': a.auditor_1_criteria or [],
            'auditor_2_criteria': a.auditor_2_criteria or [],
            'assigned_criteria': a.assigned_criteria or list(set((a.auditor_1_criteria or []) + (a.auditor_2_criteria or []))),
            'deployment_check': a.deployment_check,
            'digital_review_from': str(a.digital_review_from) if a.digital_review_from else '',
            'digital_review_to': str(a.digital_review_to) if a.digital_review_to else '',
            'physical_audit_date': str(a.physical_audit_date) if a.physical_audit_date else '',
            'status': a.status
        })

    return JsonResponse({
        'cycle': {'id': cycle.id if cycle else None, 'name': str(cycle) if cycle else ''},
        'assignments': assignments
    })

@csrf_exempt
@role_required('Admin')
def save_assignment(request):
    """Assign individual auditors to departments with individual criteria assignment"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body.decode('utf-8'))
    dept_id = data.get('department_id')
    cycle_id = data.get('cycle_id')
    a1_id = data.get('auditor_1_id')
    a2_id = data.get('auditor_2_id')
    a1_criteria = data.get('auditor_1_criteria', [])
    a2_criteria = data.get('auditor_2_criteria', [])
    status = data.get('status', 'Not started')

    if not dept_id or not cycle_id:
        return JsonResponse({'error': 'department_id and cycle_id required'}, status=400)

    dept = Department.objects.filter(id=dept_id).first()
    a1 = Auditor.objects.filter(id=a1_id).first() if a1_id else None
    a2 = Auditor.objects.filter(id=a2_id).first() if a2_id else None

    if not dept:
        return JsonResponse({'error': 'Department not found'}, status=404)

    # Deployment rule: auditors must not audit departments of their own college
    for label, aud in (('Auditor 1', a1), ('Auditor 2', a2)):
        if aud and aud.institute_id == dept.institute_id:
            return JsonResponse({
                'error': f"{label} ({aud.name}) belongs to {dept.institute.code} and cannot audit a {dept.institute.code} department."
            }, status=400)
    if a1 and a2 and a1.id == a2.id:
        return JsonResponse({'error': 'Auditor 1 and Auditor 2 must be different people.'}, status=400)

    check_msg = "Deployment verified"

    combined_criteria = sorted(list(set(a1_criteria + a2_criteria)))

    assign, _ = AuditAssignment.objects.update_or_create(
        department_id=dept_id,
        cycle_id=cycle_id,
        defaults={
            'auditor_1': a1,
            'auditor_2': a2,
            'auditor_1_criteria': a1_criteria,
            'auditor_2_criteria': a2_criteria,
            'assigned_criteria': combined_criteria if combined_criteria else ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'],
            'deployment_check': check_msg,
            'status': status
        }
    )

    return JsonResponse({'status': 'success', 'assignment_id': assign.id, 'check': check_msg})

@csrf_exempt
@role_required('Admin')
def add_department(request):
    """Provisions to add a new department dynamically and auto-provision HOD login"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body.decode('utf-8'))
    inst_code = data.get('institute_code')
    code = data.get('code', '').strip().upper()
    name = data.get('name', '').strip()
    hod_name = data.get('hod_name', '').strip()
    hod_email = data.get('hod_email', '').strip()

    if not inst_code or not code or not name:
        return JsonResponse({'error': 'institute_code, code, and name are required'}, status=400)

    inst = Institute.objects.filter(code=inst_code).first()
    if not inst:
        return JsonResponse({'error': f'Institute {inst_code} not found'}, status=404)

    dept, created = Department.objects.get_or_create(
        institute=inst,
        code=code,
        defaults={'name': name, 'hod_name': hod_name, 'hod_email': hod_email}
    )

    if not created:
        return JsonResponse({'error': f'Department {code} already exists in {inst_code}'}, status=400)

    # Automatically provision HOD login account & password
    hod_username, hod_password = create_or_update_hod_user(dept)

    return JsonResponse({
        'status': 'success',
        'department': {
            'id': dept.id,
            'institute_id': inst.id,
            'institute_code': inst.code,
            'code': dept.code,
            'name': dept.name,
            'hod_name': dept.hod_name,
            'hod_email': dept.hod_email,
            'hod_username': hod_username,
            'hod_initial_password': hod_password
        }
    })

@csrf_exempt
@role_required('Admin')
def add_auditor(request):
    """Register individual auditor with automatic login and password generation"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body.decode('utf-8'))
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    inst_code = data.get('institute_code', '')
    dept_name = data.get('department_name', '')
    designation = data.get('designation', '')
    experience = data.get('experience', '')

    if not name or not email:
        return JsonResponse({'error': 'name and email are required'}, status=400)

    inst = Institute.objects.filter(code=inst_code).first() if inst_code else None

    auditor = Auditor.objects.create(
        name=name,
        email=email,
        institute=inst,
        dept_name=dept_name,
        designation=designation,
        experience=experience,
        is_active=True
    )

    # Automatically provision Auditor login account and password
    username, password = create_or_update_auditor_user(auditor)

    return JsonResponse({
        'status': 'success',
        'auditor': {
            'id': auditor.id,
            'name': auditor.name,
            'username': username,
            'initial_password': password,
            'email': auditor.email,
            'institute_code': inst.code if inst else '',
            'dept_name': auditor.dept_name,
            'designation': auditor.designation,
            'experience': auditor.experience
        }
    })

@role_required('Admin')
def download_auditor_template(request):
    """Download CSV template for bulk auditor upload"""
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="Auditor_Bulk_Upload_Template.csv"'

    writer = csv.writer(response)
    writer.writerow(['Name', 'Institute', 'Department', 'Designation', 'Experience', 'Email'])
    writer.writerow(['Dr. K. Senthilkumar', 'KRCT', 'CSE', 'Professor', '10 and above', 'senthil.k@krct.ac.in'])
    writer.writerow(['Mrs. R. Preethi', 'KRCE', 'ECE', 'Associate Professor', '5 - 10 years', 'preethi.r@krce.ac.in'])
    writer.writerow(['Mr. M. Anand', 'MKCE', 'MECH', 'Assistant Professor', '3 - 5 years', 'anand.m@mkce.ac.in'])
    return response

@csrf_exempt
@role_required('Admin')
def bulk_upload_auditors(request):
    """Bulk import auditors from CSV with automatic login and password generation"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    csv_text = ''
    if 'file' in request.FILES:
        csv_file = request.FILES['file']
        csv_text = csv_file.read().decode('utf-8', errors='ignore')
    elif request.body:
        try:
            body_json = json.loads(request.body.decode('utf-8'))
            csv_text = body_json.get('csv_text', '')
        except:
            csv_text = request.body.decode('utf-8', errors='ignore')

    if not csv_text.strip():
        return JsonResponse({'error': 'No CSV content provided'}, status=400)

    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        return JsonResponse({'error': 'Empty CSV'}, status=400)

    header = [h.strip().lower() for h in rows[0]]
    imported = []
    skipped = []

    inst_cache = {inst.code: inst for inst in Institute.objects.all()}

    for row_idx, row in enumerate(rows[1:], start=2):
        if not row or not any(row): continue
        row_data = {header[i]: row[i].strip() for i in range(min(len(header), len(row)))}

        name = row_data.get('name')
        email = row_data.get('email')
        inst_code = row_data.get('institute', 'KRCT').upper()
        dept = row_data.get('department', '').upper()
        designation = row_data.get('designation', 'Assistant Professor')
        experience = row_data.get('experience', '5 - 10 years')

        if not name or not email:
            skipped.append(f"Row {row_idx}: Name and Email are required")
            continue

        inst = inst_cache.get(inst_code) or Institute.objects.filter(code=inst_code).first()

        auditor, created = Auditor.objects.get_or_create(
            email=email,
            defaults={
                'name': name,
                'institute': inst,
                'dept_name': dept,
                'designation': designation,
                'experience': experience,
                'is_active': True
            }
        )
        if not created:
            auditor.name = name
            auditor.institute = inst
            auditor.dept_name = dept
            auditor.designation = designation
            auditor.experience = experience
            auditor.save()

        # Generate automatic credentials
        username, password = create_or_update_auditor_user(auditor)

        imported.append({
            'name': auditor.name,
            'institute': inst_code,
            'department': dept,
            'email': auditor.email,
            'username': username,
            'initial_password': password
        })

    return JsonResponse({
        'status': 'success',
        'imported_count': len(imported),
        'skipped_count': len(skipped),
        'imported': imported,
        'skipped': skipped
    })

@role_required()
def export_department_excel(request):
    """Download department audit results and ATR in Excel-compatible CSV format"""
    dept_id = request.GET.get('department_id')
    cycle_id = request.GET.get('cycle_id')

    if not dept_id or not cycle_id:
        return HttpResponse("department_id and cycle_id required", status=400)
    if not can_view_department(request, dept_id):
        return forbidden()

    dept = Department.objects.select_related('institute').filter(id=dept_id).first()
    cycle = AuditCycle.objects.filter(id=cycle_id).first()
    if not dept or not cycle:
        return HttpResponse("Department or cycle not found", status=404)

    response = HttpResponse(content_type='text/csv')
    filename = f"{dept.institute.code}_{dept.code}_Academic_Audit_Report.csv"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)

    # 1. Header Information
    writer.writerow(['KRGI ACADEMIC AUDIT REPORT (NBA TIER-I ALIGNED)'])
    writer.writerow(['Institute:', dept.institute.name, f"({dept.institute.code})"])
    writer.writerow(['Department:', dept.name, f"({dept.code})"])
    writer.writerow(['Head of Department:', dept.hod_name or 'N/A', dept.hod_email or ''])
    writer.writerow(['Audit Cycle:', cycle.academic_year, cycle.semester, cycle.cycle_type])
    writer.writerow(['Export Date:', timezone.now().strftime('%d-%b-%Y %H:%M')])
    writer.writerow([])

    # 2. Section: Criterion Summary Table
    writer.writerow(['=== SECTION 1: CRITERION-WISE SUMMARY (1000 MARKS) ==='])
    writer.writerow(['Criterion Code', 'Criterion Title', 'Max Marks', 'Validated Marks', 'Percentage (%)', 'Grade', 'Y (>75%)', 'C (60-75%)', 'W (40-60%)', 'D (<40%)'])
    
    criteria = Criterion.objects.order_by('order').all()
    tot_max = 0
    tot_obt = 0
    tot_y = tot_c = tot_w = tot_d = 0
    settings = get_settings()

    for c in criteria:
        c_metrics = c.metrics.filter(is_header=False)
        m_max = sum(m.max_marks for m in c_metrics)
        evals = AuditEvaluation.objects.filter(department=dept, cycle=cycle, metric__in=c_metrics)
        m_obt = sum(e.marks_obtained for e in evals if e.marks_obtained is not None)
        pct = round((m_obt / m_max) * 100, 2) if m_max > 0 else 0
        grd = calculate_grade(pct, settings) if evals.exists() else '-'
        cy = evals.filter(grade='Y').count()
        cc = evals.filter(grade='C').count()
        cw = evals.filter(grade='W').count()
        cd = evals.filter(grade='D').count()

        writer.writerow([c.code, c.title, m_max, m_obt, pct, grd, cy, cc, cw, cd])
        tot_max += m_max
        tot_obt += m_obt
        tot_y += cy; tot_c += cc; tot_w += cw; tot_d += cd

    tot_pct = round((tot_obt / tot_max) * 100, 2) if tot_max > 0 else 0
    tot_grd = calculate_grade(tot_pct, settings)
    writer.writerow(['TOTAL', 'Overall Institutional Score', tot_max, tot_obt, tot_pct, tot_grd, tot_y, tot_c, tot_w, tot_d])
    writer.writerow([])

    # 3. Section: Detailed Metric Evaluations
    writer.writerow(['=== SECTION 2: DETAILED METRIC EVALUATIONS ==='])
    writer.writerow(['Criterion', 'Metric Code', 'Key Aspect', 'Max Marks', 'Items Checked', 'Valid Items', 'Benchmark', 'Validated Value', 'Marks Obtained', 'Percentage', 'Grade', 'Auditor Remarks', 'Evidence Status', 'Physical Check'])
    
    evals_all = AuditEvaluation.objects.filter(department=dept, cycle=cycle).select_related('metric__criterion').order_by('metric__criterion__order', 'metric__order')
    for ev in evals_all:
        m = ev.metric
        writer.writerow([
            m.criterion.code,
            m.code,
            m.key_aspect,
            m.max_marks,
            ev.items_checked or '',
            ev.valid_items or '',
            m.benchmark,
            ev.validated_value or '',
            ev.marks_obtained or '',
            f"{ev.percentage}%" if ev.percentage is not None else '',
            ev.grade,
            ev.auditor_remarks,
            ev.evidence_status,
            ev.physical_check_result
        ])
    writer.writerow([])

    # 4. Section: Action Taken Report (ATR)
    writer.writerow(['=== SECTION 3: ACTION TAKEN REPORT (ATR) - INDICATORS SCORED BELOW 60% ==='])
    writer.writerow(['Metric Code', 'Aspect', 'Score %', 'Grade', 'Root Cause Analysis', 'Corrective Action Plan', 'Target Date', 'Status', 'HOD Remarks', 'Auditor Sign-off'])
    
    atrs = ActionTakenReport.objects.filter(evaluation__department=dept, evaluation__cycle=cycle).select_related('evaluation__metric')
    for a in atrs:
        ev = a.evaluation
        writer.writerow([
            ev.metric.code,
            ev.metric.key_aspect,
            f"{ev.percentage}%",
            ev.grade,
            a.root_cause,
            a.action_plan,
            a.target_date or '',
            a.status,
            a.hod_remarks,
            'Yes' if a.auditor_signoff else 'Pending'
        ])

    return response

@role_required()
def export_department_pdf(request):
    """Download / printable formal PDF formatted report for department audit"""
    dept_id = request.GET.get('department_id')
    cycle_id = request.GET.get('cycle_id')
    if not can_view_department(request, dept_id):
        return forbidden()

    dept = Department.objects.select_related('institute').filter(id=dept_id).first()
    cycle = AuditCycle.objects.filter(id=cycle_id).first()
    if not dept or not cycle:
        return HttpResponse("Department or cycle not found", status=404)

    settings = get_settings()
    criteria = Criterion.objects.order_by('order').all()
    summary_rows = []
    tot_max = tot_obt = tot_y = tot_c = tot_w = tot_d = 0

    for c in criteria:
        c_metrics = c.metrics.filter(is_header=False)
        m_max = sum(m.max_marks for m in c_metrics)
        evals = AuditEvaluation.objects.filter(department=dept, cycle=cycle, metric__in=c_metrics)
        m_obt = sum(e.marks_obtained for e in evals if e.marks_obtained is not None)
        pct = round((m_obt / m_max) * 100, 2) if m_max > 0 else 0
        grd = calculate_grade(pct, settings) if evals.exists() else '-'
        cy = evals.filter(grade='Y').count()
        cc = evals.filter(grade='C').count()
        cw = evals.filter(grade='W').count()
        cd = evals.filter(grade='D').count()
        summary_rows.append({'code': c.code, 'title': c.title, 'max': m_max, 'obt': m_obt, 'pct': pct, 'grade': grd, 'y': cy, 'c': cc, 'w': cw, 'd': cd})
        tot_max += m_max; tot_obt += m_obt; tot_y += cy; tot_c += cc; tot_w += cw; tot_d += cd

    tot_pct = round((tot_obt / tot_max) * 100, 2) if tot_max > 0 else 0
    tot_grd = calculate_grade(tot_pct, settings)

    atrs = ActionTakenReport.objects.filter(evaluation__department=dept, evaluation__cycle=cycle).select_related('evaluation__metric__criterion')

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{dept.institute.code} - {dept.code} Academic Audit Official Report</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.4; }}
        .header {{ text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }}
        .header h1 {{ margin: 0; font-size: 24px; color: #1e1b4b; text-transform: uppercase; letter-spacing: 0.5px; }}
        .header h2 {{ margin: 6px 0; font-size: 16px; color: #4338ca; }}
        .header p {{ margin: 4px 0; font-size: 13px; color: #64748b; }}
        .meta-box {{ display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; }}
        .meta-item {{ font-size: 13px; }}
        .meta-item strong {{ color: #0f172a; }}
        .kpi-row {{ display: flex; gap: 16px; margin-bottom: 24px; }}
        .kpi-card {{ flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; background: #fff; }}
        .kpi-card .val {{ font-size: 22px; font-weight: bold; color: #4f46e5; margin-top: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }}
        th, td {{ border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }}
        th {{ background: #f1f5f9; color: #334155; font-weight: 700; }}
        .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }}
        .badge-y {{ background: #dcfce7; color: #15803d; }}
        .badge-c {{ background: #dbeafe; color: #1d4ed8; }}
        .badge-w {{ background: #fef3c7; color: #b45309; }}
        .badge-d {{ background: #fee2e2; color: #b91c1c; }}
        .signatures {{ margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }}
        .sig-box {{ width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 8px; font-size: 13px; font-weight: 600; }}
        @media print {{
            body {{ margin: 15mm; }}
            .no-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🖨️ Print / Save as PDF
        </button>
    </div>

    <div class="header">
        <h1>K. RAMAKRISHNAN GROUP OF INSTITUTIONS</h1>
        <h2>INTERNAL QUALITY ASSURANCE CELL (IQAC) - ACADEMIC AUDIT REPORT</h2>
        <p>NBA Tier-I Aligned Evaluation Framework (Criteria 1 - 9) • Academic Year: {cycle.academic_year} {cycle.semester}</p>
    </div>

    <div class="meta-box">
        <div class="meta-item"><strong>Institute:</strong> {dept.institute.code} - {dept.institute.name}</div>
        <div class="meta-item"><strong>Department:</strong> {dept.code} ({dept.name})</div>
        <div class="meta-item"><strong>Head of Dept:</strong> {dept.hod_name or 'Dr. HoD'}</div>
        <div class="meta-item"><strong>Audit Cycle:</strong> {cycle.cycle_type}</div>
    </div>

    <div class="kpi-row">
        <div class="kpi-card"><div>MAX MARKS</div><div class="val">{tot_max}</div></div>
        <div class="kpi-card"><div>VALIDATED MARKS</div><div class="val">{tot_obt}</div></div>
        <div class="kpi-card"><div>PERCENTAGE</div><div class="val" style="color: #10b981;">{tot_pct}%</div></div>
        <div class="kpi-card"><div>OVERALL GRADE</div><div class="val" style="color: #4f46e5;">{tot_grd}</div></div>
        <div class="kpi-card"><div>Y / C / W / D INDICATORS</div><div class="val" style="font-size: 16px;">{tot_y} / {tot_c} / {tot_w} / {tot_d}</div></div>
    </div>

    <h3 style="color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">1. Criterion-Wise Executive Summary (1000 Marks)</h3>
    <table>
        <thead>
            <tr>
                <th style="width: 50px;">Code</th>
                <th>Criterion Title</th>
                <th style="width: 70px; text-align: right;">Max</th>
                <th style="width: 70px; text-align: right;">Obtained</th>
                <th style="width: 60px; text-align: right;">%</th>
                <th style="width: 60px; text-align: center;">Grade</th>
                <th style="width: 40px; text-align: center;">Y</th>
                <th style="width: 40px; text-align: center;">C</th>
                <th style="width: 40px; text-align: center;">W</th>
                <th style="width: 40px; text-align: center;">D</th>
            </tr>
        </thead>
        <tbody>"""
    for r in summary_rows:
        html += f"""
            <tr>
                <td><strong>{r['code']}</strong></td>
                <td>{r['title']}</td>
                <td style="text-align: right;">{r['max']}</td>
                <td style="text-align: right; font-weight: bold;">{r['obt']}</td>
                <td style="text-align: right;">{r['pct']}%</td>
                <td style="text-align: center;"><span class="badge badge-{(r['grade'] or 'd').lower()}">{r['grade']}</span></td>
                <td style="text-align: center;">{r['y']}</td>
                <td style="text-align: center;">{r['c']}</td>
                <td style="text-align: center;">{r['w']}</td>
                <td style="text-align: center;">{r['d']}</td>
            </tr>"""
    html += f"""
            <tr style="background: #f8fafc; font-weight: bold;">
                <td colspan="2">TOTAL SCORE</td>
                <td style="text-align: right;">{tot_max}</td>
                <td style="text-align: right;">{tot_obt}</td>
                <td style="text-align: right;">{tot_pct}%</td>
                <td style="text-align: center;"><span class="badge badge-{(tot_grd or 'd').lower()}">{tot_grd}</span></td>
                <td style="text-align: center;">{tot_y}</td>
                <td style="text-align: center;">{tot_c}</td>
                <td style="text-align: center;">{tot_w}</td>
                <td style="text-align: center;">{tot_d}</td>
            </tr>
        </tbody>
    </table>

    <h3 style="color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 30px;">2. Action Taken Report (ATR) - Indicators Scored Below 60%</h3>
    <table>
        <thead>
            <tr>
                <th style="width: 70px;">Metric</th>
                <th style="min-width: 140px;">Key Aspect</th>
                <th style="width: 50px; text-align: center;">Grade</th>
                <th style="min-width: 150px;">Root Cause Analysis</th>
                <th style="min-width: 150px;">Corrective Action Plan</th>
                <th style="width: 80px;">Target Date</th>
                <th style="width: 80px; text-align: center;">Status</th>
                <th style="width: 80px; text-align: center;">Sign-off</th>
            </tr>
        </thead>
        <tbody>"""
    if atrs.exists():
        for a in atrs:
            ev = a.evaluation
            html += f"""
            <tr>
                <td><strong>{ev.metric.code}</strong></td>
                <td>{ev.metric.key_aspect}</td>
                <td style="text-align: center;"><span class="badge badge-{(ev.grade or 'd').lower()}">{ev.grade}</span> ({ev.percentage}%)</td>
                <td>{a.root_cause or 'Pending HOD analysis'}</td>
                <td>{a.action_plan or 'Pending corrective action'}</td>
                <td>{a.target_date or '-'}</td>
                <td style="text-align: center;">{a.status}</td>
                <td style="text-align: center;">{'Verified' if a.auditor_signoff else 'Pending'}</td>
            </tr>"""
    else:
        html += """<tr><td colspan="8" style="text-align: center; color: #15803d; padding: 14px;">All indicators scored at or above benchmark (60%+). No weaknesses flagged.</td></tr>"""

    html += f"""
        </tbody>
    </table>

    <div class="signatures">
        <div class="sig-box">
            Head of the Department<br>({dept.hod_name or 'Dr. HoD'})
        </div>
        <div class="sig-box">
            Lead Academic Auditor<br>(KRGI Auditor Pool)
        </div>
        <div class="sig-box">
            Director / IQAC Coordinator<br>(K. Ramakrishnan Group)
        </div>
    </div>
</body>
</html>"""

    return HttpResponse(html)
