from django.db import models


class QualifierInstituteConfig(models.Model):
    """
    College / Institution profile.
    Data is stored and scoped under each college name.
    Decoupled from HA Audit data.
    """
    institution_name = models.CharField(max_length=255, unique=True)
    institution_code = models.CharField(max_length=50, blank=True, default='')
    tier_type = models.CharField(max_length=20, default='Tier 1')  # 'Tier 1' or 'Tier 2'
    password_hash = models.CharField(max_length=128, blank=True, default='')
    google_sheet_url = models.URLField(
        default='https://docs.google.com/spreadsheets/d/1CRPySQV9K3hzANJWNo81o81OI0tWFI3t2PmNL_exQAo/edit?usp=sharing',
        max_length=500
    )
    current_assessment_year = models.CharField(max_length=50, default='2026-2027')
    approval_five_years = models.CharField(max_length=10, default='No')
    approval_years_text = models.CharField(
        max_length=255,
        default='2023-2024, 2022-2023, 2021-2022, 2020-2021, 2019-2020, 2018-2019'
    )
    two_batches_passed_out = models.CharField(max_length=10, default='Yes')
    have_allied_department = models.CharField(max_length=10, default='No')
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Qualifier College'
        verbose_name_plural = 'Qualifier Colleges'
        ordering = ['id']

    def __str__(self):
        return f"{self.institution_name} ({self.tier_type})"


class QualifierDepartment(models.Model):
    """
    Department-level basic details and historical accreditation status.
    Default rows is 2 on opening; users can add more as needed.
    """
    college = models.ForeignKey(
        QualifierInstituteConfig,
        on_delete=models.CASCADE,
        related_name='departments',
        null=True,
        blank=True
    )
    sno = models.IntegerField(default=1)
    department_name = models.CharField(max_length=255, blank=True, default='')
    program_classification = models.CharField(max_length=50, blank=True, default='UG')
    program_name = models.CharField(max_length=255, blank=True, default='')
    inception_year = models.CharField(max_length=50, blank=True, default='')
    intake_inception = models.CharField(max_length=50, blank=True, default='')
    current_intake = models.CharField(max_length=50, blank=True, default='')
    times_accredited = models.CharField(max_length=50, blank=True, default='')
    last_accreditation_period = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['sno']
        constraints = [
            models.UniqueConstraint(
                fields=['college', 'sno'],
                condition=models.Q(college__isnull=False),
                name='qualifier_department_college_sno_uniq',
            ),
        ]

    def __str__(self):
        return f"{self.sno}. {self.department_name or 'Department'}"


class QualifierProgramMapping(models.Model):
    """
    2.B: Programs Applied for Accreditation Mapping:
    Master Program linked to Allied Programs (1 to 6).
    Dynamic tabs are spawned based on non-empty allied programs entered here.
    """
    college = models.ForeignKey(
        QualifierInstituteConfig,
        on_delete=models.CASCADE,
        related_name='program_mappings',
        null=True,
        blank=True
    )
    sno = models.IntegerField(default=1)
    department_name = models.CharField(max_length=255, blank=True, default='')
    program_classification = models.CharField(max_length=50, blank=True, default='UG')
    master_program_name = models.CharField(max_length=255, default='')
    has_allied_department = models.CharField(max_length=10, default='No')
    allied_program_count = models.PositiveSmallIntegerField(default=0)
    allied_program_1 = models.CharField(max_length=255, blank=True, default='')
    allied_program_2 = models.CharField(max_length=255, blank=True, default='')
    allied_program_3 = models.CharField(max_length=255, blank=True, default='')
    allied_program_4 = models.CharField(max_length=255, blank=True, default='')
    allied_program_5 = models.CharField(max_length=255, blank=True, default='')
    allied_program_6 = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['sno']

    def __str__(self):
        return f"{self.master_program_name} ({self.department_name})"


class QualifierPrimaryCheckMetrics(models.Model):
    """
    Student Faculty Ratio (SFR) and primary checks data for 3 Assessment Years (CAY, CAYm1, CAYm2).
    """
    college = models.ForeignKey(
        QualifierInstituteConfig,
        on_delete=models.CASCADE,
        related_name='primary_check_metrics',
        null=True,
        blank=True
    )
    department = models.ForeignKey(
        QualifierDepartment,
        on_delete=models.CASCADE,
        related_name='primary_check_metrics',
        null=True,
        blank=True,
    )
    approval_five_years = models.CharField(max_length=10, default='No')
    approval_years_text = models.CharField(max_length=255, blank=True, default='')
    two_batches_passed_out = models.CharField(max_length=10, default='Yes')
    have_allied_department = models.CharField(max_length=10, default='No')
    current_assessment_year = models.CharField(max_length=50, default='2026-2027')
    years = models.JSONField(default=list)  # ["2023-2024", "2022-2023", "2021-2022"]
    ug1_b = models.JSONField(default=dict)
    ug1_c = models.JSONField(default=dict)
    ug1_d = models.JSONField(default=dict)
    ug1_total = models.JSONField(default=dict)
    pg_total = models.JSONField(default=dict)
    ds_students = models.JSONField(default=dict)  # Total students in Dept
    as_students = models.JSONField(default=dict)  # Total students in allied depts
    s_total = models.JSONField(default=dict)      # Total S = DS + AS
    df_faculty = models.JSONField(default=dict)   # Dept faculty
    af_faculty = models.JSONField(default=dict)   # Allied faculty
    f_total = models.JSONField(default=dict)      # Total F = DF + AF
    ff_first_year = models.JSONField(default=dict)# FF first year 100% load
    sfr_calculated = models.JSONField(default=dict)# S / (F - FF)
    avg_sfr = models.CharField(max_length=50, default='#DIV/0!')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['college', 'department'],
                condition=models.Q(department__isnull=False),
                name='qualifier_metrics_college_department_uniq',
            ),
        ]

    def __str__(self):
        return f"SFR Metrics ({self.college})"


class QualifierProgram(models.Model):
    """
    Individual Program Profile: Master Program or Allied Program.
    Organized under specific department and college.
    """
    college = models.ForeignKey(
        QualifierInstituteConfig,
        on_delete=models.CASCADE,
        related_name='programs',
        null=True,
        blank=True
    )
    department_name = models.CharField(max_length=255, blank=True, default='')
    dept_sno = models.IntegerField(default=1)
    program_key = models.CharField(max_length=100)  # e.g. 'dept_1_master', 'dept_1_allied_1', ...
    program_type = models.CharField(max_length=50, default='master') # 'master' or 'allied_1'..'allied_6'
    tab_title = models.CharField(max_length=150)
    program_name = models.CharField(max_length=255)
    two_batches_passed = models.CharField(max_length=10, default='Yes')
    break_in_program = models.CharField(max_length=10, default='No')
    cay = models.CharField(max_length=50, default='2023-2024')
    is_hod_doctorate = models.CharField(max_length=10, default='No')
    cadre_compliance_cay = models.CharField(max_length=10, default='No')
    cadre_compliance_caym1 = models.CharField(max_length=10, default='No')

    # Pre-calculated/stored tables for summary
    cadre_table = models.JSONField(default=list)
    phd_table = models.JSONField(default=list)
    student_intake_table = models.JSONField(default=list)

    class Meta:
        ordering = ['dept_sno', 'id']

    def __str__(self):
        return f"[{self.department_name}] {self.tab_title}: {self.program_name}"


class QualifierFacultyMember(models.Model):
    """
    Faculty roster entry belonging to a specific Program (Master or Allied).
    """
    program = models.ForeignKey(QualifierProgram, on_delete=models.CASCADE, related_name='faculty_members')
    sno = models.IntegerField(default=1)
    faculty_name = models.CharField(max_length=255, blank=True, default='')
    pan_no = models.CharField(max_length=50, blank=True, default='')
    apaar_id = models.CharField(max_length=100, blank=True, default='')
    highest_degree = models.CharField(max_length=100, blank=True, default='')
    university = models.CharField(max_length=255, blank=True, default='')
    area_of_specialization = models.CharField(max_length=255, blank=True, default='')
    date_of_joining = models.CharField(max_length=50, blank=True, default='')
    designation_at_joining = models.CharField(max_length=100, blank=True, default='')
    present_designation = models.CharField(max_length=100, blank=True, default='')
    date_designated_prof = models.CharField(max_length=50, blank=True, default='')
    nature_of_association = models.CharField(max_length=50, blank=True, default='Regular')
    contractual_details = models.CharField(max_length=50, blank=True, default='')
    currently_associated = models.CharField(max_length=20, blank=True, default='Yes')
    date_of_leaving = models.CharField(max_length=50, blank=True, default='')
    experience_years = models.CharField(max_length=50, blank=True, default='')
    date_receiving_highest_degree = models.CharField(max_length=50, blank=True, default='')

    # Yearly breakdown columns
    yearly_association = models.JSONField(default=dict)     # {"2023-2024": "Yes", ...}
    yearly_designation = models.JSONField(default=dict)     # {"2023-2024": "Professor", ...}
    yearly_qualification = models.JSONField(default=dict)   # {"2023-2024": "Ph. D" / "No", ...}

    class Meta:
        ordering = ['sno']

    def __str__(self):
        return f"{self.sno}. {self.faculty_name} ({self.program.program_name})"


class QualifierChecklistItem(models.Model):
    """
    Checklist Compliance Item from Sheet 1 (Tier 1 / Tier 2) for a College.
    """
    college = models.ForeignKey(
        QualifierInstituteConfig,
        on_delete=models.CASCADE,
        related_name='checklist_items',
        null=True,
        blank=True
    )
    department = models.ForeignKey(
        QualifierDepartment,
        on_delete=models.CASCADE,
        related_name='checklist_items',
        null=True,
        blank=True,
    )
    sno = models.IntegerField(default=1)
    tier_type = models.CharField(max_length=20, default='Tier 1')
    qualifier_text = models.TextField()
    current_status = models.CharField(max_length=255, blank=True, default='')
    compliance_status = models.CharField(max_length=100, blank=True, default='Not Complied')
    hod_qualification_code = models.CharField(max_length=50, blank=True, default='')
    hod_qualification_status = models.CharField(max_length=50, blank=True, default='No')

    class Meta:
        ordering = ['tier_type', 'sno']
        constraints = [
            models.UniqueConstraint(
                fields=['college', 'department', 'tier_type', 'sno'],
                condition=models.Q(department__isnull=False),
                name='qualifier_checklist_dept_item_uniq',
            ),
        ]

    def __str__(self):
        return f"[{self.tier_type}] #{self.sno}: {self.compliance_status}"
