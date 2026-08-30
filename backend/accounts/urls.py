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

# ── Template-based routes (for the original Django-rendered admin pages) ──
# If you still need the HTML pages, keep these on non-api paths.
# If you've fully switched to the standalone frontend, you can delete this block.
urlpatterns += [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("profile/", views.profile_view, name="profile"),
    path("profile/update/", views.profile_update, name="profile_update"),
    path("profile/change-pin/", views.change_pin, name="change_pin"),
    path("users/", views.user_list, name="user_list"),
    path("users/create/", views.user_create, name="user_create"),
    path("users/<int:pk>/", views.user_detail, name="user_detail"),
    path("users/<int:pk>/update/", views.user_update, name="user_update"),
    path("users/<int:pk>/delete/", views.user_delete, name="user_delete"),
    path("pin-reset/", views.pin_reset, name="pin_reset"),
    path("users/search/", views.user_search_ajax, name="user_search_ajax"),
]
