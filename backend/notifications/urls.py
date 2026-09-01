"""
URL patterns for notifications app.
"""
from django.urls import path
from . import views
from . import api

app_name = "notifications"

urlpatterns = [
    path("mark-all-read/", views.mark_all_read, name="mark_all_read"),
    # Standalone-frontend JSON API
    path("api/unread-count/", api.unread_count_api, name="unread_count_api"),
]
