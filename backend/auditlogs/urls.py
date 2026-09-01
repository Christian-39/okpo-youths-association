"""
URL configuration for auditlogs app.
"""
from django.urls import path
from . import views
from . import api

app_name = "auditlogs"

urlpatterns = [
    path("<int:pk>/detail/", views.auditlog_detail, name="detail"),
    path("export/", views.auditlog_export, name="export"),
    # Standalone-frontend JSON API
    path("api/list/", api.auditlog_list_api, name="auditlog_list_api"),
    path("api/<int:pk>/detail/", api.auditlog_detail_api, name="auditlog_detail_api"),
]