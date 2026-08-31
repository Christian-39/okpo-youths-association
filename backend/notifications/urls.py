"""
URL patterns for notifications app.
"""
from django.urls import path
from . import views

app_name = "notifications"

urlpatterns = [
    path("api/", views.notification_list, name="notification_list"),
    path("api/create/", views.notification_create, name="notification_create"),
    path("api/<int:pk>/", views.notification_detail, name="notification_detail"),
    path("api/<int:pk>/delete/", views.notification_delete, name="notification_delete"),
    path("api/mark-all-read/", views.mark_all_read, name="mark_all_read"),
]
