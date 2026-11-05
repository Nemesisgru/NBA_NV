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
    # Questions (MetricItem ids) fixed by the Admin for this audit; null means every question
    selected_metric_ids = models.JSONField(null=True, blank=True)
    # Evaluation table columns shown during this audit ({column key: bool}); null means the defaults
    visible_columns = models.JSONField(null=True, blank=True)
    # Questions whose evidence the Admin marked as mandatory for this audit; null means not configured
    mandatory_metric_ids = models.JSONField(null=True, blank=True)
    # Rubric (grade thresholds) version in force when the first score of this cycle was saved
    rubric_snapshot = models.JSONField(null=True, blank=True)

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
    # Person responsible for the corrective action (blank: the department's HOD)
    owner_name = models.CharField(max_length=150, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ATR for {self.evaluation} ({self.status})"

class AuditSettings(models.Model):
    y_threshold = models.FloatField(default=0.75)
    c_threshold = models.FloatField(default=0.60)
    w_threshold = models.FloatField(default=0.40)
    rubric_max_score = models.FloatField(default=10.0)
    physical_gap_threshold = models.FloatField(default=0.15)
    # Increases whenever a grade threshold changes, so cycles scored under different rules can be told apart
    version = models.PositiveIntegerField(default=1)
    # Local Ollama model chosen by the Admin in the AI Assistant; blank = AUDIT_AI_MODEL from settings
    ai_model = models.CharField(max_length=120, blank=True, default='')

    THRESHOLD_FIELDS = ('y_threshold', 'c_threshold', 'w_threshold')

    def save(self, *args, **kwargs):
        if self.pk:
            old = AuditSettings.objects.filter(pk=self.pk).values(*self.THRESHOLD_FIELDS).first()
            if old and any(old[f] != getattr(self, f) for f in self.THRESHOLD_FIELDS):
                self.version = (self.version or 1) + 1
        super().save(*args, **kwargs)

    def rubric_snapshot(self):
        return {'version': self.version, 'y_threshold': self.y_threshold,
                'c_threshold': self.c_threshold, 'w_threshold': self.w_threshold}

    def __str__(self):
        return "Audit Global Settings"


# ---------------------------------------------------------------- AI Audit Assistant
class AIConversation(models.Model):
    """Assistant chat history. Visible to its owner only."""
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_conversations')
    cycle = models.ForeignKey(AuditCycle, on_delete=models.SET_NULL, null=True, blank=True)
    # Scope requested when the conversation was used (re-authorised on every request)
    scope = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


class AIMessage(models.Model):
    ROLES = [('user', 'user'), ('assistant', 'assistant')]
    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=12, choices=ROLES)
    content = models.TextField(blank=True)
    operation = models.CharField(max_length=40, blank=True)
    # Verified analytics result and validated narration (assistant messages)
    result = models.JSONField(null=True, blank=True)
    narration = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class AIReport(models.Model):
    """Draft audit report generated from a validated analytics snapshot. Never an approved report."""
    STATUSES = [('pending', 'pending'), ('running', 'running'), ('done', 'done'), ('failed', 'failed')]
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_reports')
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    cycle = models.ForeignKey(AuditCycle, on_delete=models.CASCADE)
    compare_cycle = models.ForeignKey(AuditCycle, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    filters = models.JSONField(default=dict, blank=True)
    include_narration = models.BooleanField(default=False)
    # Rubric thresholds and question selection in force when the snapshot was taken
    rubric_snapshot = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default='pending')
    error = models.CharField(max_length=300, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    files = models.JSONField(default=dict, blank=True)  # {format: file name inside AUDIT_AI['REPORT_DIR']}
    data_as_of = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']


# ---------------------------------------------------------------- Evidence files
class EvidenceFile(models.Model):
    """A document uploaded as evidence for one question of a department's audit.
    Stored outside every served folder; downloaded only through the authorised view."""
    EXTRACTION = [('pending', 'pending'), ('running', 'running'), ('done', 'done'),
                  ('manual', 'manual verification required'), ('failed', 'failed')]
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='evidence_files')
    cycle = models.ForeignKey(AuditCycle, on_delete=models.CASCADE, related_name='evidence_files')
    metric = models.ForeignKey(MetricItem, on_delete=models.CASCADE, related_name='evidence_files')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='+')
    original_name = models.CharField(max_length=200)
    stored_name = models.CharField(max_length=120, unique=True)
    file_type = models.CharField(max_length=10)        # pdf | docx
    size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=EXTRACTION, default='pending')
    status_note = models.CharField(max_length=300, blank=True)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    text_chars = models.PositiveIntegerField(default=0)
    attempts = models.PositiveSmallIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['metric__criterion__order', 'metric__order', 'uploaded_at']


class EvidenceChunk(models.Model):
    """Extracted text of an evidence file, with its real page / section location (never invented)."""
    evidence = models.ForeignKey(EvidenceFile, on_delete=models.CASCADE, related_name='chunks')
    order = models.PositiveIntegerField()
    location = models.CharField(max_length=120)
    text = models.TextField()

    class Meta:
        ordering = ['evidence_id', 'order']
