"""Security fixes before deployment. Synthetic fixtures only."""
import json
import re
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings

from .auth_utils import create_or_update_auditor_user, generate_password, must_change_password, set_must_change
from .models import ActionTakenReport, Auditor, Department
from .test_ai_assistant import AIAssistantBase


class PasswordTests(AIAssistantBase):
    def test_generated_passwords_are_random_and_strong(self):
        pwds = {generate_password() for _ in range(50)}
        self.assertEqual(len(pwds), 50)
        for p in pwds:
            self.assertGreaterEqual(len(p), 14)
            self.assertTrue(re.search(r'[a-z]', p) and re.search(r'[A-Z]', p) and re.search(r'\d', p))

    def test_new_login_gets_random_password_and_must_change(self):
        aud = Auditor.objects.create(name='Dr. New Person', institute=self.ca, dept_name='EE')
        username, pwd = create_or_update_auditor_user(aud)
        self.assertNotIn('Person', pwd)
        user = User.objects.get(username=username)
        self.assertTrue(user.check_password(pwd))
        self.assertTrue(must_change_password(user))
        # Re-provisioning an existing login keeps its password
        self.assertEqual(create_or_update_auditor_user(aud)[1], None)
        user.refresh_from_db()
        self.assertTrue(user.check_password(pwd))

    def test_must_change_blocks_api_until_changed(self):
        self.hod_a1.set_password('Old-pass-123')
        self.hod_a1.save()
        set_must_change(self.hod_a1, True)
        self.login(self.hod_a1)
        r = self.client.get(f'/api/criterion-summary/?department_id={self.a1.id}&cycle_id={self.cur.id}')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(r.json()['password_change_required'])
        self.assertTrue(self.client.get('/api/auth/me/').json()['user']['must_change_password'])
        # Wrong current password / weak new password refused
        self.assertEqual(self.post('/api/auth/change-password/', {'current_password': 'x', 'new_password': 'Good-pass-9876'}).status_code, 400)
        self.assertEqual(self.post('/api/auth/change-password/', {'current_password': 'Old-pass-123', 'new_password': '1234567890'}).status_code, 400)
        r = self.post('/api/auth/change-password/', {'current_password': 'Old-pass-123', 'new_password': 'Good-pass-9876'})
        self.assertEqual(r.json()['status'], 'success')
        self.assertFalse(r.json()['user']['must_change_password'])
        r = self.client.get(f'/api/criterion-summary/?department_id={self.a1.id}&cycle_id={self.cur.id}')
        self.assertEqual(r.status_code, 200)

    def test_rotate_passwords_command(self):
        with TemporaryDirectory() as tmp:
            out = Path(tmp) / 'login.md'
            call_command('rotate_passwords', '--yes', f'--output={out}', stdout=StringIO())
            text = out.read_text(encoding='utf-8')
        self.assertIn('CONFIDENTIAL', text)
        self.assertIn(self.hod_a1.username if self.hod_a1.username.startswith('hod.') else 'hod.ca.me', text)
        self.assertTrue(must_change_password(User.objects.get(id=self.admin.id)))
        aud = Auditor.objects.get(id=self.auditor.id)
        self.assertTrue(aud.user.check_password(aud.initial_password))


class LoginLockoutTests(AIAssistantBase):
    @override_settings(AUDIT_LOGIN_MAX_FAILURES=3, AUDIT_LOGIN_LOCKOUT_MINUTES=15)
    def test_lockout_after_failures_even_with_right_password(self):
        self.hod_a1.set_password('Right-pass-123')
        self.hod_a1.save()
        for _ in range(3):
            r = self.post('/api/auth/login/', {'username': 'hod_a1', 'password': 'wrong'})
            self.assertEqual(r.status_code, 401)
        r = self.post('/api/auth/login/', {'username': 'hod_a1', 'password': 'Right-pass-123'})
        self.assertEqual(r.status_code, 429)
        cache.clear()
        r = self.post('/api/auth/login/', {'username': 'hod_a1', 'password': 'Right-pass-123'})
        self.assertEqual(r.status_code, 200)


class RequestHandlingTests(AIAssistantBase):
    def test_malformed_json_is_400_not_500(self):
        for body in ('{not json', '[1, 2]', '"text"'):
            r = self.client.post('/api/auth/login/', body, content_type='application/json')
            self.assertEqual(r.status_code, 400, body)
            self.assertIn('error', r.json())
        self.login(self.admin)
        r = self.client.post('/api/assignments/save/', '{bad', content_type='application/json')
        self.assertEqual(r.status_code, 400)

    def test_no_wildcard_cors_header(self):
        r = self.client.get('/api/auth/me/')
        self.assertNotIn('Access-Control-Allow-Origin', r)

    def test_admin_disabled_by_default(self):
        self.assertEqual(self.client.get('/admin/').status_code, 404)


class ExportSafetyTests(AIAssistantBase):
    def setUp(self):
        super().setUp()
        self.atr_a1.root_cause = '=HYPERLINK("http://evil.test","click")'
        self.atr_a1.action_plan = '<script>alert(1)</script>'
        self.atr_a1.save()

    def test_csv_formulas_escaped(self):
        self.login(self.admin)
        r = self.client.get(f'/api/export/department-excel/?department_id={self.a1.id}&cycle_id={self.cur.id}')
        body = r.content.decode('utf-8')
        self.assertIn("'=HYPERLINK", body)
        self.assertNotIn(',=HYPERLINK', body)

    def test_pdf_page_escapes_user_text(self):
        self.login(self.admin)
        r = self.client.get(f'/api/export/department-pdf/?department_id={self.a1.id}&cycle_id={self.cur.id}')
        body = r.content.decode('utf-8')
        self.assertNotIn('<script>alert(1)</script>', body)
        self.assertIn('&lt;script&gt;', body)

    def test_hidden_columns_withheld_everywhere_for_hod(self):
        self.cur.visible_columns = {'percentage': False, 'grade': False, 'marksObtained': False}
        self.cur.save()
        self.login(self.hod_a1)
        q = f'department_id={self.a1.id}&cycle_id={self.cur.id}'
        summary = self.client.get(f'/api/criterion-summary/?{q}').json()
        self.assertIsNone(summary['totals']['percentage'])
        self.assertIsNone(summary['rows'][0]['grade'])
        atr = self.client.get(f'/api/atr/?{q}').json()['atrs'][0]
        self.assertIsNone(atr['grade'])
        self.assertIsNone(atr['percentage'])
        csv_body = self.client.get(f'/api/export/department-excel/?{q}').content.decode('utf-8')
        self.assertIn('Hidden', csv_body)
        self.assertNotIn('85.0', csv_body)
        pdf_body = self.client.get(f'/api/export/department-pdf/?{q}').content.decode('utf-8')
        self.assertIn('Hidden', pdf_body)
        ai = self.post('/api/ai/analytics/', {'operation': 'audit_summary', 'cycle_id': self.cur.id}).json()
        self.assertIsNone(ai['result']['totals']['percentage'])
        self.assertIn('percentage', ai['result']['withheld'])
        # The Admin still sees everything
        self.login(self.admin)
        self.assertIsNotNone(self.client.get(f'/api/criterion-summary/?{q}').json()['totals']['percentage'])


class NeutralEvidenceDefaultTests(AIAssistantBase):
    def test_new_evaluation_is_not_verified_by_default(self):
        self.login(self.admin)
        r = self.post('/api/evaluations/save/', {'department_id': self.a2.id, 'cycle_id': self.cur.id,
                                                 'metric_id': self.m['1.1.a'].id, 'items_checked': 10, 'valid_items': 9})
        self.assertEqual(r.json()['status'], 'success')
        from .models import AuditEvaluation
        ev = AuditEvaluation.objects.get(department=self.a2, cycle=self.cur, metric=self.m['1.1.a'])
        self.assertEqual(ev.physical_check_result, 'Not checked')
        self.assertEqual(ev.evidence_status, 'Not Uploaded')
