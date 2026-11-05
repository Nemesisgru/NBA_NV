"""Allowlist of analytics operations and strict validation of their filters.

Requests from the UI and operations proposed by the language model both go through validate_request():
unknown operations, unknown fields, wrong types and unknown IDs are rejected. Only the functions
registered here can run.
"""
from datetime import date

from ..models import AuditCycle, Criterion
from ..question_scope import hidden_output_keys, redact
from . import analytics


class OperationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


ATR_STATUSES = {'Open', 'In Progress', 'Closed'}
GRADES = {'Y', 'C', 'W', 'D'}


def _criterion(value):
    if value in (None, ''):
        return None
    code = str(value).strip().upper()
    if not Criterion.objects.filter(code=code).exists():
        raise OperationError(f'Unknown criterion: {str(value)[:20]}')
    return code


def _choice(allowed):
    def check(value):
        if value in (None, ''):
            return None
        if value not in allowed:
            raise OperationError(f'Unsupported value: {str(value)[:30]}')
        return value
    return check


def _bool(value):
    if isinstance(value, bool):
        return value
    if value in (None, ''):
        return False
    raise OperationError('Expected true or false')


def _date(value):
    if value in (None, ''):
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise OperationError('Invalid date (use YYYY-MM-DD)')


def _cycle(value):
    if value in (None, ''):
        return None
    try:
        cycle = AuditCycle.objects.filter(id=int(value)).first()
    except (TypeError, ValueError):
        raise OperationError('Invalid audit cycle')
    if not cycle:
        raise OperationError('Audit cycle not found', 404)
    return cycle


def _text(max_len):
    def check(value):
        if value in (None, ''):
            return None
        if not isinstance(value, str) or len(value) > max_len:
            raise OperationError(f'Expected text of at most {max_len} characters')
        return value.strip()
    return check


def _limit(value):
    if value in (None, ''):
        return analytics.ROW_LIMIT
    if not isinstance(value, int) or not 1 <= value <= 500:
        raise OperationError('limit must be an integer between 1 and 500')
    return value


OPERATIONS = {
    'audit_summary': {
        'fn': lambda scope, f: analytics.get_audit_summary(scope, f['criterion']),
        'filters': {'criterion': _criterion},
        'label': 'Summarise the audit',
    },
    'compare_departments': {
        'fn': lambda scope, f: analytics.compare_departments(scope, f['criterion']),
        'filters': {'criterion': _criterion},
        'label': 'Compare departments / colleges side by side',
    },
    'missing_evidence': {
        'fn': lambda scope, f: analytics.get_missing_evidence(scope, f['criterion'], f['limit'], f['mandatory_only']),
        'filters': {'criterion': _criterion, 'limit': _limit, 'mandatory_only': _bool},
        'label': 'List missing or partial evidence',
    },
    'pending_corrective_actions': {
        'fn': lambda scope, f: analytics.get_pending_corrective_actions(
            scope, f['criterion'], f['status'], f['overdue_only'], f['due_before'], f['limit'], f['owner']),
        'filters': {'criterion': _criterion, 'status': _choice(ATR_STATUSES), 'overdue_only': _bool,
                    'due_before': _date, 'limit': _limit, 'owner': _text(100)},
        'label': 'Pending / overdue corrective actions',
    },
    'criterion_findings': {
        'fn': lambda scope, f: analytics.get_criterion_findings(scope, f['criterion'], f['grade'], f['limit']),
        'filters': {'criterion': _criterion, 'grade': _choice(GRADES), 'limit': _limit},
        'label': 'Findings by criterion',
    },
    'compare_cycles': {
        'fn': lambda scope, f: analytics.compare_audit_cycles(scope, f['compare_cycle_id']),
        'filters': {'compare_cycle_id': _cycle},
        'label': 'Compare with another audit cycle',
    },
    'search_evidence': {
        'fn': lambda scope, f: analytics.search_evidence_text(scope, f['query'] or '', f['criterion']),
        'filters': {'query': _text(200), 'criterion': _criterion},
        'label': 'Search the text of uploaded evidence',
    },
    'generate_report': {
        'fn': None,  # handled by the report job (reports.py); listed so the model can propose it
        'filters': {'compare_cycle_id': _cycle, 'criterion': _criterion},
        'label': 'Generate a draft audit report',
    },
}


def validate_request(operation, filters):
    """Returns (operation, cleaned filters) or raises OperationError"""
    if not isinstance(operation, str) or operation not in OPERATIONS:
        raise OperationError('Unsupported operation')
    if filters is None:
        filters = {}
    if not isinstance(filters, dict):
        raise OperationError('filters must be an object')
    spec = OPERATIONS[operation]['filters']
    unknown = set(filters) - set(spec)
    if unknown:
        raise OperationError(f"Unsupported filter(s): {', '.join(sorted(str(u)[:20] for u in unknown))}")
    return operation, {name: check(filters.get(name)) for name, check in spec.items()}


def run_operation(scope, operation, filters):
    operation, cleaned = validate_request(operation, filters)
    fn = OPERATIONS[operation]['fn']
    if fn is None:
        raise OperationError('Reports are generated through the report endpoint')
    if scope.cycle is None:
        raise OperationError('Select an audit cycle first')
    return withhold_hidden(fn(scope, cleaned), scope)


def withhold_hidden(result, scope):
    """Figures of columns the Admin hid for the audit (or the compared audit) are withheld from HODs / Auditors"""
    cycles = [scope.cycle]
    other_id = (result.get('compare_cycle') or {}).get('id') if isinstance(result.get('compare_cycle'), dict) else None
    if other_id:
        cycles.append(AuditCycle.objects.filter(id=other_id).first())
    keys = hidden_output_keys(cycles, scope.role)
    if not keys:
        return result
    result = redact(result, keys)
    result['withheld'] = sorted(keys)
    result.setdefault('notes', []).append(
        'Some figures are not shown for your login because the Admin hid those columns for this audit.')
    return result
