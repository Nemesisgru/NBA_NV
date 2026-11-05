from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('audit_core', '0006_evidence_owner_rubric_jobs'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditsettings',
            name='ai_model',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
    ]
