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
            "versioned_root": "/api/v1/",
            "accounts": "/api/v1/accounts/",
            "members": "/api/v1/members/",
            "executives": "/api/v1/executives/",
            "elections": "/api/v1/elections/",
            "finance": "/api/v1/finance/",
            "projects": "/api/v1/projects/",
            "operations": "/api/v1/operations/",
            "notifications": "/api/v1/notifications/",
            "auditlogs": "/api/v1/auditlogs/",
            "dashboard": "/api/v1/dashboard/",
            "settings": "/api/v1/settings/",
            "project_donations": "/api/v1/project-donations/",
            "search": "/api/v1/search/api/",
        }
    })


urlpatterns = [
    path("", api_root, name="api_root"),
    path("admin/", admin.site.urls),

    # Versioned API namespace used by the standalone frontend. The app-level
    # URL files intentionally remain the single route source so legacy clients
    # and /api/v1 clients cannot drift.
    path("api/v1/accounts/", include(("accounts.urls", "accounts"), namespace="api_v1_accounts")),
    path("api/v1/members/", include(("members.urls", "members"), namespace="api_v1_members")),
    path("api/v1/executives/", include(("executives.urls", "executives"), namespace="api_v1_executives")),
    path("api/v1/elections/", include(("elections.urls", "elections"), namespace="api_v1_elections")),
    path("api/v1/finance/", include(("finance.urls", "finance"), namespace="api_v1_finance")),
    path("api/v1/projects/", include(("projects.urls", "projects"), namespace="api_v1_projects")),
    path("api/v1/operations/", include(("operations.urls", "operations"), namespace="api_v1_operations")),
    path("api/v1/notifications/", include(("notifications.urls", "notifications"), namespace="api_v1_notifications")),
    path("api/v1/auditlogs/", include(("auditlogs.urls", "auditlogs"), namespace="api_v1_auditlogs")),
    path("api/v1/dashboard/", include(("dashboard.urls", "dashboard"), namespace="api_v1_dashboard")),
    path("api/v1/settings/", include(("settingsapp.urls", "settingsapp"), namespace="api_v1_settingsapp")),
    path("api/v1/project-donations/", include(("project_donations.urls", "project_donations"), namespace="api_v1_project_donations")),
    path("api/v1/search/api/", global_search_ajax, name="api_v1_global_search_ajax"),

    # Backwards-compatible unversioned API aliases.
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
