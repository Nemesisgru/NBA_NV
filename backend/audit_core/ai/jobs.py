"""Database-backed background jobs (draft reports, evidence text extraction).

Jobs are rows with status pending / running / done / failed (/ manual for evidence). They survive
restarts because their state lives in the database:
  * claim() moves a job from pending to running atomically, so it never runs twice;
  * requeue_stale() returns jobs stuck in 'running' (e.g. after a server restart) to 'pending',
    up to JOB_MAX_ATTEMPTS, then marks them failed;
  * kick() starts an in-process worker thread when there is work; it is called when jobs are created
    and whenever their status is requested, so pending work resumes after a restart;
  * `python manage.py run_ai_jobs` runs the same loop as a separate, long-running worker process.
"""
import logging
import threading
from datetime import timedelta

from django.conf import settings
from django.db import close_old_connections
from django.db.models import F
from django.utils import timezone

from ..models import AIReport, EvidenceFile

log = logging.getLogger('audit_core.ai')

_lock = threading.Lock()
_worker = None


def _handlers():
    from ..evidence import run_extraction
    from .reports import run_report
    return ((AIReport, run_report), (EvidenceFile, run_extraction))


def claim(model, pk):
    return model.objects.filter(pk=pk, status='pending').update(
        status='running', started_at=timezone.now(), attempts=F('attempts') + 1) == 1


def requeue_stale():
    cfg = settings.AUDIT_AI
    cutoff = timezone.now() - timedelta(minutes=cfg['JOB_STALE_MINUTES'])
    changed = 0
    for model, _ in _handlers():
        stale = model.objects.filter(status='running', started_at__lt=cutoff)
        changed += stale.filter(attempts__lt=cfg['JOB_MAX_ATTEMPTS']).update(status='pending')
        failed = stale.filter(attempts__gte=cfg['JOB_MAX_ATTEMPTS'])
        if model is AIReport:
            changed += failed.update(status='failed', error='The report job did not finish after several attempts.')
        else:
            changed += failed.update(status='failed', status_note='Text extraction did not finish after several attempts.')
    return changed


def has_pending():
    return any(model.objects.filter(status='pending').exists() for model, _ in _handlers())


def process_pending(limit=50):
    """Run pending jobs until none are left (or `limit` jobs ran). Returns the number processed."""
    requeue_stale()
    done = 0
    while done < limit:
        progressed = False
        for model, handler in _handlers():
            for pk in model.objects.filter(status='pending').order_by('id').values_list('id', flat=True)[:5]:
                if claim(model, pk):
                    try:
                        handler(pk)
                    except Exception:  # noqa: BLE001 - handlers record their own failures
                        log.exception('job crashed model=%s id=%s', model.__name__, pk)
                        model.objects.filter(pk=pk, status='running').update(status='failed')
                    done += 1
                    progressed = True
        if not progressed:
            break
    return done


def _loop():
    try:
        process_pending()
    finally:
        close_old_connections()


def kick():
    """Make sure pending jobs get processed: inline in tests, otherwise by one worker thread per process"""
    if settings.AUDIT_AI.get('REPORTS_INLINE'):
        process_pending()
        return
    global _worker
    with _lock:
        if _worker is not None and _worker.is_alive():
            return
        _worker = threading.Thread(target=_loop, daemon=True, name='audit-ai-jobs')
        _worker.start()


def recover():
    """Called on status requests: retry stuck jobs and resume pending work (e.g. after a restart)"""
    requeue_stale()
    if has_pending():
        kick()
