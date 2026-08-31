"""
URL patterns for executives app.
"""
from django.urls import path
from . import views

app_name = "executives"

urlpatterns = [
    path("api/", views.executive_list, name="executive_list"),
    path("api/create/", views.executive_create, name="executive_create"),
    path("api/<int:pk>/", views.executive_detail, name="executive_detail"),
    path("api/<int:pk>/update/", views.executive_update, name="executive_update"),
    path("api/<int:pk>/end-tenure/", views.executive_end_tenure, name="executive_end_tenure"),
]
