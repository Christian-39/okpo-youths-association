"""
URL patterns for settingsapp.
"""
from django.urls import path
from . import views

app_name = "settingsapp"

urlpatterns = [
    path("api/", views.settings_view, name="settings"),

    # Donation Groups (Feature 1, 2, 3)
    path("api/donation-groups/", views.donation_group_list, name="donation_group_list"),
    path("api/donation-groups/create/", views.donation_group_create, name="donation_group_create"),
    path("api/donation-groups/<int:pk>/", views.donation_group_detail, name="donation_group_detail"),
    path("api/donation-groups/<int:pk>/update/", views.donation_group_update, name="donation_group_update"),
    path("api/donation-groups/<int:pk>/delete/", views.donation_group_delete, name="donation_group_delete"),
    path("api/donation-groups/<int:pk>/toggle-active/", views.donation_group_toggle_active, name="donation_group_toggle_active"),
    path("api/donation-groups/<int:pk>/members/add/", views.donation_group_member_add, name="donation_group_member_add"),
    path("api/donation-groups/<int:pk>/members/<int:membership_pk>/remove/", views.donation_group_member_remove, name="donation_group_member_remove"),
]
