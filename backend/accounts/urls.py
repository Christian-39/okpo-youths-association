from django.urls import path
from . import views, api

app_name = "accounts"

# ── JSON API routes (for the standalone frontend) ──
urlpatterns = [
    path("api/csrf/", api.csrf_api, name="csrf_api"),
    path("api/login/", api.login_api, name="login_api"),
    path("api/logout/", api.logout_api, name="logout_api"),
    path("api/me/", api.me_api, name="me_api"),
    path("api/profile/", api.profile_api, name="profile_api"),
    path("api/profile/update/", api.profile_update_api, name="profile_update_api"),
    path("api/profile/change-pin/", api.change_pin_api, name="change_pin_api"),
    # user_search_ajax already returns JSON and only requires login — this
    # was registered in the original app's urls.py (see MIGRATION_REPORT.md
    # context) but never carried over here, silently breaking every member
    # picker in the standalone frontend that calls it (dues-allocate.html,
    # notifications.html, pledge-form.html). Wiring the existing view
    # directly, matching the original path exactly.
    path("api/users/search/", views.user_search_ajax, name="user_search_ajax"),
    path("api/users/", api.user_list_api, name="user_list_api"),
    path("api/users/create/", api.user_create_api, name="user_create_api"),
    path("api/users/pin-reset/", api.pin_reset_api, name="pin_reset_api"),
    path("api/users/<int:pk>/", api.user_detail_api, name="user_detail_api"),
    path("api/users/<int:pk>/update/", api.user_update_api, name="user_update_api"),
    path("api/users/<int:pk>/delete/", api.user_delete_api, name="user_delete_api"),
]