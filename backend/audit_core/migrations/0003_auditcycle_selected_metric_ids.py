from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit_core", "0002_auditassignment_auditor_1_criteria_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditcycle",
            name="selected_metric_ids",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
