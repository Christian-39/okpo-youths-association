"""
URL patterns for settingsapp.
"""
from django.urls import path
from . import views
from . import api

app_name = "settingsapp"

urlpatterns = [
    # Donation Groups (Feature 1, 2, 3)
    path("donation-groups/<int:pk>/toggle-active/", views.donation_group_toggle_active, name="donation_group_toggle_active"),
    path("donation-groups/<int:pk>/members/add/", views.donation_group_member_add, name="donation_group_member_add"),
    path("donation-groups/<int:pk>/members/<int:membership_pk>/remove/", views.donation_group_member_remove, name="donation_group_member_remove"),

    # Standalone-frontend JSON API
    path("api/settings/", api.system_settings_api, name="system_settings_api"),
    path("api/settings/update/", api.system_settings_update_api, name="system_settings_update_api"),
    path("api/donation-groups/", api.donation_group_list_api, name="donation_group_list_api"),
    path("api/donation-groups/create/", api.donation_group_create_api, name="donation_group_create_api"),
    path("api/donation-groups/<int:pk>/", api.donation_group_detail_api, name="donation_group_detail_api"),
    path("api/donation-groups/<int:pk>/update/", api.donation_group_update_api, name="donation_group_update_api"),
    path("api/donation-groups/<int:pk>/delete/", api.donation_group_delete_api, name="donation_group_delete_api"),
    path("api/donation-groups/<int:pk>/toggle-active/", api.donation_group_toggle_active_api, name="donation_group_toggle_active_api"),
    path("api/donation-groups/<int:pk>/members/add/", api.donation_group_member_add_api, name="donation_group_member_add_api"),
    path("api/donation-groups/<int:pk>/members/<int:membership_pk>/remove/", api.donation_group_member_remove_api, name="donation_group_member_remove_api"),
]
