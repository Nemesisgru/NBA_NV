from django.urls import path
from . import views

urlpatterns = [
    path('all/', views.get_all_data, name='qualifier_get_all'),
    path('colleges/', views.get_colleges_list, name='qualifier_colleges_list'),
    path('colleges/create/', views.create_college, name='qualifier_create_college'),
    path('colleges/access/', views.access_college, name='qualifier_access_college'),
    path('config/save/', views.save_config, name='qualifier_save_config'),
    path('departments/save/', views.save_departments, name='qualifier_save_departments'),
    path('primary-check/save/', views.save_primary_check, name='qualifier_save_primary_check'),
    path('faculty/save/', views.save_faculty_member, name='qualifier_save_faculty'),
    path('faculty/delete/', views.delete_faculty_member, name='qualifier_delete_faculty'),
    path('faculty/template/', views.download_faculty_template, name='qualifier_faculty_template'),
    path('faculty/upload/', views.upload_faculty_roster, name='qualifier_faculty_upload'),
    path('program-profile/save/', views.save_program_profile, name='qualifier_save_program_profile'),
    path('sync-google-sheet/', views.sync_google_sheet, name='qualifier_sync_google_sheet'),
    path('export-excel/', views.export_excel, name='qualifier_export_excel'),
]
