from django.db import models
from django.contrib.auth.models import User

class Institute(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)

    def __str__(self):
        return f"{self.code} - {self.name}"

class Department(models.Model):
    institute = models.ForeignKey(Institute, on_delete=models.CASCADE, related_name='departments')
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=200)
    hod_name = models.CharField(max_length=150, blank=True)
    hod_email = models.EmailField(blank=True)
    hod_user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hod_department')
    hod_initial_password = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('institute', 'code')

    def __str__(self):
        return f"{self.institute.code} - {self.code}"

class Auditor(models.Model):
    sl_no = models.IntegerField(null=True, blank=True)
    name = models.CharField(max_length=150)
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='auditor_profile')
    initial_password = models.CharField(max_length=100, blank=True)
    institute = models.ForeignKey(Institute, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    dept_name = models.CharField(max_length=100, blank=True)
    designation = models.CharField(max_length=150, blank=True)
    experience = models.CharField(max_length=100, blank=True)
    email = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        inst = self.institute.code if self.institute else "Unknown"
        dept = self.dept_name or (self.department.code if self.department else "")
        return f"{self.name} ({inst} - {dept})"

class AuditCycle(models.Model):
    CYCLE_TYPES = [
        ('Mid-Semester', 'Mid-Semester'),
        ('End-Semester', 'End-Semester'),
    ]
    SEMESTERS = [
        ('Odd', 'Odd'),
        ('Even', 'Even'),
    ]
    academic_year = models.CharField(max_length=20, default='2024-2025')
    cycle_type = models.CharField(max_length=20, choices=CYCLE_TYPES, default='Mid-Semester')
    semester = models.CharField(max_length=10, choices=SEMESTERS, default='Odd')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.academic_year} {self.semester} ({self.cycle_type})"

class Criterion(models.Model):
    code = models.CharField(max_length=10, unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.code}: {self.title}"

class MetricItem(models.Model):
    criterion = models.ForeignKey(Criterion, on_delete=models.CASCADE, related_name='metrics')
    code = models.CharField(max_length=20)
    is_header = models.BooleanField(default=False)
    key_aspect = models.TextField()
    auditor_verifies = models.TextField(blank=True)
    valid_condition = models.TextField(blank=True)
    sampling_unit = models.CharField(max_length=200, blank=True)
    sample_percent = models.CharField(max_length=50, blank=True)
    min_sample = models.CharField(max_length=50, blank=True)
    how_to_sample = models.TextField(blank=True)
    rubric_Y = models.TextField(blank=True)
    rubric_C = models.TextField(blank=True)
    rubric_W = models.TextField(blank=True)
    rubric_D = models.TextField(blank=True)
    unit = models.CharField(max_length=50, blank=True)
    max_marks = models.FloatField(default=0.0)
    benchmark = models.FloatField(default=100.0)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['criterion__order', 'order']

    def __str__(self):
        return f"{self.code} - {self.key_aspect[:50]}"

class AuditAssignment(models.Model):
    cycle = models.ForeignKey(AuditCycle, on_delete=models.CASCADE, related_name='assignments')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='audit_assignments')
    auditor_1 = models.ForeignKey(Auditor, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_assignments')
    auditor_2 = models.ForeignKey(Auditor, on_delete=models.SET_NULL, null=True, blank=True, related_name='second_assignments')
    auditor_1_criteria = models.JSONField(default=list, blank=True) # e.g. ["C1", "C2", "C3"]
    auditor_2_criteria = models.JSONField(default=list, blank=True) # e.g. ["C4", "C5", "C6"]
    assigned_criteria = models.JSONField(default=list, blank=True) # all combined criteria for department
    deployment_check = models.CharField(max_length=100, blank=True)
    digital_review_from = models.DateField(null=True, blank=True)
    digital_review_to = models.DateField(null=True, blank=True)
    physical_audit_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Not started')

    class Meta:
        unique_together = ('cycle', 'department')

    def __str__(self):
        return f"{self.department} ({self.cycle})"

class AuditEvaluation(models.Model):
    cycle = models.ForeignKey(AuditCycle, on_delete=models.CASCADE)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    metric = models.ForeignKey(MetricItem, on_delete=models.CASCADE)
    items_checked = models.FloatField(null=True, blank=True)
    valid_items = models.FloatField(null=True, blank=True)
    validated_value = models.FloatField(null=True, blank=True)
    marks_obtained = models.FloatField(null=True, blank=True)
    percentage = models.FloatField(null=True, blank=True)
    grade = models.CharField(max_length=2, blank=True)
    auditor_remarks = models.TextField(blank=True)
    evidence_status = models.CharField(max_length=50, default='Complete')
    physical_check_result = models.CharField(max_length=50, default='Matches claim')
    is_flagged_for_atr = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('cycle', 'department', 'metric')

    def __str__(self):
        return f"{self.department} - {self.metric.code} [{self.grade}]"

class ActionTakenReport(models.Model):
    evaluation = models.OneToOneField(AuditEvaluation, on_delete=models.CASCADE, related_name='atr')
    root_cause = models.TextField(blank=True)
    action_plan = models.TextField(blank=True)
    target_date = models.DateField(null=True, blank=True)
    completed_date = models.DateField(null=True, blank=True)
    evidence_ref = models.TextField(blank=True)
    status = models.CharField(max_length=50, default='Open')
    hod_remarks = models.TextField(blank=True)
    auditor_signoff = models.BooleanField(default=False)
    auditor_feedback = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ATR for {self.evaluation} ({self.status})"

class AuditSettings(models.Model):
    y_threshold = models.FloatField(default=0.75)
    c_threshold = models.FloatField(default=0.60)
    w_threshold = models.FloatField(default=0.40)
    rubric_max_score = models.FloatField(default=10.0)
    physical_gap_threshold = models.FloatField(default=0.15)

    def __str__(self):
        return "Audit Global Settings"
