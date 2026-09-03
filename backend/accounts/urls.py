from django.urls import path
from . import views, api

app_name = "accounts"

# ── JSON API routes (for the standalone frontend) ──
urlpatterns = [
    path("api/csrf/", api.csrf_api, name="csrf_api"),
    path("api/login/", api.login_api, name="login_api"),
    path("api/logout/", api.logout_api, name="logout_api"),
    path("api/me/", api.me_api, name="me_api"),
]