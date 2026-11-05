"""Questions (MetricItems) that count in a given audit cycle.

The Admin can fix a subset of questions per audit cycle (AuditCycle.selected_metric_ids).
When nothing is fixed (null) every scorable question is part of the audit.
"""
from .models import AuditCycle, MetricItem


def selected_metric_ids(cycle_id):
    """Set of question ids fixed for the cycle, or None meaning all questions"""
    if not cycle_id:
        return None
    ids = AuditCycle.objects.filter(id=cycle_id).values_list('selected_metric_ids', flat=True).first()
    return None if ids is None else set(ids)


def cycle_metrics(cycle_id):
    """Scorable (non-header) questions that are part of the cycle's audit"""
    qs = MetricItem.objects.filter(is_header=False)
    ids = selected_metric_ids(cycle_id)
    return qs if ids is None else qs.filter(id__in=ids)


def is_metric_in_cycle(metric, cycle_id):
    ids = selected_metric_ids(cycle_id)
    return ids is None or metric.id in ids


def criteria_totals(cycle_id):
    """{criterion code: {'metric_count', 'max_marks'}} for the cycle's questions"""
    totals = {}
    for m in cycle_metrics(cycle_id).select_related('criterion'):
        t = totals.setdefault(m.criterion.code, {'metric_count': 0, 'max_marks': 0.0})
        t['metric_count'] += 1
        t['max_marks'] += m.max_marks
    return totals


# Evaluation table columns and whether they are shown by default (Code and Key Aspect are always shown).
# Keep in sync with AUDIT_COLUMNS in frontend/src/auditColumns.js.
DEFAULT_COLUMNS = {
    'unitSample': True,
    'verificationRule': True,
    'rubricY': False,
    'rubricC': False,
    'rubricW': False,
    'rubricD': False,
    'maxMarks': True,
    'itemsChecked': True,
    'validItems': True,
    'benchmark': True,
    'validatedValue': True,
    'marksObtained': True,
    'percentage': True,
    'grade': True,
    'remarks': True,
    'evidenceStatus': True,
    'physicalCheck': True,
    'atrFlag': True,
}

# Column group keys saved before columns were individual, and the columns they covered
LEGACY_GROUPS = {
    'sampling': ['unitSample', 'verificationRule'],
    'rubrics': ['rubricY', 'rubricC', 'rubricW', 'rubricD'],
    'inputs': ['itemsChecked', 'validItems', 'benchmark', 'validatedValue'],
    'results': ['marksObtained', 'percentage', 'grade'],
    'evidence': ['evidenceStatus', 'physicalCheck'],
    'atrCheckbox': ['atrFlag'],
}


def normalize_columns(saved):
    """{column key: bool} for every column: saved values, old group keys translated, then defaults"""
    saved = saved or {}
    legacy = {col: saved[group] for group, cols in LEGACY_GROUPS.items() if group in saved for col in cols}
    return {k: bool(saved.get(k, legacy.get(k, v))) for k, v in DEFAULT_COLUMNS.items()}


def visible_columns(cycle):
    """Columns shown in the evaluation table for the cycle"""
    return normalize_columns(cycle.visible_columns if cycle else None)


# Data behind each column. For every login other than Admin, the fields of hidden columns are left out
# of the API responses and ignored when an evaluation is saved (the stored values are kept).
COLUMN_FIELDS = {
    'unitSample': {'metric': ['sampling_unit', 'sample_percent', 'min_sample'], 'evaluation': []},
    'verificationRule': {'metric': ['valid_condition', 'how_to_sample'], 'evaluation': []},
    'rubricY': {'metric': ['rubric_Y'], 'evaluation': []},
    'rubricC': {'metric': ['rubric_C'], 'evaluation': []},
    'rubricW': {'metric': ['rubric_W'], 'evaluation': []},
    'rubricD': {'metric': ['rubric_D'], 'evaluation': []},
    'maxMarks': {'metric': ['max_marks'], 'evaluation': []},
    'itemsChecked': {'metric': [], 'evaluation': ['items_checked']},
    'validItems': {'metric': [], 'evaluation': ['valid_items']},
    'benchmark': {'metric': ['benchmark'], 'evaluation': []},
    'validatedValue': {'metric': [], 'evaluation': ['validated_value']},
    'marksObtained': {'metric': [], 'evaluation': ['marks_obtained']},
    'percentage': {'metric': [], 'evaluation': ['percentage']},
    'grade': {'metric': [], 'evaluation': ['grade']},
    'remarks': {'metric': [], 'evaluation': ['auditor_remarks']},
    'evidenceStatus': {'metric': [], 'evaluation': ['evidence_status']},
    'physicalCheck': {'metric': [], 'evaluation': ['physical_check_result']},
    'atrFlag': {'metric': [], 'evaluation': ['is_flagged_for_atr']},
}


def hidden_fields(cycle, role):
    """(metric fields, evaluation fields) withheld from this role in the cycle; nothing for Admin"""
    if role == 'Admin':
        return set(), set()
    cols = visible_columns(cycle)
    metric, evaluation = set(), set()
    for key, shown in cols.items():
        if not shown:
            metric.update(COLUMN_FIELDS[key]['metric'])
            evaluation.update(COLUMN_FIELDS[key]['evaluation'])
    return metric, evaluation


# Output fields derived from each evaluation column. When the Admin hides a column for an audit, these are
# withheld (set to None) for HODs and Auditors everywhere: Criterion Summary, ATR, exports and the AI Assistant.
DERIVED_OUTPUT_KEYS = {
    'itemsChecked': {'items_checked'},
    'validItems': {'valid_items'},
    'validatedValue': {'validated_value'},
    'maxMarks': {'max_marks'},
    'marksObtained': {'marks_obtained', 'validated_marks'},
    'percentage': {'percentage', 'current_percent', 'previous_percent', 'change', 'highest_percent',
                   'lowest_percent', 'average_percent', 'spread', 'rank', 'highest', 'lowest'},
    'grade': {'grade', 'current_grade', 'count_y', 'count_c', 'count_w', 'count_d', 'compliance',
              'is_compliant', 'by_grade'},
    'remarks': {'auditor_remarks'},
    'evidenceStatus': {'evidence_status'},
    'physicalCheck': {'physical_check_result', 'physical_check'},
}


def hidden_output_keys(cycles, role):
    """Keys to withhold for this role; `cycles` is one cycle or several (e.g. both sides of a comparison)"""
    if role == 'Admin':
        return set()
    keys = set()
    for cycle in (cycles if isinstance(cycles, (list, tuple, set)) else [cycles]):
        if cycle is None:
            continue
        for col, shown in visible_columns(cycle).items():
            if not shown:
                keys |= DERIVED_OUTPUT_KEYS.get(col, set())
    return keys


def redact(obj, keys):
    """Copy of a JSON-like structure with the given keys set to None at every level"""
    if not keys:
        return obj
    if isinstance(obj, dict):
        return {k: (None if k in keys else redact(v, keys)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v, keys) for v in obj]
    return obj
