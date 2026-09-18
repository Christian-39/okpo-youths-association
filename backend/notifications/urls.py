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
    path("api/notifications/", api.notification_list_api, name="notification_list_api"),
    path("api/notifications/create/", api.notification_create_api, name="notification_create_api"),
    path("api/notifications/<int:pk>/", api.notification_detail_api, name="notification_detail_api"),
    path("api/notifications/<int:pk>/delete/", api.notification_delete_api, name="notification_delete_api"),
    path("api/mark-all-read/", api.mark_all_read_api, name="mark_all_read_api"),
]
