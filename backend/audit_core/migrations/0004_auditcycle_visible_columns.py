from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("audit_core", "0003_auditcycle_selected_metric_ids"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditcycle",
            name="visible_columns",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
