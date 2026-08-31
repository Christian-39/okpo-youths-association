"""
URL patterns for elections app.
"""
from django.urls import path
from . import views

app_name = "elections"

urlpatterns = [
    path("api/", views.election_list, name="election_list"),
    path("api/create/", views.election_create, name="election_create"),
    path("api/<int:pk>/", views.election_detail, name="election_detail"),
    path("api/<int:pk>/update/", views.election_update, name="election_update"),
    path("api/candidates/create/", views.candidate_create, name="candidate_create"),
    path("api/candidates/<int:pk>/update/", views.candidate_update, name="candidate_update"),
    path("api/candidate/<int:pk>/vote/", views.cast_vote, name="cast_vote"),
    
    # Handover Ledger URLs
    path("api/handovers/", views.handover_list, name="handover_list"),
    path("api/handovers/create/", views.handover_create, name="handover_create"),
    path("api/handovers/<int:pk>/", views.handover_detail, name="handover_detail"),
    path("api/handovers/<int:pk>/update/", views.handover_update, name="handover_update"),
    path("api/handovers/<int:pk>/delete/", views.handover_delete, name="handover_delete"),

    # Executive Handover Report URLs
    path("api/administrations/", views.administration_list, name="administration_list"),
    path("api/administrations/<str:key>/", views.administration_report, name="administration_report"),
]
