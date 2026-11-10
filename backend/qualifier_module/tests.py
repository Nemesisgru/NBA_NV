import json
from datetime import date
from io import BytesIO

import openpyxl
from django.test import Client, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from .models import (
    QualifierChecklistItem,
    QualifierDepartment,
    QualifierFacultyMember,
    QualifierPrimaryCheckMetrics,
    QualifierProgram,
    QualifierProgramMapping,
)
from .services import get_or_create_college
from .views import FACULTY_EXCEL_COLUMNS, calculate_faculty_experience


class QualifierCollegeSetupTests(TestCase):
    def test_new_college_starts_with_two_blank_department_and_mapping_rows(self):
        college = get_or_create_college("Qualifier setup test college")

        departments = list(QualifierDepartment.objects.filter(college=college))
        mappings = list(QualifierProgramMapping.objects.filter(college=college))

        self.assertEqual(len(departments), 2)
        self.assertEqual([department.sno for department in departments], [1, 2])
        self.assertTrue(all(not department.department_name for department in departments))
        self.assertEqual(len(mappings), 2)
        self.assertTrue(all(not mapping.master_program_name for mapping in mappings))
        self.assertEqual(QualifierProgram.objects.filter(college=college).count(), 0)

    def test_faculty_template_and_bulk_upload_calculate_experience(self):
        client = Client()
        create_response = client.post(
            "/api/qualifiers/colleges/create/",
            data=json.dumps({
                "institution_name": "Faculty upload test college",
                "tier_type": "Tier 1",
                "password": "college-test-password",
                "password_confirm": "college-test-password",
            }),
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 200)
        college_id = create_response.json()["data"]["config"]["id"]
        program = QualifierProgram.objects.create(
            college_id=college_id,
            program_key="dept_1_master",
            tab_title="Master: Test",
            program_name="Test Program",
        )

        template_response = client.get(
            f"/api/qualifiers/faculty/template/?college_id={college_id}"
            f"&program_key={program.program_key}"
        )
        self.assertEqual(template_response.status_code, 200)
        workbook = openpyxl.load_workbook(BytesIO(template_response.content), data_only=False)
        sheet = workbook.active
        self.assertEqual(
            [cell.value for cell in sheet[1]],
            [label for _, label in FACULTY_EXCEL_COLUMNS],
        )

        upload_workbook = openpyxl.Workbook()
        upload_sheet = upload_workbook.active
        upload_sheet.append([label for _, label in FACULTY_EXCEL_COLUMNS])
        faculty = {
            "sno": 1,
            "faculty_name": "Test Faculty",
            "pan_no": "ABCDE1234F",
            "apaar_id": "APAAR-1",
            "highest_degree": "Ph. D",
            "university": "Test University",
            "area_of_specialization": "Computer Science",
            "date_of_joining": date(2020, 1, 1),
            "designation_at_joining": "Assistant Professor",
            "present_designation": "Associate Professor",
            "date_designated_prof": date(2024, 1, 1),
            "nature_of_association": "Regular",
            "contractual_details": "",
            "currently_associated": "Yes",
            "date_of_leaving": None,
            "experience_years": "999",
            "date_receiving_highest_degree": date(2019, 1, 1),
        }
        upload_sheet.append([faculty[field] for field, _ in FACULTY_EXCEL_COLUMNS])
        content = BytesIO()
        upload_workbook.save(content)
        upload_response = client.post(
            "/api/qualifiers/faculty/upload/",
            data={
                "college_id": str(college_id),
                "program_key": program.program_key,
                "file": SimpleUploadedFile(
                    "faculty.xlsx",
                    content.getvalue(),
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            },
        )
        self.assertEqual(upload_response.status_code, 200, upload_response.content)
        self.assertEqual(upload_response.json()["status"], "success")
        saved = QualifierFacultyMember.objects.get(program=program)
        self.assertEqual(saved.date_of_joining, "2020-01-01")
        self.assertEqual(saved.date_designated_prof, "2024-01-01")
        self.assertEqual(
            saved.experience_years,
            calculate_faculty_experience("2020-01-01"),
        )
        self.assertNotEqual(saved.experience_years, "999")

        save_response = client.post(
            "/api/qualifiers/faculty/save/",
            data=json.dumps({
                "college_id": college_id,
                "program_key": program.program_key,
                "faculty_name": "Manually Added Faculty",
                "apaar_id": "APAAR-M1",
                "date_of_joining": "01/01/2022",
                "experience_years": "999",
            }),
            content_type="application/json",
        )
        self.assertEqual(save_response.status_code, 200, save_response.content)
        manually_saved = QualifierFacultyMember.objects.get(faculty_name="Manually Added Faculty")
        self.assertEqual(manually_saved.date_of_joining, "2022-01-01")
        self.assertEqual(
            manually_saved.experience_years,
            calculate_faculty_experience("2022-01-01"),
        )

    def test_faculty_upload_is_college_scoped_and_rejects_bad_rows_without_partial_saves(self):
        client = Client()
        create_response = client.post(
            "/api/qualifiers/colleges/create/",
            data=json.dumps({
                "institution_name": "Faculty upload isolation college",
                "tier_type": "Tier 1",
                "password": "college-test-password",
                "password_confirm": "college-test-password",
            }),
            content_type="application/json",
        )
        college_id = create_response.json()["data"]["config"]["id"]
        program = QualifierProgram.objects.create(
            college_id=college_id,
            program_key="dept_1_master",
            tab_title="Master: Test",
            program_name="Test Program",
        )
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.append([label for _, label in FACULTY_EXCEL_COLUMNS])
        row = [''] * len(FACULTY_EXCEL_COLUMNS)
        row[1] = 'Valid first row'
        row[3] = 'APAAR-ROW-2'
        row[7] = 'not-a-date'
        sheet.append(row)
        content = BytesIO()
        workbook.save(content)

        response = client.post(
            "/api/qualifiers/faculty/upload/",
            data={
                "college_id": str(college_id),
                "program_key": program.program_key,
                "file": SimpleUploadedFile("bad.xlsx", content.getvalue()),
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("row 2", response.json()["message"])
        self.assertEqual(QualifierFacultyMember.objects.filter(program=program).count(), 0)

        other_client = Client()
        other_client.post(
            "/api/qualifiers/colleges/create/",
            data=json.dumps({
                "institution_name": "Another faculty upload college",
                "tier_type": "Tier 1",
                "password": "another-password",
                "password_confirm": "another-password",
            }),
            content_type="application/json",
        )
        denied = other_client.get(
            f"/api/qualifiers/faculty/template/?college_id={college_id}"
            f"&program_key={program.program_key}"
        )
        self.assertEqual(denied.status_code, 403)

    def test_saved_2b_entries_create_only_entered_allied_programs_per_department(self):
        college = get_or_create_college("Qualifier program sync test college")
        client = Client()
        access_response = client.post(
            "/api/qualifiers/colleges/access/",
            data=json.dumps({
                "college_id": college.id,
                "password": "college-test-password",
                "password_confirm": "college-test-password",
            }),
            content_type="application/json",
        )
        self.assertEqual(access_response.status_code, 200)
        payload = {
            "college_id": college.id,
            "departments": [
                {"sno": 1, "department_name": "Computer Engineering", "program_name": "B.E. Computer Engineering"},
                {"sno": 2, "department_name": "Electronics", "program_name": "B.E. Electronics"},
            ],
            "program_mappings": [
                {
                    "sno": 1,
                    "department_name": "Computer Engineering",
                    "master_program_name": "Computer Engineering",
                    "has_allied_department": "Yes",
                    "allied_program_count": 1,
                    "allied_program_1": "Artificial Intelligence",
                    "allied_program_2": "Must not be created",
                },
                {
                    "sno": 2,
                    "department_name": "Electronics",
                    "has_allied_department": "No",
                    "allied_program_count": 0,
                    "allied_program_1": "Must not be created either",
                },
            ],
        }

        response = client.post(
            "/api/qualifiers/departments/save/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        response_data = response.json()["data"]
        programs = response_data["programs"]
        self.assertEqual(response_data["program_mappings"][1]["master_program_name"], "Electronics")
        self.assertEqual(
            {(program["department_name"], program["tab_title"]) for program in programs},
            {
                ("Computer Engineering", "Master: Computer Engineering"),
                ("Computer Engineering", "Allied 1: Artificial Intelligence"),
                ("Electronics", "Master: Electronics"),
            },
        )
        invalid_count_response = client.post(
            "/api/qualifiers/departments/save/",
            data=json.dumps({
                "college_id": college.id,
                "program_mappings": [{"sno": 1, "allied_program_count": 7}],
            }),
            content_type="application/json",
        )
        self.assertEqual(invalid_count_response.status_code, 400)
        self.assertEqual(QualifierProgramMapping.objects.filter(college=college).count(), 2)

    def test_department_scoped_checklist_and_metrics_are_returned_separately(self):
        client = Client()
        college = get_or_create_college("Department scope test college")
        departments = list(QualifierDepartment.objects.filter(college=college).order_by('sno'))
        departments[0].department_name = "First Department"
        departments[0].save()
        departments[1].department_name = "Second Department"
        departments[1].save()
        for department, status in zip(departments, ("First status", "Second status")):
            QualifierChecklistItem.objects.update_or_create(
                college=college,
                department=department,
                sno=1,
                tier_type="Tier 1",
                defaults=dict(qualifier_text="Approval", current_status=status),
            )
            QualifierPrimaryCheckMetrics.objects.create(
                college=college,
                department=department,
                years=["2025-2026"],
                ds_students={"2025-2026": 101 if department == departments[0] else 202},
            )

        session = client.session
        session["qualifier_college_id"] = college.id
        session.save()
        response = client.get(f"/api/qualifiers/all/?college_id={college.id}")

        self.assertEqual(response.status_code, 200)
        scoped_data = response.json()["data"]["department_qualifier_data"]
        first_data = scoped_data[str(departments[0].id)]
        second_data = scoped_data[str(departments[1].id)]
        self.assertEqual(first_data["checklist"][0]["current_status"], "First status")
        self.assertEqual(second_data["checklist"][0]["current_status"], "Second status")
        self.assertEqual(first_data["primary_check"]["ds_students"]["2025-2026"], 101)
        self.assertEqual(second_data["primary_check"]["ds_students"]["2025-2026"], 202)

    def test_primary_check_save_targets_only_selected_department(self):
        client = Client()
        college = get_or_create_college("Department save test college")
        first, second = list(QualifierDepartment.objects.filter(college=college).order_by('sno'))
        master_program = QualifierProgram.objects.create(
            college=college,
            dept_sno=first.sno,
            program_type="master",
            two_batches_passed="No",
            cay="2024-2025",
        )
        session = client.session
        session["qualifier_college_id"] = college.id
        session.save()

        response = client.post(
            "/api/qualifiers/primary-check/save/",
            data=json.dumps({
                "college_id": college.id,
                "department_id": first.id,
                "approval_five_years": "Yes",
                "approval_years_text": "2025-2026",
                "two_batches_passed_out": "Yes",
                "current_assessment_year": "2025-2026",
                "years": ["2025-2026"],
                "ds_students": {"2025-2026": 45},
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        first_metrics = QualifierPrimaryCheckMetrics.objects.get(
            college=college, department=first
        )
        self.assertEqual(first_metrics.approval_five_years, "Yes")
        self.assertEqual(first_metrics.ds_students["2025-2026"], 45)
        master_program.refresh_from_db()
        self.assertEqual(master_program.two_batches_passed, "Yes")
        self.assertEqual(master_program.cay, "2025-2026")
        self.assertFalse(QualifierPrimaryCheckMetrics.objects.filter(
            college=college, department=second
        ).exists())

    def test_saving_department_rows_preserves_scoped_data_for_unchanged_rows(self):
        client = Client()
        college = get_or_create_college("Department row preservation test college")
        department = QualifierDepartment.objects.get(college=college, sno=1)
        metric = QualifierPrimaryCheckMetrics.objects.create(
            college=college, department=department, years=["2025-2026"]
        )
        checklist, _ = QualifierChecklistItem.objects.update_or_create(
            college=college,
            department=department,
            sno=1,
            tier_type="Tier 1",
            defaults=dict(qualifier_text="Approval"),
        )
        session = client.session
        session["qualifier_college_id"] = college.id
        session.save()

        response = client.post(
            "/api/qualifiers/departments/save/",
            data=json.dumps({
                "college_id": college.id,
                "departments": [
                    {"sno": 1, "department_name": "Updated Department"},
                    {"sno": 2, "department_name": "Second Department"},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        department.refresh_from_db()
        self.assertEqual(department.department_name, "Updated Department")
        self.assertTrue(QualifierPrimaryCheckMetrics.objects.filter(pk=metric.pk).exists())
        self.assertTrue(QualifierChecklistItem.objects.filter(pk=checklist.pk).exists())

    def test_export_includes_department_scoped_checklist_and_metrics(self):
        client = Client()
        college = get_or_create_college("Department export test college")
        department = QualifierDepartment.objects.get(college=college, sno=1)
        department.department_name = "Export Department"
        department.save()
        QualifierPrimaryCheckMetrics.objects.create(
            college=college,
            department=department,
            years=["2025-2026"],
            ds_students={"2025-2026": 12},
        )
        QualifierChecklistItem.objects.update_or_create(
            college=college,
            department=department,
            sno=1,
            tier_type="Tier 1",
            defaults=dict(qualifier_text="Department approval", current_status="Approved"),
        )
        session = client.session
        session["qualifier_college_id"] = college.id
        session.save()

        response = client.get(
            f"/api/qualifiers/export-excel/?college_id={college.id}"
        )

        self.assertEqual(response.status_code, 200)
        workbook = openpyxl.load_workbook(BytesIO(response.content), data_only=True)
        self.assertIn("Department Checklists", workbook.sheetnames)
        self.assertIn("Dept Primary Check", workbook.sheetnames)
        self.assertEqual(workbook["Department Checklists"].cell(2, 1).value, "Export Department")
        self.assertIn(
            "2025-2026",
            [workbook["Dept Primary Check"].cell(row, 3).value
             for row in range(2, workbook["Dept Primary Check"].max_row + 1)],
        )

    def test_college_password_is_required_and_tier_is_locked(self):
        response = Client().get("/api/qualifiers/all/")
        self.assertEqual(response.status_code, 403)

        client = Client()
        create_response = client.post(
            "/api/qualifiers/colleges/create/",
            data=json.dumps({
                "institution_name": "Password protected college",
                "tier_type": "Tier 2",
                "password": "college-test-password",
                "password_confirm": "college-test-password",
            }),
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 200)
        data = create_response.json()["data"]
        college_id = data["config"]["id"]
        self.assertEqual(data["config"]["tier_type"], "Tier 2")
        self.assertTrue(data["config"]["has_password"])
        self.assertNotIn("password_hash", data["config"])

        tier_response = client.post(
            "/api/qualifiers/config/save/",
            data=json.dumps({"college_id": college_id, "tier_type": "Tier 1"}),
            content_type="application/json",
        )
        self.assertEqual(tier_response.status_code, 400)

        other_client = Client()
        second_college_response = other_client.post(
            "/api/qualifiers/colleges/create/",
            data=json.dumps({
                "institution_name": "A different protected college",
                "tier_type": "Tier 1",
                "password": "another-test-password",
                "password_confirm": "another-test-password",
            }),
            content_type="application/json",
        )
        self.assertEqual(second_college_response.status_code, 200)
        other_college_id = second_college_response.json()["data"]["config"]["id"]
        cross_college_response = client.get(
            f"/api/qualifiers/all/?college_id={other_college_id}"
        )
        self.assertEqual(cross_college_response.status_code, 403)

        other_client = Client()
        bad_access = other_client.post(
            "/api/qualifiers/colleges/access/",
            data=json.dumps({"college_id": college_id, "password": "incorrect-password"}),
            content_type="application/json",
        )
        self.assertEqual(bad_access.status_code, 401)
        good_access = other_client.post(
            "/api/qualifiers/colleges/access/",
            data=json.dumps({"college_id": college_id, "password": "college-test-password"}),
            content_type="application/json",
        )
        self.assertEqual(good_access.status_code, 200)


class QualifierApaarAndDepartmentChecklistTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.college = get_or_create_college("APAAR test college")
        self.program = QualifierProgram.objects.create(
            college=self.college, program_key="dept_1_master", program_type="master", dept_sno=1,
            tab_title="Master: Test", program_name="Test Program")
        session = self.client.session
        session["qualifier_college_id"] = self.college.id
        session.save()

    def save(self, **fields):
        return self.client.post("/api/qualifiers/faculty/save/", data=json.dumps({
            "college_id": self.college.id, "program_key": self.program.program_key, **fields}),
            content_type="application/json")

    def test_faculty_without_apaar_is_refused(self):
        response = self.save(faculty_name="No APAAR", date_of_joining="01/01/2022")
        self.assertEqual(response.status_code, 400)
        self.assertIn("APAAR", response.json()["message"])
        self.assertEqual(self.save(faculty_name="With APAAR", apaar_id=" 123456789012 ",
                                   date_of_joining="01/01/2022").status_code, 200)
        self.assertEqual(list(QualifierFacultyMember.objects.filter(program=self.program)
                              .values_list("faculty_name", "apaar_id")), [("With APAAR", "123456789012")])

    def test_upload_skips_rows_without_apaar(self):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.append([label for _, label in FACULTY_EXCEL_COLUMNS])
        for name, apaar in (("Has ID", 123456789012.0), ("No ID", None)):
            row = [""] * len(FACULTY_EXCEL_COLUMNS)
            row[1], row[3], row[7] = name, apaar, "01/01/2022"
            sheet.append(row)
        content = BytesIO()
        workbook.save(content)
        response = self.client.post("/api/qualifiers/faculty/upload/", data={
            "college_id": self.college.id, "program_key": self.program.program_key,
            "file": SimpleUploadedFile("roster.xlsx", content.getvalue())})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["skipped_without_apaar"], [3])
        self.assertEqual(list(QualifierFacultyMember.objects.filter(program=self.program)
                              .values_list("faculty_name", "apaar_id")), [("Has ID", "123456789012")])

    def test_every_department_gets_an_evaluated_checklist(self):
        from .services import recompute_all_qualifiers_for_college
        recompute_all_qualifiers_for_college(self.college)
        for department in QualifierDepartment.objects.filter(college=self.college):
            items = QualifierChecklistItem.objects.filter(college=self.college, department=department)
            college_items = QualifierChecklistItem.objects.filter(college=self.college, department__isnull=True)
            self.assertEqual(items.count(), college_items.count())
            self.assertTrue(all(item.current_status for item in items.filter(tier_type="Tier 1")))
