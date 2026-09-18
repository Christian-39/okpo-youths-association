"""
URL patterns for executives app.
"""
from django.urls import path
from . import views
from . import api

app_name = "executives"

urlpatterns = [
    # Standalone-frontend JSON API
    path("api/list/", api.executive_list_api, name="executive_list_api"),
    path("api/form-meta/", api.executive_form_meta_api, name="executive_form_meta_api"),
    path("api/create/", api.executive_create_api, name="executive_create_api"),
    path("api/<int:pk>/", api.executive_detail_api, name="executive_detail_api"),
    path("api/<int:pk>/form-meta/", api.executive_form_meta_api, name="executive_form_meta_edit_api"),
    path("api/<int:pk>/update/", api.executive_update_api, name="executive_update_api"),
    path("api/<int:pk>/end-tenure/", api.executive_end_tenure_api, name="executive_end_tenure_api"),
]
