from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Institute, Department, Auditor, AuditCycle, Criterion,
    MetricItem, AuditAssignment, AuditEvaluation, ActionTakenReport, AuditSettings
)

admin.site.site_header = "KRGI Academic Audit Administration"
admin.site.site_title = "KRGI Audit Portal"
admin.site.index_title = "NBA Tier-I Academic Audit Control Center"

@admin.register(Institute)
class InstituteAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department_count')
    search_fields = ('code', 'name')

    def department_count(self, obj):
        return obj.departments.count()
    department_count.short_description = "Total Departments"

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'institute', 'hod_name', 'display_hod_login', 'created_at')
    list_filter = ('institute',)
    search_fields = ('code', 'name', 'hod_name', 'hod_user__username')

    def display_hod_login(self, obj):
        if obj.hod_user:
            return format_html('<code>{}</code> / <small>{}</small>', obj.hod_user.username, obj.hod_initial_password)
        return "-"
    display_hod_login.short_description = "HOD Login (User / Pass)"

@admin.register(Auditor)
class AuditorAdmin(admin.ModelAdmin):
    list_display = ('sl_no', 'name', 'institute', 'dept_name', 'designation', 'display_auditor_login', 'is_active')
    list_filter = ('institute', 'experience', 'is_active')
    search_fields = ('name', 'email', 'designation', 'dept_name', 'user__username')
    list_editable = ('is_active',)

    def display_auditor_login(self, obj):
        if obj.user:
            return format_html('<code>{}</code> / <small>{}</small>', obj.user.username, obj.initial_password)
        return "-"
    display_auditor_login.short_description = "Auditor Login (User / Pass)"

@admin.register(AuditCycle)
class AuditCycleAdmin(admin.ModelAdmin):
    list_display = ('academic_year', 'semester', 'cycle_type', 'is_active')
    list_filter = ('cycle_type', 'semester', 'is_active')
    list_editable = ('is_active',)

class MetricItemInline(admin.TabularInline):
    model = MetricItem
    extra = 0
    fields = ('code', 'is_header', 'key_aspect', 'max_marks', 'benchmark', 'unit', 'order')

@admin.register(Criterion)
class CriterionAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'order', 'total_metrics', 'total_marks')
    inlines = [MetricItemInline]

    def total_metrics(self, obj):
        return obj.metrics.count()

    def total_marks(self, obj):
        return sum(m.max_marks for m in obj.metrics.filter(is_header=False))

@admin.register(MetricItem)
class MetricItemAdmin(admin.ModelAdmin):
    list_display = ('code', 'criterion', 'key_aspect_short', 'is_header', 'max_marks', 'benchmark', 'unit')
    list_filter = ('criterion', 'is_header')
    search_fields = ('code', 'key_aspect', 'auditor_verifies')

    def key_aspect_short(self, obj):
        return obj.key_aspect[:60]
    key_aspect_short.short_description = "Key Aspect"

@admin.register(AuditAssignment)
class AuditAssignmentAdmin(admin.ModelAdmin):
    list_display = ('department', 'cycle', 'auditor_1', 'display_a1_criteria', 'auditor_2', 'display_a2_criteria', 'deployment_check', 'status')
    list_filter = ('cycle', 'department__institute', 'status')
    search_fields = ('department__code', 'department__name', 'auditor_1__name', 'auditor_2__name')
    fieldsets = (
        ('Audit Scope', {
            'fields': ('cycle', 'department')
        }),
        ('Lead Auditor (Auditor 1)', {
            'fields': ('auditor_1', 'auditor_1_criteria')
        }),
        ('Second Auditor (Auditor 2)', {
            'fields': ('auditor_2', 'auditor_2_criteria')
        }),
        ('Overall & Compliance', {
            'fields': ('assigned_criteria', 'deployment_check')
        }),
        ('Timelines & Status', {
            'fields': ('digital_review_from', 'digital_review_to', 'physical_audit_date', 'status')
        }),
    )

    def display_a1_criteria(self, obj):
        return ", ".join(obj.auditor_1_criteria) if obj.auditor_1_criteria else "All / Unassigned"
    display_a1_criteria.short_description = "Auditor 1 Criteria"

    def display_a2_criteria(self, obj):
        return ", ".join(obj.auditor_2_criteria) if obj.auditor_2_criteria else "All / Unassigned"
    display_a2_criteria.short_description = "Auditor 2 Criteria"

@admin.register(AuditEvaluation)
class AuditEvaluationAdmin(admin.ModelAdmin):
    list_display = ('department', 'cycle', 'metric_code', 'items_checked', 'valid_items', 'marks_obtained', 'percentage', 'grade_badge', 'is_flagged_for_atr')
    list_filter = ('cycle', 'department__institute', 'department', 'grade', 'is_flagged_for_atr')
    search_fields = ('department__code', 'metric__code', 'metric__key_aspect')

    def metric_code(self, obj):
        return f"{obj.metric.criterion.code} - {obj.metric.code}"

    def grade_badge(self, obj):
        colors = {'Y': '#10b981', 'C': '#3b82f6', 'W': '#f59e0b', 'D': '#ef4444'}
        color = colors.get(obj.grade, '#6b7280')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            color, obj.grade or '-'
        )
    grade_badge.short_description = "Grade"

@admin.register(ActionTakenReport)
class ActionTakenReportAdmin(admin.ModelAdmin):
    list_display = ('evaluation', 'status_badge', 'target_date', 'auditor_signoff', 'updated_at')
    list_filter = ('status', 'auditor_signoff')
    search_fields = ('root_cause', 'action_plan', 'hod_remarks')

    def status_badge(self, obj):
        colors = {'Open': '#ef4444', 'In Progress': '#f59e0b', 'Closed': '#10b981'}
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">{}</span>',
            color, obj.status
        )
    status_badge.short_description = "ATR Status"

@admin.register(AuditSettings)
class AuditSettingsAdmin(admin.ModelAdmin):
    list_display = ('id', 'y_threshold', 'c_threshold', 'w_threshold', 'rubric_max_score', 'physical_gap_threshold')
