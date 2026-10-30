import re
import os
import json
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from audit_core.models import (
    Institute, Department, Auditor, AuditCycle, Criterion,
    MetricItem, AuditAssignment, AuditEvaluation, ActionTakenReport, AuditSettings
)
from audit_core.auth_utils import create_or_update_auditor_user, create_or_update_hod_user

class Command(BaseCommand):
    help = 'Seed academic audit data from parsed Excel json'

    def handle(self, *args, **options):
        self.stdout.write("Seeding Academic Audit data...")

        # 1. Superuser
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@krgi.edu', 'admin123')
            self.stdout.write("Created superuser 'admin' with password 'admin123'")

        # 2. Settings
        settings, _ = AuditSettings.objects.get_or_create(id=1, defaults={
            'y_threshold': 0.75,
            'c_threshold': 0.60,
            'w_threshold': 0.40,
            'rubric_max_score': 10.0,
            'physical_gap_threshold': 0.15
        })

        # Load parsed json
        json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'parsed_audit_data.json'))
        if not os.path.exists(json_path):
            json_path = r'd:\NBA project\parsed_audit_data.json'
        if not os.path.exists(json_path):
            self.stdout.write(self.style.ERROR(f"File {json_path} not found!"))
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 3. Institutes
        institute_names = {
            'KRCT': 'K. Ramakrishnan College of Technology',
            'KRCE': 'K. Ramakrishnan College of Engineering',
            'MKCE': 'M. Kumarasamy College of Engineering'
        }
        inst_map = {}
        for code in data.get('institutes', ['KRCT', 'KRCE', 'MKCE']):
            name = institute_names.get(code, f"Institute of {code}")
            inst, _ = Institute.objects.get_or_create(code=code, defaults={'name': name})
            inst_map[code] = inst
        self.stdout.write(f"Seeded {len(inst_map)} institutes.")

        # 4. Departments
        dept_names = {
            'AI&DS': 'Artificial Intelligence and Data Science',
            'AI&ML': 'Artificial Intelligence and Machine Learning',
            'CIVIL': 'Civil Engineering',
            'CSBS': 'Computer Science and Business Systems',
            'CSE': 'Computer Science and Engineering',
            'CSE (CS)': 'Computer Science and Engineering (Cyber Security)',
            'ECE': 'Electronics and Communication Engineering',
            'ECE (VLSI)': 'Electronics and Communication (VLSI Design)',
            'EEE': 'Electrical and Electronics Engineering',
            'IT': 'Information Technology',
            'MECH': 'Mechanical Engineering',
            'S&H': 'Science and Humanities'
        }
        dept_map = {}
        for inst_code, inst in inst_map.items():
            for d_code in data.get('departments', []):
                name = dept_names.get(d_code, d_code)
                dept, _ = Department.objects.get_or_create(
                    institute=inst,
                    code=d_code,
                    defaults={'name': name, 'hod_name': f"Dr. HOD ({d_code})", 'hod_email': f"hod.{d_code.lower().replace('&','').replace(' ','')}@{inst_code.lower()}.ac.in"}
                )
                dept_map[(inst_code, d_code)] = dept
                create_or_update_hod_user(dept)
        self.stdout.write(f"Seeded departments and HOD user logins across institutes.")

        # 5. Auditors
        auditor_objs = []
        for a in data.get('auditors', []):
            inst = inst_map.get(a.get('institute'))
            d_code = a.get('department')
            dept = dept_map.get((a.get('institute'), d_code))
            try:
                sl = int(a.get('sl')) if a.get('sl') and str(a.get('sl')).isdigit() else None
            except:
                sl = None
            
            auditor, _ = Auditor.objects.get_or_create(
                name=a.get('name'),
                email=a.get('email') or f"{a.get('name', 'auditor').lower().replace(' ', '.')}@krgi.edu",
                defaults={
                    'sl_no': sl,
                    'institute': inst,
                    'department': dept,
                    'dept_name': d_code or '',
                    'designation': a.get('designation', ''),
                    'experience': a.get('experience', ''),
                    'is_active': True
                }
            )
            create_or_update_auditor_user(auditor)
            auditor_objs.append(auditor)
        self.stdout.write(f"Seeded {Auditor.objects.count()} auditors with automatic logins.")

        # 6. Audit Cycles
        cycle_odd, _ = AuditCycle.objects.get_or_create(
            academic_year='2024-2025',
            cycle_type='Mid-Semester',
            semester='Odd',
            defaults={'is_active': True}
        )
        cycle_even, _ = AuditCycle.objects.get_or_create(
            academic_year='2024-2025',
            cycle_type='End-Semester',
            semester='Even',
            defaults={'is_active': False}
        )

        # 7. Criteria & Metric Items
        total_metrics = 0
        order_idx = 1
        for c_code, c_val in data.get('criteria', {}).items():
            crit, _ = Criterion.objects.get_or_create(
                code=c_code,
                defaults={
                    'title': c_val.get('title', c_code),
                    'description': f"NBA Tier-I aligned evaluation rubrics for {c_val.get('title', c_code)}",
                    'order': int(c_code.replace('C', ''))
                }
            )

            metric_order = 1
            for item in c_val.get('items', []):
                try:
                    max_m = float(item.get('max_marks')) if item.get('max_marks') else 0.0
                except:
                    max_m = 0.0
                try:
                    bench = float(item.get('benchmark')) if item.get('benchmark') else (100.0 if item.get('unit') == '%' else 10.0)
                except:
                    bench = 100.0

                # "CRITERION N TOTAL" rows in the Excel sheet are subtotals, not scorable indicators
                is_total_row = bool(re.match(r'^\s*CRITERION\s+\d+\s+TOTAL', item.get('key_aspect', ''), re.I))

                MetricItem.objects.get_or_create(
                    criterion=crit,
                    code=item.get('code'),
                    order=metric_order,
                    defaults={
                        'is_header': item.get('is_header', False) or is_total_row,
                        'key_aspect': item.get('key_aspect', ''),
                        'auditor_verifies': item.get('auditor_verifies', ''),
                        'valid_condition': item.get('valid_condition', ''),
                        'sampling_unit': item.get('sampling_unit', ''),
                        'sample_percent': str(item.get('sample_percent', '')),
                        'min_sample': str(item.get('min_sample', '')),
                        'how_to_sample': item.get('how_to_sample', ''),
                        'rubric_Y': item.get('rubric_Y', ''),
                        'rubric_C': item.get('rubric_C', ''),
                        'rubric_W': item.get('rubric_W', ''),
                        'rubric_D': item.get('rubric_D', ''),
                        'unit': item.get('unit', '%'),
                        'max_marks': max_m,
                        'benchmark': bench
                    }
                )
                metric_order += 1
                total_metrics += 1

        self.stdout.write(f"Seeded 9 Criteria with {total_metrics} metric sections/rubrics.")

        # 8. Sample Audit Allocations
        auditors_list = list(Auditor.objects.all())
        departments_list = list(Department.objects.filter(institute__code='KRCT'))
        for idx, dept in enumerate(departments_list):
            a1 = auditors_list[idx % len(auditors_list)] if auditors_list else None
            a2 = auditors_list[(idx + 3) % len(auditors_list)] if auditors_list else None
            
            # Diverse assignment of individual or multiple criteria
            assigned = ["C1", "C2", "C3"] if idx % 3 == 0 else (["C4", "C5", "C6"] if idx % 3 == 1 else ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"])
            
            AuditAssignment.objects.get_or_create(
                cycle=cycle_odd,
                department=dept,
                defaults={
                    'auditor_1': a1,
                    'auditor_2': a2,
                    'assigned_criteria': assigned,
                    'deployment_check': 'Valid - cross-department deployment verified',
                    'status': 'Digital audit done' if idx < 3 else 'Not started'
                }
            )

        # 9. Seed some realistic evaluation marks and ATR for demonstration
        krct_cse = Department.objects.filter(institute__code='KRCT', code='CSE').first()
        krct_ece = Department.objects.filter(institute__code='KRCT', code='ECE').first()
        sample_depts = [d for d in [krct_cse, krct_ece] if d]

        for dept in sample_depts:
            for metric in MetricItem.objects.filter(is_header=False):
                max_m = metric.max_marks or 5.0
                # Generate realistic sample values
                items_chk = 10
                # Let some be Y (85%), some C (65%), some W (45%), some D (30%)
                perf = 0.82 if metric.id % 4 == 0 else (0.68 if metric.id % 4 == 1 else (0.48 if metric.id % 4 == 2 else 0.88))
                val_items = round(items_chk * perf)
                val_val = round((val_items / items_chk) * 100, 1) if metric.unit == '%' else float(val_items)
                bench = metric.benchmark if metric.benchmark else 100.0
                ratio = min(val_val / bench, 1.0) if bench else 0.8
                m_obtained = round(max_m * ratio, 2)
                pct = round((m_obtained / max_m) * 100, 1) if max_m else 80.0
                
                grade = 'Y' if pct > 75 else ('C' if pct >= 60 else ('W' if pct >= 40 else 'D'))
                flag_atr = grade in ['W', 'D']

                eval_obj, created = AuditEvaluation.objects.get_or_create(
                    cycle=cycle_odd,
                    department=dept,
                    metric=metric,
                    defaults={
                        'items_checked': items_chk,
                        'valid_items': val_items,
                        'validated_value': val_val,
                        'marks_obtained': m_obtained,
                        'percentage': pct,
                        'grade': grade,
                        'auditor_remarks': f"Verified {val_items} of {items_chk} samples meeting standard criteria.",
                        'evidence_status': 'Complete' if grade in ['Y', 'C'] else 'Partial',
                        'physical_check_result': 'Matches claim' if grade in ['Y', 'C'] else 'Partially matches',
                        'is_flagged_for_atr': flag_atr
                    }
                )

                if flag_atr:
                    ActionTakenReport.objects.get_or_create(
                        evaluation=eval_obj,
                        defaults={
                            'root_cause': f"Documentation gaps identified in sample files for {metric.key_aspect[:40]}.",
                            'action_plan': f"Revise file records and conduct internal departmental review.",
                            'status': 'In Progress' if metric.id % 2 == 0 else 'Open',
                            'hod_remarks': 'Corrective measure assigned to module coordinator.',
                            'auditor_signoff': False
                        }
                    )

        self.stdout.write(self.style.SUCCESS("All academic audit database tables successfully seeded!"))
