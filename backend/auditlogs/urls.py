"""
URL configuration for auditlogs app.
"""
from django.urls import path
from . import views

app_name = "auditlogs"

urlpatterns = [
    path("api/", views.auditlog_list, name="auditlog_list"),
    path("api/<int:pk>/detail/", views.auditlog_detail, name="detail"),
    path("api/export/", views.auditlog_export, name="export"),
]