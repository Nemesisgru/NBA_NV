import json
import io
from datetime import date, datetime
import urllib.request
import openpyxl
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import (
    QualifierInstituteConfig,
    QualifierDepartment,
    QualifierProgramMapping,
    QualifierPrimaryCheckMetrics,
    QualifierProgram,
    QualifierFacultyMember,
    QualifierChecklistItem
)
from .services import (
    init_college_defaults,
    sync_programs_from_mappings,
    recompute_all_qualifiers_for_college,
)

FACULTY_EXCEL_COLUMNS = [
    ('sno', 'S.N.'),
    ('faculty_name', 'Name of the Faculty'),
    ('pan_no', 'PAN No.'),
    ('apaar_id', 'APAAR Faculty ID (if any)'),
    ('highest_degree', 'Highest Degree'),
    ('university', 'University'),
    ('area_of_specialization', 'Area of Specialization'),
    ('date_of_joining', 'Date of Joining in this Institution (MM/DD/YYYY)'),
    ('designation_at_joining', 'Designation at Time of Joining in this Institution'),
    ('present_designation', 'Present Designation'),
    ('date_designated_prof', 'Date Designated as Professor / Associate Professor (if any)'),
    ('nature_of_association', 'Nature of Association (Regular / Contract / Adhoc)'),
    ('contractual_details', 'If Contractual, Full Time or Part Time'),
    ('currently_associated', 'Currently Associated (Y/N)'),
    ('date_of_leaving', 'Date of Leaving (if Currently Associated is No)'),
    ('experience_years', 'Experience in Years in Current Institute'),
    ('date_receiving_highest_degree', 'Date of Receiving Highest Degree (MM/DD/YYYY)'),
]


def error_response(error, default_status=400):
    status = 403 if isinstance(error, PermissionDenied) else default_status
    return JsonResponse({"status": "error", "message": str(error)}, status=status)


def serialize_primary_check(metrics):
    return {
        "approval_five_years": metrics.approval_five_years if metrics else "No",
        "approval_years_text": metrics.approval_years_text if metrics else "",
        "two_batches_passed_out": metrics.two_batches_passed_out if metrics else "Yes",
        "have_allied_department": metrics.have_allied_department if metrics else "No",
        "current_assessment_year": metrics.current_assessment_year if metrics else "",
        "years": metrics.years if metrics else ["2023-2024", "2022-2023", "2021-2022"],
        "ug1_b": metrics.ug1_b if metrics else {},
        "ug1_c": metrics.ug1_c if metrics else {},
        "ug1_d": metrics.ug1_d if metrics else {},
        "ug1_total": metrics.ug1_total if metrics else {},
        "pg_total": metrics.pg_total if metrics else {},
        "ds_students": metrics.ds_students if metrics else {},
        "as_students": metrics.as_students if metrics else {},
        "s_total": metrics.s_total if metrics else {},
        "df_faculty": metrics.df_faculty if metrics else {},
        "af_faculty": metrics.af_faculty if metrics else {},
        "f_total": metrics.f_total if metrics else {},
        "ff_first_year": metrics.ff_first_year if metrics else {},
        "sfr_calculated": metrics.sfr_calculated if metrics else {},
        "avg_sfr": metrics.avg_sfr if metrics else "#DIV/0!",
    }


def get_active_college(request, body=None):
    """Resolve and enforce the college authenticated in this browser session."""
    college_id = request.GET.get('college_id') or (body.get('college_id') if body else None)
    session_college_id = request.session.get('qualifier_college_id')
    college_id = college_id or session_college_id
    if not college_id:
        raise PermissionDenied("Select and unlock a college before accessing qualifier data.")
    if str(college_id) != str(session_college_id):
        raise PermissionDenied("Unlock this college before accessing its qualifier data.")
    college = QualifierInstituteConfig.objects.filter(id=college_id).first()
    if not college:
        raise PermissionDenied("The selected college does not exist.")
    return college


def parse_faculty_date(value):
    if not value:
        return ''
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    for date_format in ('%Y-%m-%d', '%m/%d/%Y', '%m/%d/%y'):
        try:
            return datetime.strptime(text, date_format).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Invalid date '{text}'. Use MM/DD/YYYY.")


def calculate_faculty_experience(joining_date, leaving_date='', currently_associated='Yes'):
    if not joining_date:
        return ''
    start = date.fromisoformat(joining_date)
    end = (
        date.fromisoformat(leaving_date)
        if currently_associated == 'No' and leaving_date
        else date.today()
    )
    if end < start:
        raise ValueError("Date of leaving cannot be before date of joining.")
    return f"{(end - start).days / 365.2425:.1f}"


def build_faculty_yearly_data(faculty_data):
    years = ['2023-2024', '2022-2023', '2021-2022', '2020-2021']
    joining_date = (
        date.fromisoformat(faculty_data['date_of_joining'])
        if faculty_data['date_of_joining']
        else None
    )
    leaving_date = (
        date.fromisoformat(faculty_data['date_of_leaving'])
        if faculty_data['currently_associated'] == 'No' and faculty_data['date_of_leaving']
        else date.today()
    )
    degree_date = (
        date.fromisoformat(faculty_data['date_receiving_highest_degree'])
        if faculty_data['date_receiving_highest_degree']
        else None
    )
    has_phd = 'ph' in faculty_data['highest_degree'].lower()
    association = {}
    designation = {}
    qualification = {}
    for year in years:
        start_year = int(year[:4])
        academic_start = date(start_year, 4, 1)
        academic_end = date(start_year + 1, 3, 31)
        active = bool(
            joining_date
            and joining_date <= academic_end
            and leaving_date >= academic_start
        )
        association[year] = 'Yes' if active else 'No'
        designation[year] = faculty_data['present_designation'] if active else ''
        qualification[year] = (
            'Ph. D' if has_phd and (not degree_date or degree_date <= academic_end) else 'No'
        )
    return association, designation, qualification


def serialize_college_data(college):
    """Assembles all data for the given college into JSON."""
    all_colleges = [
        {
            'id': item.id,
            'institution_name': item.institution_name,
            'institution_code': item.institution_code,
            'tier_type': item.tier_type,
            'has_password': bool(item.password_hash),
        }
        for item in QualifierInstituteConfig.objects.only(
            'id', 'institution_name', 'institution_code', 'tier_type', 'password_hash'
        )
    ]

    # Config / College info
    config_data = {
        "id": college.id,
        "institution_name": college.institution_name,
        "institution_code": college.institution_code,
        "tier_type": college.tier_type,
        "has_password": bool(college.password_hash),
        "google_sheet_url": college.google_sheet_url,
        "current_assessment_year": college.current_assessment_year,
        "approval_five_years": college.approval_five_years,
        "approval_years_text": college.approval_years_text,
        "two_batches_passed_out": college.two_batches_passed_out,
        "have_allied_department": college.have_allied_department,
        "updated_at": college.updated_at.isoformat() if college.updated_at else "",
    }

    # Checklist (Sheet 1)
    checklist_items = list(QualifierChecklistItem.objects.filter(
        college=college, department__isnull=True
    ).values(
        'id', 'sno', 'tier_type', 'qualifier_text', 'current_status',
        'compliance_status', 'hod_qualification_code', 'hod_qualification_status'
    ))

    # Departments (Sheet 2.A)
    departments = list(QualifierDepartment.objects.filter(college=college).values(
        'id', 'sno', 'department_name', 'program_classification', 'program_name',
        'inception_year', 'intake_inception', 'current_intake', 'times_accredited', 'last_accreditation_period'
    ))

    # Programs Applied for Accreditations Mapping (Sheet 2.B)
    mappings = list(QualifierProgramMapping.objects.filter(college=college).values(
        'id', 'sno', 'department_name', 'program_classification', 'master_program_name',
        'has_allied_department', 'allied_program_count',
        'allied_program_1', 'allied_program_2', 'allied_program_3', 'allied_program_4', 'allied_program_5', 'allied_program_6'
    ))

    # Primary Check & SFR (Sheet 3)
    prim = QualifierPrimaryCheckMetrics.objects.filter(
        college=college, department__isnull=True
    ).first()
    prim_data = serialize_primary_check(prim)
    department_qualifier_data = {}
    for department in QualifierDepartment.objects.filter(college=college):
        department_checklist = list(QualifierChecklistItem.objects.filter(
            college=college, department=department
        ).values(
            'id', 'sno', 'tier_type', 'qualifier_text', 'current_status',
            'compliance_status', 'hod_qualification_code', 'hod_qualification_status'
        ))
        department_metrics = QualifierPrimaryCheckMetrics.objects.filter(
            college=college, department=department
        ).first()
        if department_checklist or department_metrics:
            department_qualifier_data[str(department.id)] = {
                "checklist": department_checklist,
                "primary_check": serialize_primary_check(department_metrics),
            }

    # Programs grouped with department info
    programs_list = []
    for prog in QualifierProgram.objects.filter(college=college).prefetch_related('faculty_members'):
        faculty_list = []
        for f in prog.faculty_members.all():
            faculty_list.append({
                "id": f.id,
                "sno": f.sno,
                "faculty_name": f.faculty_name,
                "pan_no": f.pan_no,
                "apaar_id": f.apaar_id,
                "highest_degree": f.highest_degree,
                "university": f.university,
                "area_of_specialization": f.area_of_specialization,
                "date_of_joining": f.date_of_joining,
                "designation_at_joining": f.designation_at_joining,
                "present_designation": f.present_designation,
                "date_designated_prof": f.date_designated_prof,
                "nature_of_association": f.nature_of_association,
                "contractual_details": f.contractual_details,
                "currently_associated": f.currently_associated,
                "date_of_leaving": f.date_of_leaving,
                "experience_years": f.experience_years,
                "date_receiving_highest_degree": f.date_receiving_highest_degree,
                "yearly_association": f.yearly_association,
                "yearly_designation": f.yearly_designation,
                "yearly_qualification": f.yearly_qualification,
            })

        programs_list.append({
            "id": prog.id,
            "department_name": prog.department_name,
            "dept_sno": prog.dept_sno,
            "program_key": prog.program_key,
            "program_type": prog.program_type,
            "tab_title": prog.tab_title,
            "program_name": prog.program_name,
            "two_batches_passed": prog.two_batches_passed,
            "break_in_program": prog.break_in_program,
            "cay": prog.cay,
            "is_hod_doctorate": prog.is_hod_doctorate,
            "cadre_compliance_cay": prog.cadre_compliance_cay,
            "cadre_compliance_caym1": prog.cadre_compliance_caym1,
            "cadre_table": prog.cadre_table,
            "phd_table": prog.phd_table,
            "student_intake_table": prog.student_intake_table,
            "faculty_members": faculty_list,
        })

    return {
        "status": "success",
        "data": {
            "colleges_list": all_colleges,
            "config": config_data,
            "checklist": checklist_items,
            "departments": departments,
            "program_mappings": mappings,
            "primary_check": prim_data,
            "department_qualifier_data": department_qualifier_data,
            "programs": programs_list,
        }
    }


def get_colleges_list(request):
    """GET /api/qualifiers/colleges/"""
    colleges = [
        {
            'id': college.id,
            'institution_name': college.institution_name,
            'institution_code': college.institution_code,
            'tier_type': college.tier_type,
            'has_password': bool(college.password_hash),
        }
        for college in QualifierInstituteConfig.objects.only(
            'id', 'institution_name', 'institution_code', 'tier_type', 'password_hash'
        )
    ]
    return JsonResponse({"status": "success", "colleges": colleges})


@csrf_exempt
@require_http_methods(["POST"])
def create_college(request):
    """POST /api/qualifiers/colleges/create/"""
    try:
        body = json.loads(request.body.decode('utf-8'))
        name = body.get('institution_name', '').strip()
        password = body.get('password', '')
        if not name:
            return JsonResponse({"status": "error", "message": "College name is required"}, status=400)
        tier = body.get('tier_type', 'Tier 1')
        if tier not in ('Tier 1', 'Tier 2'):
            return JsonResponse({"status": "error", "message": "Choose Tier 1 or Tier 2."}, status=400)
        if len(password) < 8 or password != body.get('password_confirm'):
            return JsonResponse({"status": "error", "message": "Enter matching passwords with at least 8 characters."}, status=400)
        if QualifierInstituteConfig.objects.filter(institution_name__iexact=name).exists():
            return JsonResponse({"status": "error", "message": "A college with this name is already registered. Select it to unlock its data."}, status=409)
        code = body.get('institution_code', '')
        with transaction.atomic():
            college = QualifierInstituteConfig.objects.create(
                institution_name=name,
                institution_code=code or name[:10].upper(),
                tier_type=tier,
                password_hash=make_password(password),
                current_assessment_year=current_academic_year(),
            )
            init_college_defaults(college)
        request.session.cycle_key()
        request.session['qualifier_college_id'] = college.id
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        if isinstance(e, IntegrityError):
            return JsonResponse({"status": "error", "message": "A college with this name is already registered."}, status=409)
        return error_response(e)


def current_academic_year():
    from datetime import date

    year = date.today().year
    return f"{year}-{year + 1}"


def valid_assessment_years():
    current_year = int(current_academic_year().split('-')[0])
    return [f"{year}-{year + 1}" for year in range(current_year, current_year - 5, -1)]


@csrf_exempt
@require_http_methods(["POST"])
def access_college(request):
    """Verify a college password, or set one for a legacy college without a password."""
    try:
        body = json.loads(request.body.decode('utf-8'))
        college = QualifierInstituteConfig.objects.filter(id=body.get('college_id')).first()
        password = body.get('password', '')
        if not college:
            return JsonResponse({"status": "error", "message": "College not found."}, status=404)
        if len(password) < 8:
            return JsonResponse({"status": "error", "message": "Password must be at least 8 characters."}, status=400)
        if college.password_hash:
            if not check_password(password, college.password_hash):
                return JsonResponse({"status": "error", "message": "Incorrect password."}, status=401)
        else:
            if password != body.get('password_confirm'):
                return JsonResponse({"status": "error", "message": "Enter matching passwords."}, status=400)
            college.password_hash = make_password(password)
            college.save(update_fields=['password_hash', 'updated_at'])
        request.session.cycle_key()
        request.session['qualifier_college_id'] = college.id
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e)


def get_all_data(request):
    """GET /api/qualifiers/all/?college_id=..."""
    try:
        college = get_active_college(request)
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e, 500)


@csrf_exempt
@require_http_methods(["POST"])
def save_config(request):
    """POST /api/qualifiers/config/save/"""
    try:
        body = json.loads(request.body.decode('utf-8'))
        college = get_active_college(request, body)
        if 'institution_name' in body and body['institution_name'].strip():
            college.institution_name = body['institution_name'].strip()
        if 'institution_code' in body:
            college.institution_code = body['institution_code'].strip()
        if 'tier_type' in body:
            if body['tier_type'] != college.tier_type:
                return JsonResponse({"status": "error", "message": "Accreditation tier is locked at registration and cannot be changed."}, status=400)
        if 'google_sheet_url' in body:
            college.google_sheet_url = body['google_sheet_url']
        if 'current_assessment_year' in body:
            if body['current_assessment_year'] not in valid_assessment_years():
                return JsonResponse({"status": "error", "message": "Choose a CAY from the current academic year or the previous four years."}, status=400)
            college.current_assessment_year = body['current_assessment_year']
        if 'approval_five_years' in body:
            college.approval_five_years = body['approval_five_years']
        if 'approval_years_text' in body:
            college.approval_years_text = body['approval_years_text']
        if 'two_batches_passed_out' in body:
            college.two_batches_passed_out = body['two_batches_passed_out']
        if 'have_allied_department' in body:
            college.have_allied_department = body['have_allied_department']
        college.save()
        if 'current_assessment_year' in body:
            QualifierProgram.objects.filter(college=college).update(cay=college.current_assessment_year)
        recompute_all_qualifiers_for_college(college)
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def save_departments(request):
    """
    POST /api/qualifiers/departments/save/
    Saves 2.A Departments and 2.B Program Mappings, then dynamically synchronizes program profiles!
    """
    try:
        body = json.loads(request.body.decode('utf-8'))
        college = get_active_college(request, body)
        departments_by_sno = {
            int(department.get('sno', 1)): department
            for department in body.get('departments', [])
        }
        for mapping in body.get('program_mappings', []):
            inferred_count = sum(
                bool(str(mapping.get(f'allied_program_{index}', '')).strip())
                for index in range(1, 7)
            )
            try:
                allied_count = int(mapping.get('allied_program_count', inferred_count))
            except (TypeError, ValueError):
                return JsonResponse({"status": "error", "message": "Allied course count must be between 0 and 6."}, status=400)
            if allied_count < 0 or allied_count > 6:
                return JsonResponse({"status": "error", "message": "Allied course count must be between 0 and 6."}, status=400)
            if mapping.get('has_allied_department', 'Yes' if allied_count else 'No') not in ('Yes', 'No'):
                return JsonResponse({"status": "error", "message": "Choose whether this department has allied departments."}, status=400)

        if 'departments' in body:
            department_rows = body['departments']
            department_snos = [int(d.get('sno', 1)) for d in department_rows]
            if len(department_snos) != len(set(department_snos)):
                return JsonResponse({"status": "error", "message": "Department row numbers must be unique."}, status=400)
            for d, sno in zip(department_rows, department_snos):
                QualifierDepartment.objects.update_or_create(
                    college=college,
                    sno=sno,
                    defaults={
                        'department_name': d.get('department_name', ''),
                        'program_classification': d.get('program_classification', 'UG'),
                        'program_name': d.get('program_name', ''),
                        'inception_year': str(d.get('inception_year', '')),
                        'intake_inception': str(d.get('intake_inception', '')),
                        'current_intake': str(d.get('current_intake', '')),
                        'times_accredited': str(d.get('times_accredited', '')),
                        'last_accreditation_period': str(d.get('last_accreditation_period', '')),
                    },
                )
            QualifierDepartment.objects.filter(college=college).exclude(
                sno__in=department_snos
            ).delete()

        if 'program_mappings' in body:
            QualifierProgramMapping.objects.filter(college=college).delete()
            for m in body['program_mappings']:
                inferred_allied_count = sum(
                    bool(str(m.get(f'allied_program_{index}', '')).strip())
                    for index in range(1, 7)
                )
                allied_count = int(m.get('allied_program_count', inferred_allied_count))
                if allied_count < 0 or allied_count > 6:
                    return JsonResponse({"status": "error", "message": "Allied course count must be between 0 and 6."}, status=400)
                has_allied = m.get('has_allied_department', 'Yes' if allied_count else 'No')
                if has_allied not in ('Yes', 'No'):
                    return JsonResponse({"status": "error", "message": "Choose whether this department has allied departments."}, status=400)
                if has_allied == 'No':
                    allied_count = 0
                QualifierProgramMapping.objects.create(
                    college=college,
                    sno=m.get('sno', 1),
                    department_name=(
                        m.get('department_name')
                        or departments_by_sno.get(int(m.get('sno', 1)), {}).get('department_name', '')
                    ),
                    program_classification=m.get('program_classification', 'UG'),
                    master_program_name=(
                        m.get('master_program_name')
                        or departments_by_sno.get(int(m.get('sno', 1)), {}).get('department_name', '')
                    ),
                    has_allied_department=has_allied,
                    allied_program_count=allied_count,
                    allied_program_1=m.get('allied_program_1', '') if allied_count >= 1 else '',
                    allied_program_2=m.get('allied_program_2', '') if allied_count >= 2 else '',
                    allied_program_3=m.get('allied_program_3', '') if allied_count >= 3 else '',
                    allied_program_4=m.get('allied_program_4', '') if allied_count >= 4 else '',
                    allied_program_5=m.get('allied_program_5', '') if allied_count >= 5 else '',
                    allied_program_6=m.get('allied_program_6', '') if allied_count >= 6 else '',
                )

        # Dynamic program synchronization based on 2.B!
        sync_programs_from_mappings(college)

        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def save_primary_check(request):
    """POST /api/qualifiers/primary-check/save/"""
    try:
        body = json.loads(request.body.decode('utf-8'))
        college = get_active_college(request, body)
        department_id = body.get('department_id')
        department = None
        if department_id:
            department = QualifierDepartment.objects.filter(
                id=department_id, college=college
            ).first()
            if not department:
                return JsonResponse({"status": "error", "message": "Department not found for this college."}, status=404)
        metrics, _ = QualifierPrimaryCheckMetrics.objects.get_or_create(
            college=college,
            department=department,
        )
        for field in [
            'approval_five_years', 'approval_years_text', 'two_batches_passed_out',
            'have_allied_department', 'current_assessment_year',
            'years', 'ug1_b', 'ug1_c', 'ug1_d', 'ug1_total', 'pg_total',
            'ds_students', 'as_students', 's_total', 'df_faculty', 'af_faculty',
            'f_total', 'ff_first_year'
        ]:
            if field in body:
                setattr(metrics, field, body[field])
        metrics.save()
        if department:
            program_updates = {}
            if 'two_batches_passed_out' in body:
                program_updates['two_batches_passed'] = body['two_batches_passed_out']
            if 'current_assessment_year' in body:
                program_updates['cay'] = body['current_assessment_year']
            if program_updates:
                QualifierProgram.objects.filter(
                    college=college,
                    dept_sno=department.sno,
                    program_type='master',
                ).update(**program_updates)
        recompute_all_qualifiers_for_college(college)
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def save_faculty_member(request):
    """POST /api/qualifiers/faculty/save/"""
    try:
        body = json.loads(request.body.decode('utf-8'))
        college = get_active_college(request, body)
        program_key = body.get('program_key')
        prog = QualifierProgram.objects.filter(college=college, program_key=program_key).first()
        if not prog:
            return JsonResponse({"status": "error", "message": f"Program {program_key} not found for this college"}, status=404)

        member_id = body.get('id')
        if member_id:
            member = QualifierFacultyMember.objects.filter(id=member_id, program=prog).first()
            if not member:
                return JsonResponse({"status": "error", "message": "Faculty member not found"}, status=404)
        else:
            max_sno = prog.faculty_members.count() + 1
            member = QualifierFacultyMember(program=prog, sno=max_sno)

        normalized_dates = {}
        for field in (
            'date_of_joining',
            'date_designated_prof',
            'date_of_leaving',
            'date_receiving_highest_degree',
        ):
            normalized_dates[field] = parse_faculty_date(
                body.get(field, getattr(member, field))
            )
            if field in body:
                body[field] = normalized_dates[field]
        body['experience_years'] = calculate_faculty_experience(
            normalized_dates['date_of_joining'],
            normalized_dates['date_of_leaving'],
            body.get('currently_associated', member.currently_associated),
        )

        for field in [
            'sno', 'faculty_name', 'pan_no', 'apaar_id', 'highest_degree',
            'university', 'area_of_specialization', 'date_of_joining',
            'designation_at_joining', 'present_designation', 'date_designated_prof',
            'nature_of_association', 'contractual_details', 'currently_associated',
            'date_of_leaving', 'experience_years', 'date_receiving_highest_degree',
            'yearly_association', 'yearly_designation', 'yearly_qualification'
        ]:
            if field in body:
                setattr(member, field, body[field])
        member.save()

        recompute_all_qualifiers_for_college(college)
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e)


@require_http_methods(["GET"])
def download_faculty_template(request):
    """Download a workbook containing only the selected program's faculty roster headers."""
    try:
        college = get_active_college(request)
        program_key = request.GET.get('program_key')
        program = QualifierProgram.objects.filter(
            college=college, program_key=program_key
        ).first()
        if not program:
            return JsonResponse(
                {"status": "error", "message": "Program not found for this college"},
                status=404,
            )

        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Faculty Roster"
        sheet.append([label for _, label in FACULTY_EXCEL_COLUMNS])
        for cell in sheet[1]:
            cell.font = openpyxl.styles.Font(bold=True, color="FFFFFF")
            cell.fill = openpyxl.styles.PatternFill("solid", fgColor="1F4E78")
        for row_number in range(2, 102):
            sheet.cell(row=row_number, column=16).value = (
                f'=IF(H{row_number}="","",ROUND(('
                f'IF(AND(N{row_number}="No",O{row_number}<>""),O{row_number},TODAY())'
                f'-H{row_number})/365.2425,1))'
            )
        for column_number in (8, 11, 15, 17):
            for row_number in range(2, 102):
                sheet.cell(row=row_number, column=column_number).number_format = "mm/dd/yyyy"
        for column_number, (_, label) in enumerate(FACULTY_EXCEL_COLUMNS, start=1):
            sheet.column_dimensions[openpyxl.utils.get_column_letter(column_number)].width = min(
                max(len(label) + 2, 16), 42
            )

        output = io.BytesIO()
        workbook.save(output)
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="faculty-roster-template-{program.program_key}.xlsx"'
        )
        return response
    except Exception as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def upload_faculty_roster(request):
    """Import faculty rows from a roster-only Excel workbook for one program."""
    try:
        college = get_active_college(request, request.POST)
        program_key = request.POST.get('program_key')
        program = QualifierProgram.objects.filter(
            college=college, program_key=program_key
        ).first()
        if not program:
            return JsonResponse(
                {"status": "error", "message": "Program not found for this college"},
                status=404,
            )
        upload = request.FILES.get('file')
        if not upload:
            return JsonResponse({"status": "error", "message": "Select an Excel file to upload."}, status=400)
        if upload.size > 10 * 1024 * 1024:
            return JsonResponse({"status": "error", "message": "Excel file must be 10 MB or smaller."}, status=400)

        workbook = openpyxl.load_workbook(upload, read_only=True, data_only=True)
        sheet = workbook.active
        header_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), None)
        expected_headers = [label for _, label in FACULTY_EXCEL_COLUMNS]
        if not header_row or [str(value or '').strip() for value in header_row] != expected_headers:
            return JsonResponse(
                {"status": "error", "message": "The workbook headers do not match the faculty roster template."},
                status=400,
            )

        imported_rows = []
        for row_number, values in enumerate(
            sheet.iter_rows(min_row=2, max_col=len(FACULTY_EXCEL_COLUMNS), values_only=True),
            start=2,
        ):
            if all(value is None or str(value).strip() == '' for value in values):
                continue
            row_data = {
                field: value
                for (field, _), value in zip(FACULTY_EXCEL_COLUMNS, values)
            }
            row_data = {
                field: (str(value).strip() if value is not None else '')
                for field, value in row_data.items()
                if field not in {
                    'date_of_joining',
                    'date_designated_prof',
                    'date_of_leaving',
                    'date_receiving_highest_degree',
                    'experience_years',
                    'sno',
                }
            }
            if not row_data.get('faculty_name'):
                return JsonResponse(
                    {"status": "error", "message": f"Faculty name is required on row {row_number}."},
                    status=400,
                )
            try:
                for field in (
                    'date_of_joining',
                    'date_designated_prof',
                    'date_of_leaving',
                    'date_receiving_highest_degree',
                ):
                    value = values[[column for column, (key, _) in enumerate(FACULTY_EXCEL_COLUMNS) if key == field][0]]
                    row_data[field] = parse_faculty_date(value)
                associated = row_data.get('currently_associated') or 'Yes'
                if associated not in ('Yes', 'No'):
                    raise ValueError("Currently Associated must be Yes or No.")
                row_data['currently_associated'] = associated
                row_data['nature_of_association'] = row_data.get('nature_of_association') or 'Regular'
                row_data['present_designation'] = row_data.get('present_designation') or 'Assistant Professor'
                row_data['designation_at_joining'] = row_data.get('designation_at_joining') or 'Assistant Professor'
                row_data['highest_degree'] = row_data.get('highest_degree') or ''
                row_data['contractual_details'] = row_data.get('contractual_details') or ''
                row_data['experience_years'] = calculate_faculty_experience(
                    row_data['date_of_joining'],
                    row_data['date_of_leaving'],
                    associated,
                )
            except ValueError as error:
                return JsonResponse(
                    {"status": "error", "message": f"Invalid data on row {row_number}: {error}"},
                    status=400,
                )

            imported_rows.append(row_data)
            if len(imported_rows) > 5000:
                return JsonResponse(
                    {"status": "error", "message": "A single upload cannot contain more than 5,000 faculty rows."},
                    status=400,
                )

        if not imported_rows:
            return JsonResponse({"status": "error", "message": "The workbook contains no faculty rows."}, status=400)

        max_sno = program.faculty_members.order_by('-sno').values_list('sno', flat=True).first() or 0
        faculty_members = []
        for index, row_data in enumerate(imported_rows, start=1):
            yearly_association, yearly_designation, yearly_qualification = (
                build_faculty_yearly_data(row_data)
            )
            faculty_members.append(QualifierFacultyMember(
                program=program,
                sno=max_sno + index,
                **row_data,
                yearly_association=yearly_association,
                yearly_designation=yearly_designation,
                yearly_qualification=yearly_qualification,
            ))
        with transaction.atomic():
            QualifierFacultyMember.objects.bulk_create(faculty_members)
            recompute_all_qualifiers_for_college(college)
        return JsonResponse({
            "status": "success",
            "message": f"Imported {len(faculty_members)} faculty members.",
            "data": serialize_college_data(college),
        })
    except Exception as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def delete_faculty_member(request):
    """POST /api/qualifiers/faculty/delete/"""
    try:
        body = json.loads(request.body.decode('utf-8'))
        college = get_active_college(request, body)
        member_id = body.get('id')
        if not member_id:
            return JsonResponse({"status": "error", "message": "Missing member id"}, status=400)
        QualifierFacultyMember.objects.filter(id=member_id, program__college=college).delete()
        recompute_all_qualifiers_for_college(college)
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def save_program_profile(request):
    """POST /api/qualifiers/program-profile/save/"""
    try:
        body = json.loads(request.body.decode('utf-8'))
        college = get_active_college(request, body)
        program_key = body.get('program_key')
        prog = QualifierProgram.objects.filter(college=college, program_key=program_key).first()
        if not prog:
            return JsonResponse({"status": "error", "message": f"Program {program_key} not found"}, status=404)

        if 'program_name' in body:
            prog.program_name = body['program_name']
        if 'two_batches_passed' in body:
            prog.two_batches_passed = body['two_batches_passed']
        if 'break_in_program' in body:
            prog.break_in_program = body['break_in_program']
        if 'student_intake_table' in body:
            prog.student_intake_table = body['student_intake_table']
        prog.save()

        recompute_all_qualifiers_for_college(college)
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def sync_google_sheet(request):
    """POST /api/qualifiers/sync-google-sheet/"""
    try:
        college = get_active_college(request)
        sync_programs_from_mappings(college)
        recompute_all_qualifiers_for_college(college)
        return JsonResponse(serialize_college_data(college))
    except Exception as e:
        return error_response(e, 500)


def export_excel(request):
    """GET /api/qualifiers/export-excel/?college_id=..."""
    try:
        college = get_active_college(request)
        wb = openpyxl.Workbook()
        wb.remove(wb.active)

        # Tab 1: Checklist
        ws_chk = wb.create_sheet(title="1.Check List Complaince")
        ws_chk.append(["S.N.", "Pre-Visit Qualifiers", "Current Status", "Compliance Status", "", "HOD Qualification", "", "Check List"])
        for item in QualifierChecklistItem.objects.filter(college=college):
            ws_chk.append([
                item.sno, item.qualifier_text, item.current_status, item.compliance_status,
                "", item.hod_qualification_code, item.hod_qualification_status, item.tier_type
            ])

        # Tab 2: Departments
        ws_dep = wb.create_sheet(title="2.Departments")
        ws_dep.append(["Name of the Institution", college.institution_name])
        ws_dep.append(["Is the Institute Tier 1 or Tier 2", "", college.tier_type])
        ws_dep.append([])
        ws_dep.append(["S.No", "Name of the Department", "Program Classification", "Program Name", "Inception Year", "Intake during Inception", "Current Intake", "Times Accredited", "Last Period"])
        for d in QualifierDepartment.objects.filter(college=college):
            ws_dep.append([
                d.sno, d.department_name, d.program_classification, d.program_name,
                d.inception_year, d.intake_inception, d.current_intake, d.times_accredited, d.last_accreditation_period
            ])
        ws_dep.append([])
        ws_dep.append(["Program Applied for Accreditations"])
        mappings = list(QualifierProgramMapping.objects.filter(college=college))
        max_allied_count = max((mapping.allied_program_count for mapping in mappings), default=0)
        ws_dep.append([
            "S.No", "Department Name", "Class", "Master Program",
            "3. Does the Programme have allied Departments?", "Number of allied courses",
            *[f"Allied Course {index}" for index in range(1, max_allied_count + 1)],
        ])
        for m in mappings:
            ws_dep.append([
                m.sno, m.department_name, m.program_classification, m.master_program_name,
                m.has_allied_department, m.allied_program_count,
                *[
                    getattr(m, f"allied_program_{index}") if index <= m.allied_program_count else ""
                    for index in range(1, max_allied_count + 1)
                ],
            ])

        # Tab 3: Primary Check
        ws_pri = wb.create_sheet(title="3.Primary Check")
        ws_pri.append(["Parameter", "Status / Value", "Notes"])
        ws_pri.append(["Approval Competent Authority", college.approval_five_years, college.approval_years_text])
        ws_pri.append(["Two Batches Passed", college.two_batches_passed_out])
        ws_pri.append(["Allied Department", college.have_allied_department])
        ws_pri.append(["Current Assessment Year", college.current_assessment_year])
        ws_pri.append([])
        prim = QualifierPrimaryCheckMetrics.objects.filter(college=college).first()
        ws_pri.append(["Metric", "2023-2024", "2022-2023", "2021-2022"])
        if prim:
            for lbl, dic in [
                ("UG1", prim.ug1_total),
                ("PG", prim.pg_total),
                ("DS (Students in Dept)", prim.ds_students),
                ("AS (Students in Allied)", prim.as_students),
                ("S (Total Students = DS + AS)", prim.s_total),
                ("DF (Faculty in Dept)", prim.df_faculty),
                ("AF (Faculty in Allied)", prim.af_faculty),
                ("F (Total Faculty = DF + AF)", prim.f_total),
                ("FF (First Year 100% Load)", prim.ff_first_year),
                ("SFR = S / (F - FF)", prim.sfr_calculated),
            ]:
                ws_pri.append([lbl, dic.get('2023-2024', 0), dic.get('2022-2023', 0), dic.get('2021-2022', 0)])
            ws_pri.append(["Average SFR for 3 years", prim.avg_sfr])

        # Program Tabs
        for prog in QualifierProgram.objects.filter(college=college):
            sheet_title = f"{prog.dept_sno}-{prog.program_name}"[:30]
            ws_p = wb.create_sheet(title=sheet_title)
            ws_p.append(["Department", prog.department_name, "Program", prog.program_name])
            ws_p.append(["Two batches passed", prog.two_batches_passed, "CAY", prog.cay])
            ws_p.append([])
            ws_p.append([
                "S.N.", "Name of the Faculty", "PAN No.", "APAAR Faculty ID (if any)",
                "Highest Degree", "University", "Area of Specialization",
                "Date of Joining in this Institution (MM/DD/YYYY)",
                "Designation at Time of Joining in this Institution", "Present Designation",
                "Date Designated as Professor / Associate Professor (if any)",
                "Nature of Association (Regular / Contract / Adhoc)",
                "If Contractual, Full Time or Part Time", "Currently Associated (Y/N)",
                "Date of Leaving (if Currently Associated is No)",
                "Experience in Years in Current Institute",
                "Date of Receiving Highest Degree (MM/DD/YYYY)"
            ])
            for f in prog.faculty_members.all():
                ws_p.append([
                    f.sno, f.faculty_name, f.pan_no, f.apaar_id, f.highest_degree, f.university,
                    f.area_of_specialization, f.date_of_joining, f.designation_at_joining, f.present_designation,
                    f.date_designated_prof, f.nature_of_association, f.contractual_details, f.currently_associated,
                    f.date_of_leaving, f.experience_years, f.date_receiving_highest_degree
                ])

        scoped_checklist = QualifierChecklistItem.objects.filter(
            college=college, department__isnull=False
        ).select_related('department').order_by(
            'department__sno', 'tier_type', 'sno'
        )
        if scoped_checklist.exists():
            ws_dept_checklist = wb.create_sheet(title="Department Checklists")
            ws_dept_checklist.append([
                "Department", "S.N.", "Tier", "Pre-Visit Qualifier",
                "Current Status", "Compliance Status", "HOD Qualification",
                "HOD Qualification Status",
            ])
            for item in scoped_checklist:
                ws_dept_checklist.append([
                    item.department.department_name, item.sno, item.tier_type,
                    item.qualifier_text, item.current_status, item.compliance_status,
                    item.hod_qualification_code, item.hod_qualification_status,
                ])

        scoped_metrics = QualifierPrimaryCheckMetrics.objects.filter(
            college=college, department__isnull=False
        ).select_related('department').order_by('department__sno')
        if scoped_metrics.exists():
            ws_dept_primary = wb.create_sheet(title="Dept Primary Check")
            ws_dept_primary.append(["Department", "Parameter", "Academic Year", "Value"])
            metric_labels = [
                ('ug1_b', 'UG1, B'),
                ('ug1_c', 'UG1, C'),
                ('ug1_d', 'UG1, D'),
                ('ug1_total', 'UG1 Total'),
                ('pg_total', 'PG Total'),
                ('ds_students', 'DS - Students in Department'),
                ('as_students', 'AS - Students in Allied Departments'),
                ('s_total', 'S - Total Students'),
                ('df_faculty', 'DF - Faculty in Department'),
                ('af_faculty', 'AF - Faculty in Allied Departments'),
                ('f_total', 'F - Total Faculty'),
                ('ff_first_year', 'FF - First-Year Faculty'),
                ('sfr_calculated', 'Student Faculty Ratio'),
            ]
            for metrics in scoped_metrics:
                department_name = metrics.department.department_name
                metadata = [
                    ('Approval of Competent Authority', metrics.approval_five_years),
                    ('Approved Academic Years', metrics.approval_years_text),
                    ('Two Batches Passed', metrics.two_batches_passed_out),
                    ('Allied Department', metrics.have_allied_department),
                    ('Current Assessment Year', metrics.current_assessment_year),
                    ('Average SFR', metrics.avg_sfr),
                ]
                for label, value in metadata:
                    ws_dept_primary.append([department_name, label, "", value])
                for field, label in metric_labels:
                    values = getattr(metrics, field)
                    for year in metrics.years:
                        ws_dept_primary.append([
                            department_name, label, year, values.get(year, "")
                        ])

        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)
        filename = f"NBA_Qualifiers_{college.institution_code or 'Export'}.xlsx"
        response = HttpResponse(bio.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        return error_response(e, 500)
