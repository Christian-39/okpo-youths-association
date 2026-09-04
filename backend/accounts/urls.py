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
]