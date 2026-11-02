"""
Generate a cross-college test audit for every department.

Rules for the allocation:
  * an auditor never audits a department of his/her own college
  * every department gets two different auditors (lead: C1-C5, second: C6-C9)
  * no auditor gets more than MAX_LOAD departments and no auditor pair is repeated
  * the lead auditor is matched to the department's discipline where possible

Each department gets its own performance profile (overall level, a strong and a
weak criterion) so departments can be compared, and its own ATR completion level
so the ATR format filled by the HODs can be checked.

Re-running the command wipes and rebuilds only the test cycle.

    python manage.py seed_test_audit
    python manage.py seed_test_audit --year 2025-2026 --semester Even --seed 7
"""
import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from audit_core.models import (
    Department, Auditor, AuditCycle, Criterion, MetricItem,
    AuditAssignment, AuditEvaluation, ActionTakenReport,
)
from audit_core.views import calculate_grade, get_settings

MAX_LOAD = 2
LEAD_CRITERIA = ['C1', 'C2', 'C3', 'C4', 'C5']
SECOND_CRITERIA = ['C6', 'C7', 'C8', 'C9']

FAMILY = {
    'CSE': 'computing', 'IT': 'computing', 'AI&DS': 'computing', 'AI&ML': 'computing',
    'CSBS': 'computing', 'CSE (CS)': 'computing',
    'ECE': 'electrical', 'ECE (VLSI)': 'electrical', 'EEE': 'electrical',
    'MECH': 'core', 'CIVIL': 'core',
    'S&H': 'science',
}
DISCIPLINE_ALIAS = {'CSE (CS)': 'CSE', 'ECE (VLSI)': 'ECE'}

# (label, base %) of the performance tiers handed out to departments
TIERS = [
    ('Excellent', 90), ('Good', 82), ('Satisfactory', 74),
    ('Needs improvement', 66), ('Weak', 58),
]
# ATR completion levels handed out to departments
ATR_LEVELS = ['Complete', 'In progress', 'Partial', 'Not submitted']

ROOT_CAUSES = {
    'C1': ['PEO/PO mapping not reviewed in the last BoS meeting',
           'Curriculum gap analysis not documented for the regulation',
           'Stakeholder feedback collected but not analysed'],
    'C2': ['Lesson plans not aligned to course outcomes',
           'Innovative teaching methods used but evidence not maintained',
           'Course files incomplete for the sampled courses'],
    'C3': ['CO attainment computed only for end-semester marks',
           'Question papers not mapped to Bloom\'s levels',
           'Internal assessment moderation records missing'],
    'C4': ['Low pass percentage in core courses',
           'Placement and higher-studies records not consolidated',
           'Remedial classes for slow learners not tracked'],
    'C5': ['Faculty qualification / cadre ratio below norm',
           'Faculty appraisal records not updated',
           'Vacant positions not filled in time'],
    'C6': ['Low publication count in indexed journals',
           'Funded project proposals not submitted',
           'FDP / consultancy records not documented'],
    'C7': ['Lab manuals and stock registers not updated',
           'Equipment maintenance log not maintained',
           'Safety measures in labs not documented'],
    'C8': ['Action on previous audit observations not closed',
           'PO attainment targets not revised after review',
           'Improvement actions not minuted in DAB meetings'],
    'C9': ['Mentoring records incomplete',
           'Grievance and anti-ragging committee minutes missing',
           'Co-curricular participation not documented'],
}
ACTION_PLANS = {
    'C1': 'Convene BoS/DAB, review PEO-PO-PSO mapping and record the minutes',
    'C2': 'Course coordinators to update lesson plans and course files; HOD review fortnightly',
    'C3': 'Compute CO attainment from direct and indirect tools and file the moderation reports',
    'C4': 'Conduct remedial classes and consolidate placement / higher-studies data with proof',
    'C5': 'Initiate recruitment and update faculty appraisal and qualification records',
    'C6': 'Set publication and proposal targets per faculty and track monthly',
    'C7': 'Update lab manuals, stock and maintenance registers; lab in-charge to verify',
    'C8': 'Close previous audit observations and record the improvement actions in DAB minutes',
    'C9': 'Update mentoring registers and file the committee minutes every month',
}
GRADE_REMARKS = {
    'Y': ['Records complete and verified.', 'Evidence well organised.', 'Meets the benchmark.'],
    'C': ['Minor gaps in documentation.', 'Mostly compliant; a few records missing.'],
    'W': ['Several sampled records incomplete.', 'Evidence partly available; needs strengthening.'],
    'D': ['Major gaps; evidence not produced for most samples.', 'Not compliant with the benchmark.'],
}


def as_int(text, default):
    try:
        return max(1, int(float(str(text).strip())))
    except (TypeError, ValueError):
        return default


class Command(BaseCommand):
    help = 'Create a cross-college test audit (allocation, evaluations, ATR) for all departments'

    def add_arguments(self, parser):
        parser.add_argument('--year', default='2025-2026')
        parser.add_argument('--semester', default='Even', choices=['Odd', 'Even'])
        parser.add_argument('--cycle-type', default='End-Semester', choices=['Mid-Semester', 'End-Semester'])
        parser.add_argument('--seed', type=int, default=2026)

    def handle(self, *args, **opts):
        rng = random.Random(opts['seed'])
        departments = list(Department.objects.select_related('institute').order_by('institute__code', 'code'))
        auditors = list(Auditor.objects.filter(is_active=True).select_related('institute'))
        if not departments or not auditors:
            raise CommandError('Departments and auditors must exist first (run seed_audit_data).')

        allocation = self.allocate(departments, auditors, rng)

        with transaction.atomic():
            cycle, _ = AuditCycle.objects.get_or_create(
                academic_year=opts['year'], semester=opts['semester'], cycle_type=opts['cycle_type'],
                defaults={'is_active': True},
            )
            # Wipe only this cycle (ATRs cascade from evaluations)
            AuditEvaluation.objects.filter(cycle=cycle).delete()
            AuditAssignment.objects.filter(cycle=cycle).delete()

            settings = get_settings()
            metrics = list(MetricItem.objects.filter(is_header=False).select_related('criterion'))
            criteria = [c.code for c in Criterion.objects.order_by('order')]
            start = self.cycle_start(opts['year'], opts['semester'])

            tiers = [TIERS[i % len(TIERS)] for i in range(len(departments))]
            rng.shuffle(tiers)
            levels = [ATR_LEVELS[i % len(ATR_LEVELS)] for i in range(len(departments))]
            rng.shuffle(levels)

            report = []
            for idx, dept in enumerate(departments):
                lead, second = allocation[dept.id]
                review_from = start + timedelta(days=rng.randint(0, 6))
                AuditAssignment.objects.create(
                    cycle=cycle, department=dept,
                    auditor_1=lead, auditor_2=second,
                    auditor_1_criteria=LEAD_CRITERIA, auditor_2_criteria=SECOND_CRITERIA,
                    assigned_criteria=LEAD_CRITERIA + SECOND_CRITERIA,
                    deployment_check='Cross-college: verified',
                    digital_review_from=review_from,
                    digital_review_to=review_from + timedelta(days=7),
                    physical_audit_date=review_from + timedelta(days=rng.randint(10, 16)),
                    status='Report issued',
                )

                tier, base = tiers[idx]
                strong, weak = rng.sample(criteria, 2)
                offsets = {c: rng.uniform(-8, 8) for c in criteria}
                offsets[strong] += 14
                offsets[weak] -= 22

                flagged = []
                for m in metrics:
                    code = m.criterion.code
                    auditor = lead if code in LEAD_CRITERIA else second
                    target = min(100, max(5, rng.gauss(base + offsets[code], 9)))
                    ev = self.make_evaluation(cycle, dept, m, auditor, target, settings, rng)
                    if ev.is_flagged_for_atr:
                        flagged.append(ev)

                self.make_atrs(flagged, dept, levels[idx], start, rng)
                report.append((dept, lead, second, tier, strong, weak, levels[idx], len(flagged)))

        self.print_report(cycle, report)

    # ---------------------------------------------------------------- allocation
    def allocate(self, departments, auditors, rng):
        def discipline_rank(auditor, dept):
            a_code = DISCIPLINE_ALIAS.get(auditor.dept_name, auditor.dept_name)
            d_code = DISCIPLINE_ALIAS.get(dept.code, dept.code)
            if a_code == d_code:
                return 0
            if FAMILY.get(auditor.dept_name) == FAMILY.get(dept.code):
                return 1
            return 2

        for _attempt in range(500):
            load = {a.id: 0 for a in auditors}
            served = {a.id: set() for a in auditors}  # institutes already audited by the auditor
            pairs = set()
            result = {}
            order = departments[:]
            rng.shuffle(order)
            ok = True
            for dept in order:
                pool = [a for a in auditors
                        if a.institute_id and a.institute_id != dept.institute_id and load[a.id] < MAX_LOAD]

                def lead_score(a):
                    return (discipline_rank(a, dept) * 10 + load[a.id] * 4
                            + (5 if dept.institute_id in served[a.id] else 0) + rng.random())
                if len(pool) < 2:
                    ok = False
                    break
                lead = min(pool, key=lead_score)

                def second_score(a):
                    return (load[a.id] * 4
                            + (3 if a.institute_id == lead.institute_id else 0)
                            + (2 if a.dept_name == lead.dept_name else 0)
                            + (5 if dept.institute_id in served[a.id] else 0) + rng.random())
                options = [a for a in pool if a.id != lead.id and frozenset((a.id, lead.id)) not in pairs]
                if not options:
                    ok = False
                    break
                second = min(options, key=second_score)

                for a in (lead, second):
                    load[a.id] += 1
                    served[a.id].add(dept.institute_id)
                pairs.add(frozenset((lead.id, second.id)))
                result[dept.id] = (lead, second)
            if ok:
                return result
        raise CommandError('Could not find a valid cross-college allocation.')

    # ---------------------------------------------------------------- evaluation
    def make_evaluation(self, cycle, dept, metric, auditor, target, settings, rng):
        benchmark = metric.benchmark if metric.benchmark and metric.benchmark > 0 else 100.0
        if metric.unit == '%':
            items = max(as_int(metric.min_sample, 5), rng.randint(10, 40))
            valid = round(items * target / 100)
            validated = round(valid / items * 100, 2)
        else:
            valid = round(benchmark * target / 100)
            items = max(valid, round(benchmark * rng.uniform(0.9, 1.3)), 1)
            validated = round(float(valid), 2)

        marks = round(metric.max_marks * min(validated / benchmark, 1.0), 2)
        if metric.max_marks > 0:
            pct = round(marks / metric.max_marks * 100, 2)
            grade = calculate_grade(pct, settings)
        else:
            pct, grade = 100.0, 'Y'

        if pct >= 75:
            evidence, physical = 'Complete', 'Matches claim'
        elif pct >= 60:
            evidence = rng.choice(['Complete', 'Partial'])
            physical = rng.choice(['Matches claim', 'Partially matches'])
        elif pct >= 40:
            evidence, physical = 'Partial', rng.choice(['Partially matches', 'Not checked'])
        else:
            evidence = rng.choice(['Partial', 'Not Uploaded'])
            physical = 'Does not match'

        remarks = (f'[{auditor.name}] Sampled {items:g} items, {valid:g} valid. '
                   f'{rng.choice(GRADE_REMARKS[grade])}')
        return AuditEvaluation.objects.create(
            cycle=cycle, department=dept, metric=metric,
            items_checked=float(items), valid_items=float(valid), validated_value=validated,
            marks_obtained=marks, percentage=pct, grade=grade, auditor_remarks=remarks,
            evidence_status=evidence, physical_check_result=physical,
            is_flagged_for_atr=pct < 60 or grade in ('W', 'D'),
        )

    # ---------------------------------------------------------------- ATR
    def make_atrs(self, flagged, dept, level, start, rng):
        report_date = start + timedelta(days=30)
        for i, ev in enumerate(flagged):
            m = ev.metric
            code = m.criterion.code
            stub = ActionTakenReport(
                evaluation=ev,
                root_cause=f'Identified score below benchmark ({ev.percentage}%) for {m.key_aspect[:50]}.',
                action_plan='Departmental corrective measure required.',
                status='Open',
            )
            if level == 'Not submitted' or (level == 'Partial' and i % 2):
                stub.save()
                continue

            stub.root_cause = f'{m.code}: {rng.choice(ROOT_CAUSES[code])} ({ev.percentage}% against benchmark).'
            stub.action_plan = f'{ACTION_PLANS[code]}. Responsibility: {code} coordinator, {dept.code}.'
            stub.target_date = report_date + timedelta(days=rng.choice([30, 45, 60, 90]))
            stub.hod_remarks = f'Entered by HOD, {dept.institute.code} {dept.code}'

            if level == 'Complete':
                status = rng.choices(['Closed', 'In Progress'], weights=[85, 15])[0]
            elif level == 'In progress':
                status = rng.choices(['Closed', 'In Progress', 'Open'], weights=[30, 55, 15])[0]
            else:
                status = rng.choices(['In Progress', 'Open'], weights=[40, 60])[0]
            stub.status = status

            if status != 'Open':
                stub.evidence_ref = (f'https://drive.example/{dept.institute.code}/'
                                     f'{dept.code.replace(" ", "")}/ATR/{m.code}')
            if status == 'Closed':
                stub.completed_date = stub.target_date - timedelta(days=rng.randint(0, 20))
                stub.auditor_signoff = rng.random() < 0.8
                stub.auditor_feedback = ('Verified the evidence; observation closed.'
                                         if stub.auditor_signoff else 'Evidence received; verification pending.')
            stub.save()

    @staticmethod
    def cycle_start(year, semester):
        first, second = (int(y) for y in year.split('-'))
        return date(first, 11, 2) if semester == 'Odd' else date(second, 4, 20)

    def print_report(self, cycle, report):
        self.stdout.write(self.style.SUCCESS(f'\nTest audit created in cycle #{cycle.id}: {cycle}\n'))
        fmt = '{:<5} {:<11} {:<30} {:<30} {:<18} {:<7} {:<7} {:<14} {:>4}'
        self.stdout.write(fmt.format('Inst', 'Dept', 'Lead auditor (C1-C5)', 'Second auditor (C6-C9)',
                                     'Profile', 'Strong', 'Weak', 'ATR filled', 'ATRs'))
        for dept, lead, second, tier, strong, weak, level, n in report:
            self.stdout.write(fmt.format(
                dept.institute.code, dept.code,
                f'{lead.name} [{lead.institute.code}]'[:30], f'{second.name} [{second.institute.code}]'[:30],
                tier, strong, weak, level, n))
