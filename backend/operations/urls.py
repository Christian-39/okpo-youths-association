"""
URL patterns for operations app.
"""
from django.urls import path
from . import views
from . import api

app_name = "operations"

urlpatterns = [
    # Standalone-frontend JSON API
    path("api/taskforce/list/", api.taskforce_list_api, name="taskforce_list_api"),
    path("api/taskforce/form-meta/", api.taskforce_form_meta_api, name="taskforce_form_meta_api"),
    path("api/taskforce/create/", api.taskforce_create_api, name="taskforce_create_api"),
    path("api/taskforce/<int:pk>/", api.taskforce_detail_api, name="taskforce_detail_api"),
    path("api/taskforce/<int:pk>/update/", api.taskforce_update_api, name="taskforce_update_api"),
    path("api/taskforce/<int:pk>/remove/", api.taskforce_remove_api, name="taskforce_remove_api"),

    path("api/motorcycles/list/", api.motorcycle_list_api, name="motorcycle_list_api"),
    path("api/motorcycles/form-meta/", api.motorcycle_form_meta_api, name="motorcycle_form_meta_api"),
    path("api/motorcycles/create/", api.motorcycle_create_api, name="motorcycle_create_api"),
    path("api/motorcycles/<int:pk>/", api.motorcycle_detail_api, name="motorcycle_detail_api"),
    path("api/motorcycles/<int:pk>/update/", api.motorcycle_update_api, name="motorcycle_update_api"),
    path("api/motorcycles/<int:pk>/delete/", api.motorcycle_delete_api, name="motorcycle_delete_api"),

    path("api/cases/list/", api.case_list_api, name="case_list_api"),
    path("api/cases/form-meta/", api.case_form_meta_api, name="case_form_meta_api"),
    path("api/cases/<int:pk>/form-meta/", api.case_form_meta_api, name="case_form_meta_edit_api"),
    path("api/cases/create/", api.case_create_api, name="case_create_api"),
    path("api/cases/<int:pk>/", api.case_detail_api, name="case_detail_api"),
    path("api/cases/<int:pk>/update/", api.case_update_api, name="case_update_api"),
    path("api/cases/<int:pk>/resolve/", api.case_resolve_api, name="case_resolve_api"),
    path("api/cases/<int:pk>/delete/", api.case_delete_api, name="case_delete_api"),
]
