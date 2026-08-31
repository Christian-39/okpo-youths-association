"""
URL patterns for members app.
"""
from django.urls import path
from . import views

app_name = "members"

urlpatterns = [
    path("api/", views.member_list, name="member_list"),
    path("api/create/", views.member_create, name="member_create"),
    path("api/<int:pk>/", views.member_detail, name="member_detail"),
    path("api/<int:pk>/update/", views.member_update, name="member_update"),
    path("api/<int:pk>/remove/", views.member_remove, name="member_remove"),
    path("api/<int:pk>/delete/", views.member_delete, name="member_delete"),
    path("api/clans/", views.clan_list, name="clan_list"),
    path("api/clans/create/", views.clan_create, name="clan_create"),
    path("api/api/stats/", views.member_stats_ajax, name="member_stats_ajax"),
    path("api/api/autocomplete/", views.member_autocomplete_search, name="member_autocomplete_search"),
]
