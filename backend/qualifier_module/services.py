import openpyxl
import os
from pathlib import Path
from django.conf import settings
from .models import (
    QualifierInstituteConfig,
    QualifierDepartment,
    QualifierProgramMapping,
    QualifierPrimaryCheckMetrics,
    QualifierProgram,
    QualifierFacultyMember,
    QualifierChecklistItem
)


def get_or_create_college(college_name="K. Ramakrishnan College of Technology", tier_type="Tier 1", code=""):
    """
    Finds or initializes a college profile with all default qualifier structures.
    """
    cleaned_name = college_name.strip()
    college, created = QualifierInstituteConfig.objects.get_or_create(
        institution_name=cleaned_name,
        defaults={
            "institution_code": code or cleaned_name[:10].upper(),
            "tier_type": tier_type or "Tier 1",
            "google_sheet_url": "https://docs.google.com/spreadsheets/d/1CRPySQV9K3hzANJWNo81o81OI0tWFI3t2PmNL_exQAo/edit?usp=sharing",
        }
    )

    # If new college, initialize with default structures: 2 default department rows, default mapping, primary check, checklist
    if created or college.departments.count() == 0:
        init_college_defaults(college)

    return college


def init_college_defaults(college):
    """
    Sets up default tables for a college:
    - 2 default rows for 2.A Departments: 'inside department tab default rows can be 2 on opening'
    - 2 blank 2.B mapping rows, ready for master and allied program names
    - Primary check & SFR defaults
    - Checklist items (Tier 1 & Tier 2)
    """
    # 1. Departments 2.A (2 default rows)
    QualifierDepartment.objects.filter(college=college).delete()
    for sno in (1, 2):
        QualifierDepartment.objects.create(college=college, sno=sno)

    # 2. Programs Applied for Accreditations Mapping (2.B)
    QualifierProgramMapping.objects.filter(college=college).delete()
    for sno in (1, 2):
        QualifierProgramMapping.objects.create(college=college, sno=sno)

    # 3. Primary Check & SFR
    metrics, _ = QualifierPrimaryCheckMetrics.objects.get_or_create(college=college)
    years = ["2023-2024", "2022-2023", "2021-2022"]
    metrics.years = years
    metrics.ug1_b = {"2023-2024": 180, "2022-2023": 180, "2021-2022": 180}
    metrics.ug1_c = {"2023-2024": 18, "2022-2023": 18, "2021-2022": 18}
    metrics.ug1_d = {"2023-2024": 0, "2022-2023": 0, "2021-2022": 0}
    metrics.ug1_total = {"2023-2024": 198, "2022-2023": 198, "2021-2022": 198}
    metrics.pg_total = {"2023-2024": 18, "2022-2023": 18, "2021-2022": 18}
    metrics.ds_students = {"2023-2024": 558, "2022-2023": 558, "2021-2022": 558}
    metrics.as_students = {"2023-2024": 0, "2022-2023": 0, "2021-2022": 0}
    metrics.s_total = {"2023-2024": 558, "2022-2023": 558, "2021-2022": 558}
    metrics.df_faculty = {"2023-2024": 28, "2022-2023": 28, "2021-2022": 28}
    metrics.af_faculty = {"2023-2024": 0, "2022-2023": 0, "2021-2022": 0}
    metrics.f_total = {"2023-2024": 28, "2022-2023": 28, "2021-2022": 28}
    metrics.ff_first_year = {"2023-2024": 0, "2022-2023": 0, "2021-2022": 0}
    metrics.sfr_calculated = {"2023-2024": 19.93, "2022-2023": 19.93, "2021-2022": 19.93}
    metrics.avg_sfr = "19.93"
    metrics.save()

    # 4. Checklist Items (Tier 1 & Tier 2)
    init_checklist_items(college)

    # 5. Sync Programs from 2.B mapping
    sync_programs_from_mappings(college)


def init_checklist_items(college):
    QualifierChecklistItem.objects.filter(college=college).delete()
    tier1_texts = [
        "Whether approval of the competent authority (Approval of AICTE/UGC/BoG of Universities/ Deemed Universities etc.) for the program under consideration has been obtained for all the years including current academic year",
        "Whether the Student Faculty Ratio (SFR) in the Department and allied Departments is less than or equal to 25:1, averaged over three academic years: Current Academic Year (CAY), Current Academic Year Minus One (CAYm1), and Current Academic Year Minus Two (CAYm2)",
        "Case 1: If the Department/School is not running multiple UG (Engineering) programs and does not have allied departments, which are running undergraduate engineering programs, then the program under consideration needs either 2 Professors or 1 Professor and 1 Associate Professor on a regular basis with Ph.D. degree in the current academic year (CAY) and the previous academic year (CAYm1).\nCase 2: If the Department/School, including allied departments, is running multiple UG (Engineering) programs, the program under consideration needs either 2 Professors or 1 Professor and 1 Associate Professor on a regular basis with Ph.D. degree in CAY and CAYm1. Additionally, the remaining UG (Engineering) programs (N*) need 'N' Professors or 'N' Associate Professors in the Department/ School/ Allied departments on a regular basis with Ph.D. degree in CAY and CAYm1 in total.",
        "Whether the number of faculty having Ph. D degree available in the Department & allied Departments is greater than or equal to 20% of the required number of faculty averaged over two academic years i.e. Current Academic Year (CAY) and Current Academic Year Minus One (CAYm1)",
        "Whether two batches have passed out in the program under consideration",
        "Whether the HOD of the department in which the program under consideration is running is appointed on regular basis and possesses PhD degree in the Current Academic Year (CAY)."
    ]
    for idx, text in enumerate(tier1_texts, 1):
        QualifierChecklistItem.objects.create(
            college=college,
            sno=idx,
            tier_type="Tier 1",
            qualifier_text=text,
            current_status="Complied" if idx in [2, 5] else "Not Approved" if idx == 1 else "No",
            compliance_status="Complied" if idx in [2, 5] else "Not Complied",
            hod_qualification_code=f"AL{idx}" if idx > 1 else "MP",
            hod_qualification_status="No"
        )

    for idx, text in enumerate(tier1_texts, 1):
        QualifierChecklistItem.objects.create(
            college=college,
            sno=idx,
            tier_type="Tier 2",
            qualifier_text=text,
            current_status="Complied" if idx in [2, 5] else "Not Approved" if idx == 1 else "No",
            compliance_status="Complied" if idx in [2, 5] else "Not Complied",
            hod_qualification_code=f"AL{idx}" if idx > 1 else "MP",
            hod_qualification_status="No"
        )


def sync_programs_from_mappings(college):
    """
    Synchronizes program profiles based on 2.B Programs Applied for Accreditation Mapping.
    Allied programs are dynamically created ONLY according to non-empty allied program entries in 2.B.
    """
    mappings = QualifierProgramMapping.objects.filter(college=college)
    valid_keys = set()

    years = ['2023-2024', '2022-2023', '2021-2022', '2020-2021']

    for m in mappings:
        dept_name = m.department_name or f"Department {m.sno}"
        
        # 1. Master Program
        if m.master_program_name:
            m_key = f"dept_{m.sno}_master"
            valid_keys.add(m_key)
            prog, _ = QualifierProgram.objects.get_or_create(
                college=college,
                program_key=m_key,
                defaults={
                    "department_name": dept_name,
                    "dept_sno": m.sno,
                    "program_type": "master",
                    "tab_title": f"Master: {m.master_program_name}",
                    "program_name": m.master_program_name,
                }
            )
            prog.department_name = dept_name
            prog.dept_sno = m.sno
            prog.cay = college.current_assessment_year
            prog.tab_title = f"Master: {m.master_program_name}"
            prog.program_name = m.master_program_name
            prog.save()
            ensure_program_sample_data(prog, m.master_program_name)

        # 2. Allied Programs 1 to 6 (Only created if non-empty!)
        allied_fields = [
            (idx, getattr(m, f'allied_program_{idx}'))
            for idx in range(1, min(m.allied_program_count, 6) + 1)
        ] if m.has_allied_department == 'Yes' else []

        for allied_idx, allied_val in allied_fields:
            if allied_val and allied_val.strip():
                a_key = f"dept_{m.sno}_allied_{allied_idx}"
                valid_keys.add(a_key)
                a_name = allied_val.strip()
                a_prog, _ = QualifierProgram.objects.get_or_create(
                    college=college,
                    program_key=a_key,
                    defaults={
                        "department_name": dept_name,
                        "dept_sno": m.sno,
                        "program_type": f"allied_{allied_idx}",
                        "tab_title": f"Allied {allied_idx}: {a_name}",
                        "program_name": a_name,
                    }
                )
                a_prog.department_name = dept_name
                a_prog.dept_sno = m.sno
                a_prog.cay = college.current_assessment_year
                a_prog.tab_title = f"Allied {allied_idx}: {a_name}"
                a_prog.program_name = a_name
                a_prog.save()
                ensure_program_sample_data(a_prog, a_name)

    # Remove any orphan programs for this college that are no longer in 2.B
    QualifierProgram.objects.filter(college=college).exclude(program_key__in=valid_keys).delete()

    recompute_all_qualifiers_for_college(college)


def ensure_program_sample_data(prog, default_name):
    """
    Initializes default Cadre table, PhD table, Student intake, and faculty roster if empty.
    """
    if not prog.cadre_table:
        prog.cadre_table = [
            {"label": "CAY", "year": "2023-2024", "professors": 2, "associate_professors": 4, "assistant_professors": 22, "total_faculty": 28},
            {"label": "CAY m1", "year": "2022-2023", "professors": 2, "associate_professors": 4, "assistant_professors": 22, "total_faculty": 28},
            {"label": "CAYm2", "year": "2021-2022", "professors": 2, "associate_professors": 4, "assistant_professors": 22, "total_faculty": 28},
            {"label": "CAYm3", "year": "2020-2021", "professors": 2, "associate_professors": 4, "assistant_professors": 22, "total_faculty": 28},
        ]
    if not prog.phd_table:
        prog.phd_table = [
            {"label": "CAY", "year": "2023-2024", "phd": 8, "non_phd": 20, "total_faculty": 28, "phd_percentage": "28.6%"},
            {"label": "CAY m1", "year": "2022-2023", "phd": 7, "non_phd": 21, "total_faculty": 28, "phd_percentage": "25.0%"},
            {"label": "CAYm2", "year": "2021-2022", "phd": 6, "non_phd": 22, "total_faculty": 28, "phd_percentage": "21.4%"},
            {"label": "CAYm3", "year": "2020-2021", "phd": 6, "non_phd": 22, "total_faculty": 28, "phd_percentage": "21.4%"},
        ]
    if not prog.student_intake_table:
        prog.student_intake_table = [
            {"description": "UG1, B", "cay": 180, "cay_m1": 180, "cay_m2": 180},
            {"description": "UG1, C", "cay": 18, "cay_m1": 18, "cay_m2": 18},
            {"description": "UG1, D", "cay": 0, "cay_m1": 0, "cay_m2": 0},
            {"description": "UG1 Total", "cay": 198, "cay_m1": 198, "cay_m2": 198},
            {"description": "PG (1.. n)", "cay": 18, "cay_m1": 18, "cay_m2": 18},
            {"description": "DS = Total students in Dept", "cay": 558, "cay_m1": 558, "cay_m2": 558},
        ]
    prog.save()

    if prog.faculty_members.count() == 0:
        # Seed 2 sample faculty members so the table isn't completely empty
        QualifierFacultyMember.objects.create(
            program=prog,
            sno=1,
            faculty_name=f"Dr. Faculty Lead ({prog.program_name})",
            pan_no="ABCDE1234F",
            apaar_id="AP-90123",
            highest_degree="Ph. D",
            university="Anna University",
            area_of_specialization="Computer Systems & Intelligence",
            date_of_joining="06/15/2015",
            designation_at_joining="Assistant Professor",
            present_designation="Professor & HOD",
            date_designated_prof="07/01/2021",
            nature_of_association="Regular",
            currently_associated="Yes",
            experience_years="9.2",
            date_receiving_highest_degree="05/20/2014",
            yearly_association={"2023-2024": "Yes", "2022-2023": "Yes", "2021-2022": "Yes", "2020-2021": "Yes"},
            yearly_designation={"2023-2024": "Professor", "2022-2023": "Professor", "2021-2022": "Associate Professor", "2020-2021": "Associate Professor"},
            yearly_qualification={"2023-2024": "Ph. D", "2022-2023": "Ph. D", "2021-2022": "Ph. D", "2020-2021": "Ph. D"},
        )
        QualifierFacultyMember.objects.create(
            program=prog,
            sno=2,
            faculty_name="Prof. Senior Associate",
            pan_no="BCDEF5678G",
            apaar_id="AP-90124",
            highest_degree="M.Tech. and Ph. D",
            university="NIT Trichy",
            area_of_specialization="Algorithms & Machine Learning",
            date_of_joining="07/10/2018",
            designation_at_joining="Assistant Professor",
            present_designation="Associate Professor",
            date_designated_prof="08/01/2022",
            nature_of_association="Regular",
            currently_associated="Yes",
            experience_years="6.1",
            date_receiving_highest_degree="11/15/2019",
            yearly_association={"2023-2024": "Yes", "2022-2023": "Yes", "2021-2022": "Yes", "2020-2021": "Yes"},
            yearly_designation={"2023-2024": "Associate Professor", "2022-2023": "Associate Professor", "2021-2022": "Assistant Professor", "2020-2021": "Assistant Professor"},
            yearly_qualification={"2023-2024": "Ph. D", "2022-2023": "Ph. D", "2021-2022": "Ph. D", "2020-2021": "No"},
        )


def recompute_all_qualifiers_for_college(college):
    """
    Computes all live metrics for a specific college:
    - Master & Allied Program Cadre tables
    - Master & Allied Program PhD counts and percentages
    - Overall SFR calculation and 3-year average
    - Checklist compliance status for Tier 1 & Tier 2
    """
    if not college:
        return

    all_programs = QualifierProgram.objects.filter(college=college)

    for prog in all_programs:
        members = prog.faculty_members.all()
        hod_phd = False
        for m in members:
            desig = (m.present_designation or '').lower()
            deg = (m.highest_degree or '').lower()
            if 'hod' in desig or 'head' in desig:
                if 'ph' in deg or 'doctor' in deg:
                    hod_phd = True
                    break
        prog.is_hod_doctorate = "Yes" if hod_phd else "No"

        try:
            cay_start_year = int((prog.cay or '').split('-', 1)[0])
            years = [
                f'{cay_start_year - offset}-{cay_start_year - offset + 1}'
                for offset in range(4)
            ]
        except ValueError:
            years = ['2023-2024', '2022-2023', '2021-2022', '2020-2021']
        cadre_data = []
        phd_data = []

        for yr_idx, yr in enumerate(years):
            label = ['CAY', 'CAY m1', 'CAYm2', 'CAYm3'][yr_idx]
            prof = 0
            assoc = 0
            asst = 0
            phd_cnt = 0
            total_active = 0

            for m in members:
                assoc_status = m.yearly_association.get(yr, '')
                if assoc_status.lower() in ('yes', 'regular', 'active', 'true'):
                    total_active += 1
                    des = (m.yearly_designation.get(yr) or m.present_designation or '').lower()
                    if 'associate professor' in des:
                        assoc += 1
                    elif 'professor' in des:
                        prof += 1
                    elif 'assistant' in des:
                        asst += 1
                    
                    q = (m.yearly_qualification.get(yr) or m.highest_degree or '').lower()
                    if 'ph' in q or 'doctor' in q:
                        phd_cnt += 1

            non_phd = max(0, total_active - phd_cnt)
            pct = round((phd_cnt / total_active * 100), 1) if total_active > 0 else 0

            cadre_data.append({
                "label": label,
                "year": yr,
                "professors": prof,
                "associate_professors": assoc,
                "assistant_professors": asst,
                "total_faculty": total_active
            })

            phd_data.append({
                "label": label,
                "year": yr,
                "phd": phd_cnt,
                "non_phd": non_phd,
                "total_faculty": total_active,
                "phd_percentage": f"{pct}%"
            })

        cay_cadre = cadre_data[0] if len(cadre_data) > 0 else {}
        cay_m1_cadre = cadre_data[1] if len(cadre_data) > 1 else {}
        c_cay = (cay_cadre.get('professors', 0) >= 2) or (cay_cadre.get('professors', 0) >= 1 and cay_cadre.get('associate_professors', 0) >= 1)
        c_caym1 = (cay_m1_cadre.get('professors', 0) >= 2) or (cay_m1_cadre.get('professors', 0) >= 1 and cay_m1_cadre.get('associate_professors', 0) >= 1)
        prog.cadre_compliance_cay = "Yes" if c_cay else "No"
        prog.cadre_compliance_caym1 = "Yes" if c_caym1 else "No"

        prog.cadre_table = cadre_data
        prog.phd_table = phd_data
        prog.save()

    metrics_by_department = {}
    for metrics in QualifierPrimaryCheckMetrics.objects.filter(college=college):
        years = metrics.years or ['2023-2024', '2022-2023', '2021-2022']
        sfr_dict = {}
        sfr_vals = []
        for yr in years:
            s = float(metrics.s_total.get(yr) or 0)
            f = float(metrics.f_total.get(yr) or 0)
            ff = float(metrics.ff_first_year.get(yr) or 0)
            denom = f - ff
            if denom > 0:
                val = round(s / denom, 2)
                sfr_dict[yr] = val
                sfr_vals.append(val)
            else:
                sfr_dict[yr] = '#DIV/0!'

        metrics.sfr_calculated = sfr_dict
        if sfr_vals:
            avg = round(sum(sfr_vals) / len(sfr_vals), 2)
            metrics.avg_sfr = str(avg)
        else:
            metrics.avg_sfr = '#DIV/0!'
        metrics.save()
        metrics_by_department[metrics.department_id] = metrics

    checklist_scopes = [(None, QualifierChecklistItem.objects.filter(
        college=college, department__isnull=True
    ))]
    checklist_scopes.extend(
        (department, QualifierChecklistItem.objects.filter(
            college=college, department=department
        ))
        for department in QualifierDepartment.objects.filter(college=college)
    )
    for department, items in checklist_scopes:
        metrics = metrics_by_department.get(department.id if department else None)
        if department:
            master_prog = QualifierProgram.objects.filter(
                college=college, dept_sno=department.sno, program_type='master'
            ).first()
        else:
            master_prog = QualifierProgram.objects.filter(
                college=college, program_type='master'
            ).first()

        approval_status = (
            metrics.approval_five_years if department and metrics
            else college.approval_five_years
        )
        approval_years = (
            metrics.approval_years_text if department and metrics
            else college.approval_years_text
        )
        approval_complied = (
            "Complied" if (approval_status or 'No').strip().lower() == 'yes'
            else "Not Complied"
        )

        sfr_text = metrics.avg_sfr if metrics else '#DIV/0!'
        try:
            sfr_complied = (
                "Complied" if float(sfr_text) <= 25.0 else "Not Complied"
            )
        except (ValueError, TypeError):
            sfr_complied = "Not Complied"

        cadre_complied = "Complied" if (
            master_prog
            and master_prog.cadre_compliance_cay == 'Yes'
            and master_prog.cadre_compliance_caym1 == 'Yes'
        ) else "Not Complied"

        avg_pct = 0
        phd_complied = "Not Complied"
        if master_prog and len(master_prog.phd_table) >= 2:
            try:
                cay_pct = float(master_prog.phd_table[0]['phd_percentage'].replace('%', ''))
                cay_m1_pct = float(master_prog.phd_table[1]['phd_percentage'].replace('%', ''))
                avg_pct = (cay_pct + cay_m1_pct) / 2
                if avg_pct >= 20.0:
                    phd_complied = "Complied"
            except (KeyError, TypeError, ValueError):
                pass

        batches_status = (
            master_prog.two_batches_passed if department and master_prog
            else college.two_batches_passed_out
        )
        two_batches = (batches_status or 'No').strip().lower() == 'yes'
        two_batches_complied = "Complied" if two_batches else "Not Complied"
        hod_phd_status = master_prog.is_hod_doctorate if master_prog else 'No'
        hod_complied = "Complied" if hod_phd_status == 'Yes' else "Not Complied"

        for item in items:
            if item.sno == 1:
                item.current_status = (
                    approval_years if approval_complied == 'Complied'
                    else "Not Approved"
                )
                item.compliance_status = approval_complied
            elif item.sno == 2:
                item.current_status = f"{sfr_text}:1" if sfr_text != '#DIV/0!' else "#DIV/0!"
                item.compliance_status = sfr_complied
            elif item.sno == 3:
                item.current_status = "Yes" if cadre_complied == "Complied" else "No"
                item.compliance_status = cadre_complied
            elif item.sno == 4:
                item.current_status = f"{avg_pct:.1f}%" if phd_complied == "Complied" else "#DIV/0!"
                item.compliance_status = phd_complied
            elif item.sno == 5:
                item.current_status = "Yes" if two_batches else "No"
                item.compliance_status = two_batches_complied
            elif item.sno == 6:
                item.current_status = hod_phd_status
                item.compliance_status = hod_complied

            item.save()
