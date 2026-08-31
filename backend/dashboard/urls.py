"""
URL patterns for dashboard app.
"""
from django.urls import path
from . import api, views

app_name = "dashboard"

urlpatterns = [
    # JSON API
    path("api/api/summary/", api.dashboard_api, name="api_summary"),

    # Existing AJAX endpoints (already return JSON, safe to keep)
    path("api/search/api/", views.global_search_ajax, name="global_search_ajax"),
    path("api/financial-trend/ajax/", views.financial_trend_ajax, name="financial_trend_ajax"),
]
