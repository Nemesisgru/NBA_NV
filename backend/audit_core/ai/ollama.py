"""Backend-only adapter for a locally hosted Ollama server.

* The URL and model come from settings.AUDIT_AI only; users cannot supply them.
* The URL must point to this machine or a private network address.
* Calls are bounded by timeouts, a process-wide concurrency limit and output/context limits.
* Nothing here logs prompts or model output.
"""
import ipaddress
import json
import logging
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache

log = logging.getLogger('audit_core.ai')


class AIUnavailable(Exception):
    """The local model cannot be used right now (disabled, unreachable, missing model, timeout, bad output)"""


def config():
    return settings.AUDIT_AI


_semaphore = None
_semaphore_lock = threading.Lock()


def _slots():
    global _semaphore
    with _semaphore_lock:
        if _semaphore is None:
            _semaphore = threading.BoundedSemaphore(max(1, config()['MAX_CONCURRENCY']))
        return _semaphore


def base_url():
    """The configured Ollama URL, refused unless it is local or on a private network"""
    url = config()['OLLAMA_URL'].rstrip('/')
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise AIUnavailable('The configured local model URL is invalid.')
    host = parsed.hostname
    if host != 'localhost':
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            raise AIUnavailable('The local model URL must use localhost or a private IP address.')
        if not (ip.is_loopback or ip.is_private):
            raise AIUnavailable('The local model URL must point to this machine or a private network.')
    return url


def _request(path, payload=None, timeout=5.0):
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(base_url() + path, data=data, method='POST' if data else 'GET',
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (URL validated in base_url)
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise AIUnavailable(f'The local model server returned an error ({e.code}).')
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        if 'timed out' in str(e).lower() or isinstance(e, TimeoutError):
            raise AIUnavailable('The local model did not respond in time.')
        raise AIUnavailable('The local model server (Ollama) is not reachable.')
    except ValueError:
        raise AIUnavailable('The local model server sent an unreadable response.')


def status(use_cache=True):
    """{'enabled', 'available', 'model', 'reason'}; cached briefly so the UI can poll it cheaply"""
    cfg = config()
    if not cfg['ENABLED']:
        return {'enabled': False, 'available': False, 'model': cfg['MODEL'], 'reason': 'The AI assistant is disabled by the administrator.'}
    key = 'audit-ai-status'
    if use_cache and (cached := cache.get(key)):
        return cached
    try:
        tags = _request('/api/tags', timeout=cfg['CONNECT_TIMEOUT'])
        names = {m.get('name') for m in tags.get('models', [])} | {m.get('model') for m in tags.get('models', [])}
        if cfg['MODEL'] in names:
            result = {'enabled': True, 'available': True, 'model': cfg['MODEL'], 'reason': ''}
        else:
            result = {'enabled': True, 'available': False, 'model': cfg['MODEL'],
                      'reason': f"The configured model '{cfg['MODEL']}' is not installed in Ollama."}
    except AIUnavailable as e:
        result = {'enabled': True, 'available': False, 'model': cfg['MODEL'], 'reason': str(e)}
    cache.set(key, result, 30)
    return result


def chat_json(system, user, schema, num_predict=None):
    """One non-streaming chat call constrained to a JSON schema. Returns the parsed object (untrusted)."""
    cfg = config()
    if not cfg['ENABLED']:
        raise AIUnavailable('The AI assistant is disabled by the administrator.')
    slots = _slots()
    if not slots.acquire(timeout=2):
        raise AIUnavailable('The local model is busy with another request. Please try again shortly.')
    started = time.monotonic()
    try:
        payload = {
            'model': cfg['MODEL'],
            'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
            'stream': False,
            'format': schema,
            'think': False,
            'keep_alive': cfg['KEEP_ALIVE'],
            'options': {
                'temperature': 0.1,
                'num_ctx': cfg['NUM_CTX'],
                'num_predict': num_predict or cfg['NUM_PREDICT'],
            },
        }
        data = _request('/api/chat', payload, timeout=cfg['RESPONSE_TIMEOUT'])
        content = (data.get('message') or {}).get('content', '')
        try:
            parsed = json.loads(content)
        except ValueError:
            raise AIUnavailable('The local model returned output that is not valid JSON.')
        if not isinstance(parsed, dict):
            raise AIUnavailable('The local model returned output in an unexpected shape.')
        log.info('ollama call ok model=%s seconds=%.1f', cfg['MODEL'], time.monotonic() - started)
        return parsed
    except AIUnavailable as e:
        log.warning('ollama call failed model=%s seconds=%.1f reason=%s', cfg['MODEL'], time.monotonic() - started, e)
        raise
    finally:
        slots.release()
