from django.urls import path
from . import views

app_name = "accounts"

urlpatterns = [
    path("api/login/", views.login_view, name="login"),
    path("api/logout/", views.logout_view, name="logout"),
    path("api/profile/", views.profile_view, name="profile"),
    path("api/profile/update/", views.profile_update, name="profile_update"),
    path("api/profile/change-pin/", views.change_pin, name="change_pin"),    
    path("api/users/", views.user_list, name="user_list"),
    path("api/users/create/", views.user_create, name="user_create"),
    path("api/users/<int:pk>/", views.user_detail, name="user_detail"),
    path("api/users/<int:pk>/update/", views.user_update, name="user_update"),
    path("api/users/<int:pk>/delete/", views.user_delete, name="user_delete"),
    path("api/pin-reset/", views.pin_reset, name="pin_reset"),
    path("api/users/search/", views.user_search_ajax, name="user_search_ajax"),
]