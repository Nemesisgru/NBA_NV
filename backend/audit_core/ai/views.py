"""HTTP API of the AI Audit Assistant (/api/ai/...).

All endpoints need a logged-in Admin, Auditor or HOD. Scope is resolved on the server from the user;
conversations and reports are visible to their owner only.
"""
import json
import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.http import FileResponse, JsonResponse

from ..models import AIConversation, AIMessage, AIReport, AuditCycle
from ..permissions import role_required
from . import intent, jobs, narration, ollama, reports
from .operations import OPERATIONS, OperationError, run_operation, validate_request
from .scope import ScopeError, resolve_scope, scope_options

log = logging.getLogger('audit_core.ai')


def _jsonable(v):
    if isinstance(v, AuditCycle):
        return v.id
    return v.isoformat() if hasattr(v, 'isoformat') else v


def _error(message, status=400):
    return JsonResponse({'error': message}, status=status)


def _body(request):
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except (ValueError, UnicodeDecodeError):
        raise OperationError('Invalid JSON body')
    if not isinstance(data, dict):
        raise OperationError('Invalid JSON body')
    return data


def _rate_limited(request, bucket, limit, window_seconds):
    """Simple per-user fixed-window limit using the cache (process-local with the default cache)"""
    key = f'audit-ai-rl:{bucket}:{request.user.id}:{int(time.time() // window_seconds)}'
    count = cache.get(key, 0) + 1
    cache.set(key, count, window_seconds)
    return count > limit


def _scope_from(request, data, require_cycle=True):
    return resolve_scope(request, college=data.get('college'), department_id=data.get('department_id'),
                         colleges=data.get('colleges'), department_ids=data.get('department_ids'),
                         cycle_id=data.get('cycle_id'), require_cycle=require_cycle)


def _guard(view):
    """Map scope / validation errors to clean JSON responses"""
    def wrapper(request, *args, **kwargs):
        try:
            return view(request, *args, **kwargs)
        except ScopeError as e:
            return _error(str(e), e.status)
        except OperationError as e:
            return _error(str(e), e.status)
    wrapper.__name__ = view.__name__
    wrapper.__doc__ = view.__doc__
    return wrapper


# ---------------------------------------------------------------- status & scope
@role_required()
def ai_status(request):
    st = ollama.status()
    return JsonResponse({
        **st,
        'starters': intent.STARTERS,
        'operations': {k: v['label'] for k, v in OPERATIONS.items()},
        'options': scope_options(request),
    })


@role_required('Admin')
def ai_model_select(request):
    """Admin picks which installed local Ollama model the assistant uses for everyone ('' = default)"""
    if request.method != 'POST':
        return _error('POST required', 405)
    try:
        data = _body(request)
    except OperationError as e:
        return _error(str(e))
    name = data.get('model', '')
    if not isinstance(name, str):
        return _error('Invalid model name')
    try:
        model = ollama.set_active_model(name)
    except ollama.AIUnavailable as e:
        return _error(str(e))
    log.info('ai model changed by user=%s model=%s', request.user.id, model)
    return JsonResponse(ollama.status(use_cache=False))


# ---------------------------------------------------------------- deterministic analytics (no AI)
@role_required()
@_guard
def ai_analytics(request):
    if request.method != 'POST':
        return _error('POST required', 405)
    data = _body(request)
    scope = _scope_from(request, data)
    result = run_operation(scope, data.get('operation'), data.get('filters') or {})
    return JsonResponse({'result': result})


# ---------------------------------------------------------------- chat
def _conversation_for(request, conv_id):
    if conv_id in (None, ''):
        return None
    conv = AIConversation.objects.filter(id=conv_id, owner=request.user).first()
    if not conv:
        raise ScopeError('Conversation not found', 404)  # also for other users' conversations
    return conv


def _message_json(m):
    return {'id': m.id, 'role': m.role, 'content': m.content, 'operation': m.operation,
            'result': m.result, 'narration': m.narration, 'created_at': m.created_at.isoformat()}


@role_required()
@_guard
def ai_chat(request):
    if request.method != 'POST':
        return _error('POST required', 405)
    cfg = settings.AUDIT_AI
    data = _body(request)
    message = data.get('message')
    if not isinstance(message, str) or not message.strip():
        return _error('Type a question')
    message = message.strip()[:cfg['MAX_MESSAGE_CHARS']]
    if _rate_limited(request, 'chat', cfg['CHAT_LIMIT_PER_MINUTE'], 60):
        return _error('Too many questions in a short time. Please wait a minute.', 429)

    scope = _scope_from(request, data, require_cycle=False)
    conv = _conversation_for(request, data.get('conversation_id'))
    if conv is None:
        conv = AIConversation.objects.create(owner=request.user, cycle=scope.cycle, scope=scope.describe())
    else:
        conv.cycle, conv.scope = scope.cycle, scope.describe()
        conv.save(update_fields=['cycle', 'scope', 'updated_at'])
    AIMessage.objects.create(conversation=conv, role='user', content=message)

    previous = conv.messages.filter(role='assistant', result__isnull=False).exclude(operation='').last()
    reply = {'operation': '', 'content': '', 'result': None, 'narration': None}
    try:
        plan = intent.interpret(message, has_previous_result=previous is not None)
    except ollama.AIUnavailable as e:
        plan = {'operation': 'clarify', 'filters': {}, 'source': 'rules', 'clarification': '',
                'ai_reason': str(e)}

    op = plan['operation']
    want_narration = data.get('narrate', True) is not False
    if op == 'clarify':
        reply['content'] = plan.get('clarification') or (
            'I can summarise the audit, list missing evidence, show pending or overdue corrective actions, '
            'list findings for a criterion, compare with an earlier cycle, or generate a draft report. '
            'Which would you like?' + (f" (The local model could not interpret the question: {plan['ai_reason']})"
                                       if plan.get('ai_reason') else ''))
    elif scope.cycle is None and op != 'explain_previous':
        reply['content'] = 'Please select an audit cycle first, so I know which audit you mean.'
    elif op == 'generate_report':
        reply['operation'] = op
        reply['content'] = ('Use "Generate draft report" below to create the Word, Excel and PDF draft for '
                            + ('this department.' if scope.single_department else 'one department (select a department first).'))
    else:
        if op == 'explain_previous':
            result = previous.result
            if (result.get('scope') or {}).get('department_ids') and not set(result['scope']['department_ids']) <= set(scope.department_ids):
                raise ScopeError('The previous result is outside your current scope')
        else:
            result = run_operation(scope, op, plan['filters'])
        reply.update(operation=op if op != 'explain_previous' else previous.operation, result=result,
                     content=result['title'] + ' - verified figures below.')
        if want_narration:
            # Filled in by ai_message_narrate, so a slow local model never delays the verified figures
            reply['narration'] = {'pending': True, 'question': message} if ollama.status()['available']                 else {'unavailable': ollama.status()['reason']}

    log.info('ai chat user=%s op=%s source=%s', request.user.id, reply['operation'] or op, plan.get('source'))
    msg = AIMessage.objects.create(conversation=conv, role='assistant', content=reply['content'],
                                   operation=reply['operation'], result=reply['result'], narration=reply['narration'])
    return JsonResponse({'conversation_id': conv.id, 'message': _message_json(msg),
                         'interpreted': {'operation': op, 'source': plan.get('source'),
                                         'filters': {k: _jsonable(v) for k, v in plan.get('filters', {}).items()}}})


@role_required()
@_guard
def ai_message_narrate(request, message_id):
    """Explain a stored verified result with the local model (owner only, scope re-checked)"""
    if request.method != 'POST':
        return _error('POST required', 405)
    msg = AIMessage.objects.filter(id=message_id, role='assistant', conversation__owner=request.user).first()
    if not msg or not msg.result:
        raise ScopeError('Message not found', 404)
    if not (msg.narration or {}).get('pending'):
        return JsonResponse({'message': _message_json(msg)})
    stored = msg.result.get('scope') or {}
    scope = resolve_scope(request, department_ids=stored.get('department_ids') or None,
                          cycle_id=stored.get('cycle_id'), require_cycle=False)
    if not set(stored.get('department_ids', [])) <= set(scope.department_ids):
        raise ScopeError('This result is outside your current access')
    try:
        msg.narration = narration.narrate(msg.result, msg.narration.get('question', ''), scope.cache_key())
    except ollama.AIUnavailable as e:
        msg.narration = {'unavailable': str(e)}
    msg.save(update_fields=['narration'])
    return JsonResponse({'message': _message_json(msg)})


@role_required()
@_guard
def ai_conversations(request):
    if request.method == 'GET':
        convs = AIConversation.objects.filter(owner=request.user)[:20]
        return JsonResponse({'conversations': [
            {'id': c.id, 'scope': c.scope, 'updated_at': c.updated_at.isoformat(), 'messages': c.messages.count()} for c in convs]})
    return _error('GET required', 405)


@role_required()
@_guard
def ai_conversation_detail(request, conv_id):
    conv = _conversation_for(request, conv_id)
    if request.method == 'DELETE':
        conv.delete()
        return JsonResponse({'status': 'deleted'})
    return JsonResponse({'id': conv.id, 'scope': conv.scope, 'messages': [_message_json(m) for m in conv.messages.all()]})


# ---------------------------------------------------------------- reports
def _report_json(r):
    return {
        'id': r.id, 'status': r.status, 'error': r.error,
        'department': f"{r.department.institute.code} - {r.department.code}", 'cycle': str(r.cycle),
        'compare_cycle': str(r.compare_cycle) if r.compare_cycle else None, 'filters': r.filters,
        'include_narration': r.include_narration, 'formats': sorted(r.files) if r.status == 'done' else [],
        'data_as_of': r.data_as_of.isoformat() if r.data_as_of else None,
        'created_at': r.created_at.isoformat(), 'finished_at': r.finished_at.isoformat() if r.finished_at else None,
        'review_status': 'Draft - requires auditor review',
    }


@role_required()
@_guard
def ai_reports(request):
    if request.method == 'GET':
        jobs.recover()
        qs = AIReport.objects.filter(owner=request.user).select_related('department__institute', 'cycle', 'compare_cycle')[:20]
        return JsonResponse({'reports': [_report_json(r) for r in qs]})
    if request.method != 'POST':
        return _error('GET or POST required', 405)
    data = _body(request)
    if data.get('department_id') in (None, ''):
        return _error('Select one department for the report')
    scope = _scope_from(request, data)
    _, filters = validate_request('generate_report', {k: data.get(k) for k in ('compare_cycle_id', 'criterion') if data.get(k) not in (None, '')})
    if _rate_limited(request, 'report', settings.AUDIT_AI['REPORT_LIMIT_PER_HOUR'], 3600):
        return _error('Report limit reached for this hour. Please try again later.', 429)
    report = AIReport.objects.create(
        owner=request.user, department=scope.single_department, cycle=scope.cycle,
        compare_cycle=filters['compare_cycle_id'], filters={'criterion': filters['criterion']},
        include_narration=bool(data.get('include_narration')),
    )
    reports.start_report(report)
    report.refresh_from_db()
    return JsonResponse({'report': _report_json(report)}, status=202)


def _owned_report(request, report_id):
    r = AIReport.objects.filter(id=report_id, owner=request.user).select_related('department__institute', 'cycle', 'compare_cycle').first()
    if not r:
        raise ScopeError('Report not found', 404)
    return r


@role_required()
@_guard
def ai_report_detail(request, report_id):
    jobs.recover()
    r = _owned_report(request, report_id)
    if request.method == 'DELETE':
        reports.delete_report_files(r)
        r.delete()
        return JsonResponse({'status': 'deleted'})
    return JsonResponse({'report': _report_json(r)})


@role_required()
@_guard
def ai_report_download(request, report_id, fmt):
    r = _owned_report(request, report_id)
    if fmt not in reports.FORMATS or r.status != 'done' or fmt not in r.files:
        return _error('This report file is not available', 404)
    # The owner must still be allowed to see the department today
    resolve_scope(request, department_id=r.department_id, cycle_id=r.cycle_id)
    try:
        path = reports.report_path(r.files[fmt])
        handle = open(path, 'rb')
    except (OSError, ValueError):
        return _error('The report file has expired or was removed', 404)
    content_type, ext = reports.FORMATS[fmt]
    name = f"DRAFT_{r.department.institute.code}_{r.department.code}_audit_report.{ext}".replace(' ', '').replace('&', 'and')
    resp = FileResponse(handle, as_attachment=True, filename=name, content_type=content_type)
    resp['Cache-Control'] = 'no-store'
    return resp
