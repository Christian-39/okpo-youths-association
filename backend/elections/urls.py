"""
URL patterns for elections app.
"""
from django.urls import path
from . import views
from . import api

app_name = "elections"

urlpatterns = [
    path("candidate/<int:pk>/vote/", views.cast_vote, name="cast_vote"),

    # Standalone-frontend JSON API
    path("api/list/", api.election_list_api, name="election_list_api"),
    path("api/create/", api.election_create_api, name="election_create_api"),
    path("api/<int:pk>/", api.election_detail_api, name="election_detail_api"),
    path("api/<int:pk>/update/", api.election_update_api, name="election_update_api"),
    path("api/candidates/form-meta/", api.candidate_form_meta_api, name="candidate_form_meta_api"),
    path("api/candidates/create/", api.candidate_create_api, name="candidate_create_api"),
    path("api/candidates/<int:pk>/", api.candidate_detail_api, name="candidate_detail_api"),
    path("api/candidates/<int:pk>/update/", api.candidate_update_api, name="candidate_update_api"),
    path("api/candidates/<int:pk>/vote/", api.cast_vote_api, name="cast_vote_api"),
    path("api/handovers/list/", api.handover_list_api, name="handover_list_api"),
]
