"""
JSON API view for the standalone OYA frontend — notifications module.

Note: templates/base.html's inline JS already calls
`fetch('/notifications/api/unread-count/')` on every page (see the
"NOTIFICATIONS" block near the bottom of base.html) — but that URL was
never registered in notifications/urls.py, so it has always silently
failed (wrapped in .catch(() => {})). This view + its URL registration
fixes that pre-existing dead endpoint, and the standalone frontend's
shell.js relies on it for the sidebar/topbar/mobile badge counts.

Reuses the exact same base_queryset logic as notifications/views.py's
notification_list() view (role-based: admins see all notifications,
everyone else sees their own + global ones), then the same
`.filter(is_read=False).count()` it already uses for its unread tab count.
"""
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .models import Notification


@require_http_methods(["GET"])
def unread_count_api(request):
    """GET /notifications/api/unread-count/"""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    if request.user.has_admin_access():
        base_queryset = Notification.objects.all()
    else:
        base_queryset = Notification.objects.filter(
            Q(recipient=request.user) | Q(is_global=True)
        )
    unread_count = base_queryset.filter(is_read=False).count()
    return JsonResponse({"unread_count": unread_count})
