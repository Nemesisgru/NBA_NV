from django.urls import path
from . import views

urlpatterns = [
    path('bootstrap/', views.bootstrap_data, name='bootstrap_data'),
    path('criteria/<str:criterion_code>/', views.criterion_detail, name='criterion_detail'),
    path('evaluations/save/', views.save_evaluation, name='save_evaluation'),
    path('criterion-summary/', views.criterion_summary, name='criterion_summary'),
    path('dashboard/', views.dashboard_overview, name='dashboard_overview'),
    path('comparison/', views.comparison_view, name='comparison_view'),
    path('atr/', views.atr_list, name='atr_list'),
    path('atr/update/', views.update_atr, name='update_atr'),
    path('assignments/', views.assignments_list, name='assignments_list'),
    path('assignments/save/', views.save_assignment, name='save_assignment'),
    path('departments/add/', views.add_department, name='add_department'),
    path('auditors/add/', views.add_auditor, name='add_auditor'),
    path('auditors/template/', views.download_auditor_template, name='download_auditor_template'),
    path('auditors/bulk-upload/', views.bulk_upload_auditors, name='bulk_upload_auditors'),
    path('auth/login/', views.auth_login_view, name='auth_login_view'),
    path('auth/me/', views.auth_me_view, name='auth_me_view'),
    path('auth/logout/', views.auth_logout_view, name='auth_logout_view'),
    path('export/department-excel/', views.export_department_excel, name='export_department_excel'),
    path('export/department-pdf/', views.export_department_pdf, name='export_department_pdf'),
]
