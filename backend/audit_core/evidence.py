"""Evidence files per question: upload, list, protected download, delete, text extraction and search.

Who may do what (same department scoping as the rest of the app):
  * view / download: anyone who may see the department (Admin, allocated Auditor, the HOD);
  * upload: Admin, or the HOD of the department (the department supplies its evidence);
  * delete: Admin, or the user who uploaded the file.
Uploading a file never changes the auditor's evidence status, verification, scores or compliance.
"""
import hashlib
import json
import logging
import os
import re
import subprocess
import sys
import uuid
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, JsonResponse

from .models import AuditCycle, Department, EvidenceChunk, EvidenceFile, MetricItem
from .permissions import can_view_department, role_required, forbidden
from .question_scope import is_metric_in_cycle

log = logging.getLogger('audit_core.ai')

MAGIC = {'pdf': b'%PDF-', 'docx': b'PK\x03\x04'}
CONTENT_TYPES = {'pdf': 'application/pdf',
                 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}


def cfg():
    return settings.AUDIT_EVIDENCE


def storage_dir():
    os.makedirs(cfg()['DIR'], exist_ok=True)
    return os.path.realpath(cfg()['DIR'])


def stored_path(name):
    base = storage_dir()
    full = os.path.realpath(os.path.join(base, os.path.basename(name)))
    if not full.startswith(base + os.sep):
        raise ValueError('Invalid evidence file')
    return full


def can_upload(request, department):
    if request.role == 'Admin':
        return True
    return request.role == 'HOD' and request.user.hod_department.id == department.id


def can_delete(request, ev):
    return request.role == 'Admin' or (ev.uploaded_by_id == request.user.id)


def file_json(ev, request=None):
    return {
        'id': ev.id, 'ref': f'EV-{ev.id}', 'name': ev.original_name, 'type': ev.file_type, 'size': ev.size,
        'question': ev.metric.code, 'criterion': ev.metric.criterion.code, 'metric_id': ev.metric_id,
        'uploaded_at': ev.uploaded_at.isoformat(), 'uploaded_by': ev.uploaded_by.get_username() if ev.uploaded_by else '',
        'extraction': ev.status, 'extraction_note': ev.status_note, 'page_count': ev.page_count,
        'can_delete': bool(request and can_delete(request, ev)),
    }


def files_for(department_id, cycle_id, metric_ids=None):
    qs = EvidenceFile.objects.filter(department_id=department_id, cycle_id=cycle_id).select_related('metric__criterion', 'uploaded_by')
    return qs.filter(metric_id__in=metric_ids) if metric_ids is not None else qs


# ---------------------------------------------------------------- views
def _target(request, data):
    try:
        dept = Department.objects.filter(id=int(data.get('department_id'))).first()
        cycle = AuditCycle.objects.filter(id=int(data.get('cycle_id'))).first()
    except (TypeError, ValueError):
        return None, None, JsonResponse({'error': 'department_id and cycle_id required'}, status=400)
    if not dept or not cycle:
        return None, None, JsonResponse({'error': 'Department or cycle not found'}, status=404)
    if not can_view_department(request, dept.id):
        return None, None, forbidden()
    return dept, cycle, None


@role_required()
def evidence_list(request):
    dept, cycle, err = _target(request, request.GET)
    if err:
        return err
    qs = files_for(dept.id, cycle.id)
    if request.GET.get('metric_id'):
        qs = qs.filter(metric_id=request.GET.get('metric_id'))
    return JsonResponse({'files': [file_json(e, request) for e in qs], 'can_upload': can_upload(request, dept),
                         'max_mb': cfg()['MAX_MB'], 'types': cfg()['TYPES']})


@role_required()
def evidence_upload(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    dept, cycle, err = _target(request, request.POST)
    if err:
        return err
    if not can_upload(request, dept):
        return forbidden('Only the Head of Department or the Admin can upload evidence for this department')
    metric = MetricItem.objects.filter(id=request.POST.get('metric_id'), is_header=False).first()
    if not metric or not is_metric_in_cycle(metric, cycle.id):
        return JsonResponse({'error': 'This question is not part of the audit'}, status=400)
    upload = request.FILES.get('file')
    if not upload:
        return JsonResponse({'error': 'Choose a file'}, status=400)
    ext = Path(upload.name).suffix.lower().lstrip('.')
    if ext not in cfg()['TYPES']:
        return JsonResponse({'error': f"Only {', '.join(t.upper() for t in cfg()['TYPES'])} files are accepted"}, status=400)
    if upload.size > cfg()['MAX_MB'] * 1024 * 1024:
        return JsonResponse({'error': f"The file is larger than {cfg()['MAX_MB']} MB"}, status=400)
    head = upload.read(8)
    upload.seek(0)
    if not head.startswith(MAGIC[ext]):
        return JsonResponse({'error': f'The file content is not a valid {ext.upper()} file'}, status=400)

    stored = f'{uuid.uuid4().hex}.{ext}'
    digest = hashlib.sha256()
    with open(stored_path(stored), 'wb') as out:
        for chunk in upload.chunks():
            digest.update(chunk)
            out.write(chunk)
    safe_name = re.sub(r'[^\w.\- ()]', '_', os.path.basename(upload.name))[:200]
    ev = EvidenceFile.objects.create(department=dept, cycle=cycle, metric=metric, uploaded_by=request.user,
                                     original_name=safe_name, stored_name=stored, file_type=ext, size=upload.size,
                                     sha256=digest.hexdigest())
    log.info('evidence uploaded id=%s type=%s size=%s', ev.id, ext, upload.size)
    from .ai import jobs
    jobs.kick()
    ev.refresh_from_db()
    return JsonResponse({'file': file_json(ev, request)}, status=201)


@role_required()
def evidence_detail(request, evidence_id):
    ev = EvidenceFile.objects.filter(id=evidence_id).select_related('metric__criterion', 'uploaded_by').first()
    if not ev or not can_view_department(request, ev.department_id):
        return JsonResponse({'error': 'Evidence not found'}, status=404)
    if request.method == 'DELETE':
        if not can_delete(request, ev):
            return forbidden('Only the uploader or the Admin can delete this file')
        name = ev.stored_name
        ev.delete()
        try:
            os.remove(stored_path(name))
        except (OSError, ValueError):
            pass
        return JsonResponse({'status': 'deleted'})
    from .ai import jobs
    jobs.recover()
    return JsonResponse({'file': file_json(ev, request)})


@role_required()
def evidence_download(request, evidence_id):
    ev = EvidenceFile.objects.filter(id=evidence_id).first()
    if not ev or not can_view_department(request, ev.department_id):
        return JsonResponse({'error': 'Evidence not found'}, status=404)
    try:
        handle = open(stored_path(ev.stored_name), 'rb')
    except (OSError, ValueError):
        return JsonResponse({'error': 'The file is no longer available'}, status=404)
    resp = FileResponse(handle, as_attachment=True, filename=ev.original_name, content_type=CONTENT_TYPES[ev.file_type])
    resp['Cache-Control'] = 'no-store'
    resp['X-Content-Type-Options'] = 'nosniff'
    return resp


# ---------------------------------------------------------------- extraction job
def run_extraction(evidence_id):
    """Extract text in an isolated subprocess with a timeout; job already claimed (status 'running')"""
    ev = EvidenceFile.objects.get(id=evidence_id)
    worker = Path(__file__).with_name('extract_worker.py')
    try:
        proc = subprocess.run(
            [sys.executable, '-I', str(worker), ev.file_type, stored_path(ev.stored_name),
             str(cfg()['MAX_PAGES']), str(cfg()['MAX_TEXT_CHARS'])],
            capture_output=True, timeout=cfg()['EXTRACT_TIMEOUT'], check=False,
        )
        result = json.loads(proc.stdout.decode('utf-8') or '{}')
    except subprocess.TimeoutExpired:
        result = {'status': 'manual', 'chunks': [], 'note': 'Text extraction took too long; manual verification required.'}
    except (ValueError, OSError):
        result = {'status': 'failed', 'chunks': [], 'note': 'Text extraction failed.'}
    status = result.get('status') if result.get('status') in ('done', 'manual', 'failed') else 'failed'
    with transaction.atomic():
        EvidenceChunk.objects.filter(evidence=ev).delete()
        EvidenceChunk.objects.bulk_create([
            EvidenceChunk(evidence=ev, order=i, location=str(c.get('location', ''))[:120], text=str(c.get('text', ''))[:2000])
            for i, c in enumerate(result.get('chunks') or [])
        ])
        ev.status = status
        ev.status_note = str(result.get('note') or '')[:300]
        ev.page_count = result.get('page_count')
        ev.text_chars = sum(len(str(c.get('text', ''))) for c in result.get('chunks') or [])
        ev.save(update_fields=['status', 'status_note', 'page_count', 'text_chars'])
    log.info('evidence extraction id=%s status=%s', ev.id, status)


# ---------------------------------------------------------------- search (used by the assistant)
STOP = {'the', 'and', 'for', 'with', 'what', 'does', 'say', 'about', 'evidence', 'document', 'documents', 'find',
        'search', 'show', 'any', 'are', 'this', 'that', 'from', 'files', 'file', 'uploaded', 'which', 'where', 'there',
        'mention', 'mentions', 'contain', 'contains', 'have', 'has', 'into', 'our', 'their', 'please', 'list'}


def query_terms(query):
    return [w for w in re.findall(r'[a-z0-9]{3,}', (query or '').lower()) if w not in STOP][:8]


def search_evidence(department_ids, cycle, query, metric_ids, criterion=None, limit=10):
    """Keyword search over extracted text of authorised evidence (no vector database)"""
    terms = query_terms(query)
    qs = EvidenceChunk.objects.filter(evidence__department_id__in=department_ids, evidence__cycle=cycle,
                                      evidence__metric_id__in=metric_ids, evidence__status='done')
    if criterion:
        qs = qs.filter(evidence__metric__criterion__code=criterion)
    if not terms:
        return terms, []
    from django.db.models import Q
    cond = Q()
    for t in terms:
        cond |= Q(text__icontains=t)
    scored = []
    for c in qs.filter(cond).select_related('evidence__metric__criterion', 'evidence__department__institute')[:400]:
        low = c.text.lower()
        score = sum(low.count(t) for t in terms) + 3 * sum(1 for t in terms if t in low)
        first = min((low.find(t) for t in terms if t in low), default=0)
        start = max(0, first - 120)
        scored.append((score, c, c.text[start:start + 320]))
    scored.sort(key=lambda x: -x[0])
    return terms, scored[:limit]
