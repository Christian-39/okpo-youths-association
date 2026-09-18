"""
URL patterns for members app.
"""
from django.urls import path
from . import views
from . import api

app_name = "members"

urlpatterns = [
    path("api/stats/", views.member_stats_ajax, name="member_stats_ajax"),
    path("api/autocomplete/", views.member_autocomplete_search, name="member_autocomplete_search"),
    # Standalone-frontend JSON API
    path("api/list/", api.member_list_api, name="member_list_api"),
    path("api/create/", api.member_create_api, name="member_create_api"),
    path("api/<int:pk>/", api.member_detail_api, name="member_detail_api"),
    path("api/<int:pk>/update/", api.member_update_api, name="member_update_api"),
    path("api/clans/list/", api.clan_list_api, name="clan_list_api"),
    path("api/clans/create/", api.clan_create_api, name="clan_create_api"),
]
