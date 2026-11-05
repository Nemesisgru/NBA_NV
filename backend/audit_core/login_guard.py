"""Limit password guessing on the login page and Django Admin.

After AUDIT_LOGIN_MAX_FAILURES failed logins for one username (or 5x that from one network address)
within AUDIT_LOGIN_LOCKOUT_MINUTES, further attempts are refused until the period ends. Counters live
in the database cache, so they survive restarts and are shared by every server process.
"""
import logging

from django.conf import settings
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.core.cache import cache
from django.core.exceptions import PermissionDenied
from django.dispatch import receiver

log = logging.getLogger('audit_core.security')

IP_FACTOR = 5  # an office shares one address, so it gets a higher limit than a single username


def client_ip(request):
    if request is None:
        return ''
    if getattr(settings, 'SECURE_PROXY_SSL_HEADER', None):
        # Behind our own proxy: the last address it appended is the real client
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded:
            return forwarded.split(',')[-1].strip()
    return request.META.get('REMOTE_ADDR', '')


def _keys(username, request):
    user_key = f"login-fail:u:{(username or '').strip().lower()}"
    ip = client_ip(request)
    return user_key, (f'login-fail:ip:{ip}' if ip else None)


def _window():
    return settings.AUDIT_LOGIN_LOCKOUT_MINUTES * 60


def is_locked(username, request):
    user_key, ip_key = _keys(username, request)
    limit = settings.AUDIT_LOGIN_MAX_FAILURES
    if (cache.get(user_key) or 0) >= limit:
        return True
    return bool(ip_key) and (cache.get(ip_key) or 0) >= limit * IP_FACTOR


def _bump(key):
    if not key:
        return
    if cache.add(key, 1, _window()):
        return
    try:
        cache.incr(key)
    except ValueError:  # expired between add and incr
        cache.set(key, 1, _window())


class LockoutModelBackend(ModelBackend):
    """The normal username/password check, refused while the username or address is locked"""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(self._user_model_field())
        if is_locked(username, request):
            raise PermissionDenied('Too many failed logins')
        return super().authenticate(request, username=username, password=password, **kwargs)

    @staticmethod
    def _user_model_field():
        from django.contrib.auth import get_user_model
        return get_user_model().USERNAME_FIELD


@receiver(user_login_failed)
def _record_failure(sender, credentials, request=None, **kwargs):
    username = credentials.get('username', '')
    user_key, ip_key = _keys(username, request)
    _bump(user_key)
    _bump(ip_key)
    # Username only (never the password); helps spot guessing in the server log
    log.warning('failed login username=%s ip=%s', username[:150], client_ip(request))


@receiver(user_logged_in)
def _clear_failures(sender, request, user, **kwargs):
    cache.delete(_keys(user.get_username(), request)[0])
