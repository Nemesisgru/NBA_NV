"""College Head ("Coll Head"): read-only access to every department of one college. Synthetic fixtures only."""
from .auth_utils import create_or_update_college_head_user, set_must_change
from .models import Institute
from .test_ai_assistant import AIAssistantBase


class CollegeHeadTests(AIAssistantBase):
    def setUp(self):
        super().setUp()
        username, _ = create_or_update_college_head_user(self.ca)
        self.ca.refresh_from_db()
        self.head = self.ca.head_user
        set_must_change(self.head, False)
        self.login(self.head)

    def test_role_and_scope(self):
        me = self.client.get('/api/auth/me/').json()['user']
        self.assertEqual(me['role'], 'CollegeHead')
        self.assertEqual(me['college_head_info']['institute_code'], 'CA')
        boot = self.client.get('/api/bootstrap/').json()
        self.assertEqual({d['id'] for d in boot['departments']}, {self.a1.id, self.a2.id})
        self.assertEqual([i['code'] for i in boot['institutes']], ['CA'])
        self.assertEqual(boot['auditors'], [])  # no auditor pool / credentials
        self.assertNotIn('head_username', boot['institutes'][0])

    def test_can_view_own_college_only(self):
        q = f'cycle_id={self.cur.id}'
        self.assertEqual(self.client.get(f'/api/criterion-summary/?department_id={self.a2.id}&{q}').status_code, 200)
        self.assertEqual(self.client.get(f'/api/criterion-summary/?department_id={self.b1.id}&{q}').status_code, 403)
        self.assertEqual(self.client.get(f'/api/criteria/C1/?department_id={self.a1.id}&{q}').json()['can_edit'], False)
        r = self.client.get(f'/api/comparison/?department_ids={self.a1.id}&department_ids={self.a2.id}&{q}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()['departments']), 2)
        r = self.client.get(f'/api/comparison/?department_ids={self.a1.id}&department_ids={self.b1.id}&{q}')
        self.assertEqual(r.status_code, 403)
        dash = self.client.get(f'/api/dashboard/?{q}').json()
        self.assertEqual([i['institute_code'] for i in dash['institutes']], ['CA'])
        atrs = self.client.get(f'/api/atr/?{q}').json()['atrs']
        self.assertTrue(atrs)
        self.assertTrue(all(a['institute_code'] == 'CA' for a in atrs))
        ai = self.post('/api/ai/analytics/', {'operation': 'audit_summary', 'cycle_id': self.cur.id}).json()
        self.assertEqual(ai['result']['scope']['department_count'], 2)
        self.assertEqual(self.post('/api/ai/analytics/', {'operation': 'audit_summary', 'cycle_id': self.cur.id,
                                                          'department_id': self.b1.id}).status_code, 403)

    def test_view_only_and_no_admin_functions(self):
        r = self.post('/api/atr/update/', {'atr_id': self.atr_a1.id, 'root_cause': 'changed'})
        self.assertEqual(r.status_code, 403)
        self.atr_a1.refresh_from_db()
        self.assertNotEqual(self.atr_a1.root_cause, 'changed')
        r = self.post('/api/evaluations/save/', {'department_id': self.a1.id, 'cycle_id': self.cur.id,
                                                 'metric_id': self.m['1.1.a'].id, 'items_checked': 1, 'valid_items': 1})
        self.assertEqual(r.status_code, 403)
        for url in ('/api/assignments/?cycle_id=1', '/api/cycle-questions/?cycle_id=1'):
            self.assertEqual(self.client.get(url).status_code, 403, url)
        self.assertEqual(self.post('/api/assignments/save/', {'department_id': self.a1.id, 'cycle_id': self.cur.id}).status_code, 403)
        self.assertEqual(self.post('/api/cycle-questions/save/', {'cycle_id': self.cur.id}).status_code, 403)

    def test_hidden_columns_apply_to_college_head(self):
        self.cur.visible_columns = {'percentage': False, 'grade': False}
        self.cur.save()
        r = self.client.get(f'/api/comparison/?department_ids={self.a1.id}&cycle_id={self.cur.id}').json()
        self.assertIsNone(r['departments'][0]['overall_pct'])
        self.assertTrue(all(v is None for v in r['departments'][0]['scores']))
        dash = self.client.get(f'/api/dashboard/?cycle_id={self.cur.id}').json()
        self.assertIsNone(dash['institutes'][0]['average_pct'])

    def test_admin_manages_head_login(self):
        self.login(self.admin)
        boot = self.client.get('/api/bootstrap/').json()
        ca = {i['code']: i for i in boot['institutes']}['CA']
        self.assertEqual(ca['head_username'], 'head.ca')
        r = self.post('/api/college-heads/save/', {'institute_id': self.cb.id, 'head_name': 'Dr. Head B',
                                                    'head_email': 'head@cb.test'})
        self.assertEqual(r.json()['institute']['head_username'], 'head.cb')
        self.assertEqual(r.json()['institute']['head_password_status'], 'pending')
        pwd = self.post('/api/accounts/password/', {'kind': 'college_head', 'id': self.cb.id, 'action': 'reveal'}).json()['password']
        self.assertTrue(Institute.objects.get(id=self.cb.id).head_user.check_password(pwd))
        self.assertEqual(self.post('/api/college-heads/save/', {'institute_id': self.cb.id, 'head_email': 'bad'}).status_code, 400)
