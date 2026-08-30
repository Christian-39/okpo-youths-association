"""
URL configuration for OYA project.
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from dashboard.views import global_search_ajax


def api_root(request):
    """Health check / API discovery endpoint for the root path."""
    return JsonResponse({
        "name": "OYA API",
        "status": "ok",
        "version": "1.0",
        "endpoints": {
            "accounts": "/accounts/",
            "members": "/members/",
            "executives": "/executives/",
            "elections": "/elections/",
            "finance": "/finance/",
            "projects": "/projects/",
            "operations": "/operations/",
            "notifications": "/notifications/",
            "auditlogs": "/auditlogs/",
            "dashboard": "/dashboard/",
            "settings": "/settings/",
            "project_donations": "/project-donations/",
            "search": "/search/api/",
        }
    })


urlpatterns = [
    path("", api_root, name="api_root"),
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("members/", include("members.urls")),
    path("executives/", include("executives.urls")),
    path("elections/", include("elections.urls")),
    path("finance/", include("finance.urls")),
    path("projects/", include("projects.urls")),
    path("operations/", include("operations.urls")),
    path("notifications/", include("notifications.urls")),
    path("auditlogs/", include("auditlogs.urls")),
    path("dashboard/", include("dashboard.urls")),
    path("settings/", include("settingsapp.urls")),
    path("project-donations/", include("project_donations.urls")),

    path("search/api/", global_search_ajax, name="global_search_ajax"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
