"""Deterministic audit analytics used by the assistant and the draft reports.

Every number shown to users comes from here, computed with the application's existing rules:
marks / percentages exactly as AuditEvaluation stores them, grades via views.calculate_grade with
the AuditSettings thresholds, and the per-cycle question selection from question_scope.

Definitions (fields that exist in this application; nothing is inferred beyond them):
  * Submission completed  - a question of the audit has a grade (auditor entered items checked / valid).
  * Evidence status       - the auditor-recorded AuditEvaluation.evidence_status
                            (Complete / Partial / Not Uploaded). The application stores no evidence files.
  * Evidence verified     - physical_check_result == 'Matches claim'.
  * Criterion compliant   - every question of the criterion scored AND criterion grade 'Y'
                            (README: Y = Compliant, C = Concern, W = Weakness, D = Deficiency).
  * Finding approved      - the finding's Action Taken Report has the auditor sign-off.
"""
from collections import defaultdict
from datetime import date

from django.db.models import Max
from django.utils import timezone

from ..models import ActionTakenReport, AuditEvaluation, Criterion
from ..question_scope import cycle_metrics, selected_metric_ids
from ..views import calculate_grade, get_settings
from .scope import cycle_sort_key, ordered_cycles

GRADE_MEANING = {'Y': 'Compliant', 'C': 'Concern', 'W': 'Weakness', 'D': 'Deficiency'}
ATR_STATUSES = ['Open', 'In Progress', 'Closed']
# Text the system puts in an ATR it creates automatically, before the HOD fills it in
AUTO_ACTION_PLAN = 'Departmental corrective measure required.'
ROW_LIMIT = 200

DEFINITIONS = {
    'submission_completed': 'The question has a grade: the auditor entered items checked and valid items.',
    'evidence_status': 'Evidence availability recorded by the auditor (Complete / Partial / Not Uploaded). '
                       'The application stores no evidence files, so nothing is checked automatically.',
    'evidence_verified': "The auditor's physical check result is 'Matches claim'.",
    'criterion_compliant': "All questions of the criterion are scored and the criterion grade is Y (> Y threshold). "
                           "A recorded evidence status alone never makes a criterion compliant.",
    'finding': 'A scored question graded W or D, or flagged for the Action Taken Report.',
    'finding_approved': "The finding's Action Taken Report carries the auditor sign-off.",
    'mandatory_evidence': 'Not configured: the application has no "mandatory evidence" flag, '
                          'so all questions of the audit are treated alike.',
    'corrective_action_owner': 'Not configured per action: the Head of Department of the audited department is responsible.',
    'rubric_version': 'Not tracked: the current global Y/C/W/D thresholds are applied to every cycle.',
}


# ---------------------------------------------------------------- helpers
def ratio(numerator, denominator):
    return {
        'numerator': numerator,
        'denominator': denominator,
        'percent': round(numerator / denominator * 100, 1) if denominator else None,
    }


def rubric_snapshot(cycle=None):
    s = get_settings()
    return {
        'y_threshold_percent': s.y_threshold * 100,
        'c_threshold_percent': s.c_threshold * 100,
        'w_threshold_percent': s.w_threshold * 100,
        'grade_rule': f'Y > {s.y_threshold * 100:g}%, C >= {s.c_threshold * 100:g}%, W >= {s.w_threshold * 100:g}%, D below',
        'marks_rule': 'Marks = Max Marks x min(Validated Value / Benchmark, 1); percentage = marks / max marks',
        'questions_fixed_for_cycle': bool(cycle and selected_metric_ids(cycle.id) is not None),
        'version': 'not tracked',
    }


def data_as_of(dept_ids, cycle):
    ev = AuditEvaluation.objects.filter(department_id__in=dept_ids, cycle=cycle).aggregate(m=Max('updated_at'))['m']
    atr = ActionTakenReport.objects.filter(evaluation__department_id__in=dept_ids,
                                           evaluation__cycle=cycle).aggregate(m=Max('updated_at'))['m']
    stamps = [t for t in (ev, atr) if t]
    return max(stamps).isoformat() if stamps else None


def _base(operation, title, scope, **extra):
    return {
        'operation': operation,
        'title': title,
        'scope': scope.describe(),
        'generated_at': timezone.now().isoformat(),
        'data_as_of': data_as_of(scope.department_ids, scope.cycle) if scope.cycle else None,
        'definitions': DEFINITIONS,
        'notes': [],
        **extra,
    }


def _questions(cycle, criterion=None):
    qs = cycle_metrics(cycle.id).select_related('criterion').order_by('criterion__order', 'order')
    if criterion:
        qs = qs.filter(criterion__code=criterion)
    return list(qs)


def _dept_label(d):
    return f"{d.institute.code} - {d.code}"


def _criterion_titles():
    return dict(Criterion.objects.values_list('code', 'title'))


# ---------------------------------------------------------------- 1. summary
def get_audit_summary(scope, criterion=None):
    settings = get_settings()
    questions = _questions(scope.cycle, criterion)
    by_crit = defaultdict(list)
    for m in questions:
        by_crit[m.criterion.code].append(m)
    titles = _criterion_titles()

    evals = list(AuditEvaluation.objects.filter(
        cycle=scope.cycle, department_id__in=scope.department_ids, metric__in=questions
    ).values('id', 'department_id', 'metric_id', 'metric__criterion__code', 'grade', 'marks_obtained',
             'evidence_status', 'physical_check_result', 'is_flagged_for_atr'))
    atrs = list(ActionTakenReport.objects.filter(evaluation__id__in=[e['id'] for e in evals])
                .values('status', 'auditor_signoff', 'evaluation__department_id', 'evaluation__metric__criterion__code'))

    def empty():
        return {'scored': 0, 'records': 0, 'marks': 0.0, 'ev_complete': 0, 'ev_partial': 0, 'ev_not_uploaded': 0,
                'verified': 0, 'flagged': 0, 'findings': 0, 'atr': defaultdict(int), 'signed_off': 0}

    acc = defaultdict(empty)  # (dept_id, crit) -> counters
    for e in evals:
        a = acc[(e['department_id'], e['metric__criterion__code'])]
        a['records'] += 1
        if e['grade']:
            a['scored'] += 1
            a['marks'] += e['marks_obtained'] or 0
        a['ev_complete'] += e['evidence_status'] == 'Complete'
        a['ev_partial'] += e['evidence_status'] == 'Partial'
        a['ev_not_uploaded'] += e['evidence_status'] == 'Not Uploaded'
        a['verified'] += e['physical_check_result'] == 'Matches claim'
        a['flagged'] += bool(e['is_flagged_for_atr'])
        a['findings'] += bool(e['is_flagged_for_atr'] or e['grade'] in ('W', 'D'))
    for t in atrs:
        a = acc[(t['evaluation__department_id'], t['evaluation__metric__criterion__code'])]
        a['atr'][t['status']] += 1
        a['signed_off'] += bool(t['auditor_signoff'])

    def row(a, n_questions, max_marks):
        pct = round(a['marks'] / max_marks * 100, 2) if max_marks > 0 and a['records'] else None
        grade = calculate_grade(pct, settings) if pct is not None else ''
        if n_questions == 0:
            status = 'No questions in this audit'
        elif a['scored'] < n_questions:
            status = f"Requires review: {n_questions - a['scored']} of {n_questions} questions not scored"
        else:
            status = GRADE_MEANING.get(grade, 'Requires review')
        return {
            'questions_in_audit': n_questions,
            'submission_completed': ratio(a['scored'], n_questions),
            'not_assessed': n_questions - a['records'],
            'evidence_complete': ratio(a['ev_complete'], n_questions),
            'evidence_partial': a['ev_partial'],
            'evidence_not_uploaded': a['ev_not_uploaded'],
            'evidence_verified': ratio(a['verified'], n_questions),
            'max_marks': round(max_marks, 2),
            'marks_obtained': round(a['marks'], 2),
            'percentage': pct,
            'grade': grade or None,
            'compliance': status,
            'is_compliant': status == 'Compliant',
            'findings': a['findings'],
            'flagged_for_atr': a['flagged'],
            'atr_open': a['atr']['Open'], 'atr_in_progress': a['atr']['In Progress'], 'atr_closed': a['atr']['Closed'],
            'findings_approved': a['signed_off'],
        }

    def merge(parts):
        m = empty()
        for p in parts:
            for k in ('scored', 'records', 'marks', 'ev_complete', 'ev_partial', 'ev_not_uploaded',
                      'verified', 'flagged', 'findings', 'signed_off'):
                m[k] += p[k]
            for s, n in p['atr'].items():
                m['atr'][s] += n
        return m

    n_q = sum(len(v) for v in by_crit.values())
    max_total = sum(m.max_marks for m in questions)
    dept_rows, crit_rows = [], []
    for d in scope.departments:
        parts = [acc[(d.id, c)] for c in by_crit]
        dept_rows.append({'department_id': d.id, 'department': _dept_label(d), **row(merge(parts), n_q, max_total)})
    for c, ms in by_crit.items():
        a = merge([acc[(d_id, c)] for d_id in scope.department_ids])
        n_dep = len(scope.department_ids)
        crit_rows.append({'criterion': c, 'title': titles.get(c, ''),
                          **row(a, len(ms) * n_dep, sum(m.max_marks for m in ms) * n_dep)})

    total = row(merge(list(acc.values())), n_q * len(scope.department_ids), max_total * len(scope.department_ids))
    result = _base('audit_summary', 'Audit summary', scope, rubric=rubric_snapshot(scope.cycle),
                   criterion_filter=criterion, totals=total, criteria=crit_rows,
                   departments=dept_rows if len(dept_rows) > 1 else [])
    if not questions:
        result['notes'].append('No questions are part of this audit for the selected criterion.')
    if not evals:
        result['notes'].append('No evaluations have been recorded for this scope and cycle yet.')
    if len(scope.department_ids) > 1:
        result['notes'].append('Criterion figures are totals across all departments in scope.')
    result['refs'] = {'criteria': [r['criterion'] for r in crit_rows]}
    return result


# ---------------------------------------------------------------- 2. missing evidence
def get_missing_evidence(scope, criterion=None, limit=ROW_LIMIT):
    questions = _questions(scope.cycle, criterion)
    evals = {(e.department_id, e.metric_id): e for e in AuditEvaluation.objects.filter(
        cycle=scope.cycle, department_id__in=scope.department_ids, metric__in=questions)}
    rows, counts = [], defaultdict(int)
    for d in scope.departments:
        for m in questions:
            e = evals.get((d.id, m.id))
            if e is None:
                state = 'Not assessed'
            elif e.evidence_status in ('Not Uploaded', 'Partial'):
                state = e.evidence_status
            else:
                continue
            counts[state] += 1
            if len(rows) < limit:
                rows.append({
                    'department': _dept_label(d), 'criterion': m.criterion.code, 'question': m.code,
                    'key_aspect': m.key_aspect[:160], 'evidence_status': state,
                    'physical_check': e.physical_check_result if e else None,
                    'grade': (e.grade or None) if e else None,
                    'auditor_remarks': (e.auditor_remarks[:200] if e else ''),
                })
    total_q = len(questions) * len(scope.department_ids)
    result = _base('missing_evidence', 'Missing or partial evidence', scope, criterion_filter=criterion,
                   totals={
                       'questions_in_scope': total_q,
                       'evidence_not_uploaded': ratio(counts['Not Uploaded'], total_q),
                       'evidence_partial': ratio(counts['Partial'], total_q),
                       'not_assessed': ratio(counts['Not assessed'], total_q),
                   }, rows=rows, truncated=sum(counts.values()) > len(rows))
    result['notes'].append(DEFINITIONS['mandatory_evidence'])
    result['notes'].append("'Not assessed' means no evaluation exists yet; it is not treated as missing evidence or non-compliance.")
    result['refs'] = {'questions': sorted({r['question'] for r in rows}), 'criteria': sorted({r['criterion'] for r in rows})}
    return result


# ---------------------------------------------------------------- 3. corrective actions
def get_pending_corrective_actions(scope, criterion=None, status=None, overdue_only=False, due_before=None,
                                   limit=ROW_LIMIT):
    today = date.today()
    qs = ActionTakenReport.objects.filter(
        evaluation__cycle=scope.cycle, evaluation__department_id__in=scope.department_ids,
        evaluation__metric__in=cycle_metrics(scope.cycle.id),
    ).select_related('evaluation__department__institute', 'evaluation__metric__criterion')
    if criterion:
        qs = qs.filter(evaluation__metric__criterion__code=criterion)
    qs = qs.filter(status=status) if status else qs.exclude(status='Closed')
    if due_before:
        qs = qs.filter(target_date__lte=due_before)

    rows, matching, overdue, no_date, not_entered = [], 0, 0, 0, 0
    for a in qs.order_by('target_date', 'evaluation__department__code', 'evaluation__metric__order'):
        ev = a.evaluation
        is_overdue = bool(a.target_date and a.target_date < today and a.status != 'Closed')
        if overdue_only and not is_overdue:
            continue
        matching += 1
        overdue += is_overdue
        no_date += a.target_date is None
        plan_entered = bool(a.action_plan.strip()) and a.action_plan.strip() != AUTO_ACTION_PLAN
        not_entered += not plan_entered
        if len(rows) < limit:
            rows.append({
                'atr_id': f'ATR-{a.id}', 'department': _dept_label(ev.department),
                'criterion': ev.metric.criterion.code, 'question': ev.metric.code,
                'key_aspect': ev.metric.key_aspect[:160], 'grade': ev.grade or None, 'percentage': ev.percentage,
                'status': a.status, 'target_date': a.target_date.isoformat() if a.target_date else None,
                'days_overdue': (today - a.target_date).days if is_overdue else 0,
                'owner': ev.department.hod_name or f'HOD, {_dept_label(ev.department)}',
                'action_plan_entered': plan_entered,
                'action_plan': a.action_plan[:240] if plan_entered else '',
                'auditor_signoff': a.auditor_signoff,
            })
    awaiting_signoff = ActionTakenReport.objects.filter(
        evaluation__cycle=scope.cycle, evaluation__department_id__in=scope.department_ids,
        evaluation__metric__in=cycle_metrics(scope.cycle.id), status='Closed', auditor_signoff=False).count()
    result = _base('pending_corrective_actions', 'Overdue corrective actions' if overdue_only else 'Pending corrective actions',
                   scope, criterion_filter=criterion, status_filter=status or 'not Closed', overdue_only=overdue_only,
                   totals={
                       'matching_actions': matching,
                       'overdue': overdue,
                       'without_target_date': no_date,
                       'action_plan_not_entered': not_entered,
                       'closed_awaiting_auditor_signoff': awaiting_signoff,
                       'as_of_date': today.isoformat(),
                   }, rows=rows, truncated=matching > len(rows))
    result['notes'].append(DEFINITIONS['corrective_action_owner'])
    result['notes'].append('Overdue = target date before today and status not Closed. Actions without a target date are never counted as overdue.')
    result['refs'] = {'atrs': [r['atr_id'] for r in rows], 'questions': sorted({r['question'] for r in rows}),
                      'criteria': sorted({r['criterion'] for r in rows})}
    return result


# ---------------------------------------------------------------- 4. findings
def get_criterion_findings(scope, criterion=None, grade=None, limit=ROW_LIMIT):
    questions = _questions(scope.cycle, criterion)
    qs = AuditEvaluation.objects.filter(
        cycle=scope.cycle, department_id__in=scope.department_ids, metric__in=questions
    ).select_related('department__institute', 'metric__criterion')
    qs = qs.filter(grade=grade) if grade else qs.filter(grade__in=['W', 'D']) | qs.filter(is_flagged_for_atr=True)
    atr_map = {a.evaluation_id: a for a in ActionTakenReport.objects.filter(evaluation__in=qs)}
    rows, by_grade = [], defaultdict(int)
    for e in qs.distinct().order_by('department__code', 'metric__criterion__order', 'metric__order'):
        by_grade[e.grade or 'Unscored'] += 1
        a = atr_map.get(e.id)
        if len(rows) < limit:
            rows.append({
                'department': _dept_label(e.department), 'criterion': e.metric.criterion.code, 'question': e.metric.code,
                'key_aspect': e.metric.key_aspect[:160], 'grade': e.grade or None, 'percentage': e.percentage,
                'marks': f"{e.marks_obtained if e.marks_obtained is not None else '-'} / {e.metric.max_marks:g}",
                'evidence_status': e.evidence_status, 'physical_check': e.physical_check_result,
                'auditor_remarks': e.auditor_remarks[:240],
                'atr_id': f'ATR-{a.id}' if a else None, 'atr_status': a.status if a else 'No ATR',
                'finding_approved': bool(a and a.auditor_signoff),
            })
    total = sum(by_grade.values())
    approved = sum(1 for r in rows if r['finding_approved'])
    result = _base('criterion_findings', f"Findings{' for ' + criterion if criterion else ''}", scope,
                   criterion_filter=criterion, grade_filter=grade,
                   totals={'findings': total, 'by_grade': dict(by_grade),
                           'approved_in_listed_rows': ratio(approved, len(rows)),
                           'questions_in_scope': len(questions) * len(scope.department_ids)},
                   rows=rows, truncated=total > len(rows))
    result['refs'] = {'questions': sorted({r['question'] for r in rows}), 'criteria': sorted({r['criterion'] for r in rows}),
                      'atrs': [r['atr_id'] for r in rows if r['atr_id']]}
    return result


# ---------------------------------------------------------------- 5. comparison
def _cycle_profile(cycle):
    qs = list(cycle_metrics(cycle.id).select_related('criterion'))
    per = defaultdict(lambda: {'ids': set(), 'max': 0.0})
    for m in qs:
        per[m.criterion.code]['ids'].add(m.id)
        per[m.criterion.code]['max'] += m.max_marks
    return per


def _scores(cycle, dept_ids, metric_ids):
    rows = AuditEvaluation.objects.filter(cycle=cycle, department_id__in=dept_ids, metric_id__in=metric_ids) \
        .values('department_id', 'metric__criterion__code', 'grade', 'marks_obtained')
    out = defaultdict(lambda: {'marks': 0.0, 'scored': 0})
    for r in rows:
        k = (r['department_id'], r['metric__criterion__code'])
        if r['grade']:
            out[k]['scored'] += 1
            out[k]['marks'] += r['marks_obtained'] or 0
    return out


def find_previous_compatible_cycle(scope):
    """Latest earlier cycle with data for the scope; prefers one with an identical question set"""
    base_profile = _cycle_profile(scope.cycle)
    earlier = [c for c in ordered_cycles() if cycle_sort_key(c) < cycle_sort_key(scope.cycle)]
    with_data = [c for c in reversed(earlier)
                 if AuditEvaluation.objects.filter(cycle=c, department_id__in=scope.department_ids).exists()]
    for c in with_data:
        p = _cycle_profile(c)
        if {k: v['ids'] for k, v in p.items()} == {k: v['ids'] for k, v in base_profile.items()}:
            return c
    return with_data[0] if with_data else None


def compare_audit_cycles(scope, compare_cycle=None):
    settings = get_settings()
    other = compare_cycle or find_previous_compatible_cycle(scope)
    if other is None:
        result = _base('compare_cycles', 'Audit cycle comparison', scope, compatible=False, criteria=[], departments=[])
        result['notes'].append('No earlier audit cycle with recorded evaluations exists for this scope, so nothing can be compared.')
        result['refs'] = {}
        return result
    if other.id == scope.cycle.id:
        result = _base('compare_cycles', 'Audit cycle comparison', scope, compatible=False, criteria=[], departments=[])
        result['notes'].append('Choose two different audit cycles to compare.')
        result['refs'] = {}
        return result

    pa, pb = _cycle_profile(scope.cycle), _cycle_profile(other)
    titles = _criterion_titles()
    crit_info = []
    for code in [c for c in titles if c in pa or c in pb]:
        a, b = pa.get(code), pb.get(code)
        if not a or not b:
            reason = f"Criterion is not part of {'the current' if not a else 'the compared'} audit"
        elif a['ids'] != b['ids']:
            reason = (f"Different question sets ({len(a['ids'])} vs {len(b['ids'])} questions, "
                      f"{a['max']:g} vs {b['max']:g} max marks)")
        else:
            reason = ''
        crit_info.append({'criterion': code, 'title': titles[code], 'compatible': not reason,
                          'reason': reason, 'max_marks': a['max'] if a and not reason else None})
    compatible_codes = [c['criterion'] for c in crit_info if c['compatible']]
    fully_compatible = all(c['compatible'] for c in crit_info)

    ids_a = set().union(*[pa[c]['ids'] for c in compatible_codes]) if compatible_codes else set()
    sa, sb = _scores(scope.cycle, scope.department_ids, ids_a), _scores(other, scope.department_ids, ids_a)
    n_by_code = {c: len(pa[c]['ids']) for c in compatible_codes}

    def pct(s, max_marks, n):
        if s['scored'] == 0:
            return None, 'no scores'
        p = round(s['marks'] / max_marks * 100, 2) if max_marks else None
        return p, ('' if s['scored'] == n else f"{s['scored']} of {n} questions scored")

    dept_rows = []
    for d in scope.departments[:40]:
        crit_rows = []
        for c in compatible_codes:
            mx = pa[c]['max']
            p1, n1 = pct(sa[(d.id, c)], mx, n_by_code[c])
            p2, n2 = pct(sb[(d.id, c)], mx, n_by_code[c])
            crit_rows.append({
                'criterion': c, 'current_percent': p1, 'previous_percent': p2,
                'change': round(p1 - p2, 2) if p1 is not None and p2 is not None else None,
                'current_grade': calculate_grade(p1, settings) if p1 is not None else None,
                'previous_grade': calculate_grade(p2, settings) if p2 is not None else None,
                'coverage_note': '; '.join(x for x in (f'current: {n1}' if n1 else '', f'previous: {n2}' if n2 else '') if x),
            })
        overall = None
        if fully_compatible:
            tot_max = sum(pa[c]['max'] for c in compatible_codes)
            m1 = sum(sa[(d.id, c)]['marks'] for c in compatible_codes)
            m2 = sum(sb[(d.id, c)]['marks'] for c in compatible_codes)
            has1 = any(sa[(d.id, c)]['scored'] for c in compatible_codes)
            has2 = any(sb[(d.id, c)]['scored'] for c in compatible_codes)
            if tot_max and has1 and has2:
                overall = {'current_percent': round(m1 / tot_max * 100, 2), 'previous_percent': round(m2 / tot_max * 100, 2)}
                overall['change'] = round(overall['current_percent'] - overall['previous_percent'], 2)
        dept_rows.append({'department': _dept_label(d), 'overall': overall, 'criteria': crit_rows})

    result = _base('compare_cycles', 'Audit cycle comparison', scope, compare_cycle={'id': other.id, 'name': str(other)},
                   compatible=fully_compatible, criteria=crit_info, departments=dept_rows,
                   compatible_criteria=compatible_codes, rubric=rubric_snapshot(scope.cycle))
    result['previous_data_as_of'] = data_as_of(scope.department_ids, other)
    if not fully_compatible:
        result['notes'].append('The two cycles do not use identical question sets, so no overall comparison or ranking is given. '
                               'Only criteria with identical questions are compared.')
    if not compare_cycle:
        result['notes'].append(f'Compared with the most recent earlier cycle that has data: {other}.')
    result['notes'].append(DEFINITIONS['rubric_version'])
    if len(scope.departments) > 40:
        result['notes'].append('Only the first 40 departments are listed.')
    result['refs'] = {'criteria': compatible_codes}
    return result


# ---------------------------------------------------------------- evidence references
def get_evidence_references(scope, criterion=None, limit=500):
    """Evidence references recorded on Action Taken Reports. Shown as text only: never opened or fetched."""
    qs = ActionTakenReport.objects.filter(
        evaluation__cycle=scope.cycle, evaluation__department_id__in=scope.department_ids,
        evaluation__metric__in=cycle_metrics(scope.cycle.id),
    ).exclude(evidence_ref='').select_related('evaluation__department__institute', 'evaluation__metric__criterion')
    if criterion:
        qs = qs.filter(evaluation__metric__criterion__code=criterion)
    rows = [{
        'atr_id': f'ATR-{a.id}', 'department': _dept_label(a.evaluation.department),
        'criterion': a.evaluation.metric.criterion.code, 'question': a.evaluation.metric.code,
        'evidence_ref': a.evidence_ref[:300], 'status': a.status, 'auditor_signoff': a.auditor_signoff,
    } for a in qs.order_by('evaluation__metric__criterion__order', 'evaluation__metric__order')[:limit]]
    return {'rows': rows, 'total': qs.count()}


# ---------------------------------------------------------------- 6. report snapshot
def build_report_snapshot(scope, compare_cycle=None, criterion=None):
    """One validated snapshot that every report format is rendered from"""
    return {
        'summary': get_audit_summary(scope, criterion),
        'missing_evidence': get_missing_evidence(scope, criterion, limit=500),
        'corrective_actions': get_pending_corrective_actions(scope, criterion, limit=500),
        'findings': get_criterion_findings(scope, criterion, limit=500),
        'comparison': compare_audit_cycles(scope, compare_cycle),
        'evidence_refs': get_evidence_references(scope, criterion),
        'rubric': rubric_snapshot(scope.cycle),
        'scope': scope.describe(),
        'data_as_of': data_as_of(scope.department_ids, scope.cycle),
        'generated_at': timezone.now().isoformat(),
    }
