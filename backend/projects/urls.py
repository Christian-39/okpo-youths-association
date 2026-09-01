"""
URL patterns for projects app.
"""
from django.urls import path
from . import views
from . import api

app_name = "projects"

urlpatterns = [
    # Standalone-frontend JSON API
    path("api/list/", api.project_list_api, name="project_list_api"),
    path("api/create/", api.project_create_api, name="project_create_api"),
    path("api/<int:pk>/", api.project_detail_api, name="project_detail_api"),
    path("api/<int:pk>/update/", api.project_update_api, name="project_update_api"),
    path("api/<int:pk>/delete/", api.project_delete_api, name="project_delete_api"),
]
