from django.urls import path
from . import views, api

app_name = "accounts"

# ── JSON API routes (for the standalone frontend) ──
urlpatterns = [
    path("api/csrf/", api.csrf_api, name="api_csrf"),
    path("api/login/", api.login_api, name="api_login"),
    path("api/logout/", api.logout_api, name="api_logout"),
    path("api/me/", api.me_api, name="api_me"),
]