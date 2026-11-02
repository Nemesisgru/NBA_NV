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
