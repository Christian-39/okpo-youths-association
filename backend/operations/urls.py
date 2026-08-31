"""
URL patterns for operations app.
"""
from django.urls import path
from . import views

app_name = "operations"

urlpatterns = [
    path("api/taskforce/", views.taskforce_list, name="taskforce_list"),
    path("api/taskforce/create/", views.taskforce_create, name="taskforce_create"),
    path("api/taskforce/<int:pk>/update/", views.taskforce_update, name="taskforce_update"),
    path("api/taskforce/<int:pk>/remove/", views.taskforce_remove, name="taskforce_remove"),
    path("api/motorcycles/", views.motorcycle_list, name="motorcycle_list"),
    path("api/motorcycles/create/", views.motorcycle_create, name="motorcycle_create"),
    path("api/motorcycles/<int:pk>/update/", views.motorcycle_update, name="motorcycle_update"),
    path("api/motorcycles/<int:pk>/delete/", views.motorcycle_delete, name="motorcycle_delete"),
    path("api/cases/", views.case_list, name="case_list"),
    path("api/cases/create/", views.case_create, name="case_create"),
    path("api/cases/<int:pk>/", views.case_detail, name="case_detail"),
    path("api/cases/<int:pk>/resolve/", views.case_resolve, name="case_resolve"),
    path("api/cases/<int:pk>/edit/", views.case_update, name="case_update"),
    path("api/cases/<int:pk>/delete/", views.case_delete, name="case_delete"),

]
