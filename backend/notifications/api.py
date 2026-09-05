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
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.core.paginator import Paginator
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_request_action
from .models import Notification
from .forms import NotificationForm


def _json(data, **kwargs):
    return JsonResponse(data, encoder=DjangoJSONEncoder, **kwargs)


def _visible_queryset(user):
    """Same role-based visibility rule used throughout notifications/views.py."""
    if user.has_admin_access():
        return Notification.objects.all()
    return Notification.objects.filter(Q(recipient=user) | Q(is_global=True))


def _serialize_notification(n):
    return {
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "notification_type": n.notification_type,
        "notification_type_display": n.get_notification_type_display(),
        "recipient": n.recipient.get_full_name() if n.recipient_id else None,
        "recipient_id": n.recipient_id,
        "is_read": n.is_read,
        "is_global": n.is_global,
        "created_at": n.created_at,
    }


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


@require_http_methods(["GET"])
def notification_list_api(request):
    """
    GET /notifications/api/notifications/?search=&type=&read=&page=
    Mirrors notifications.views.notification_list exactly (same filters,
    same tab counts, same 25-per-page pagination).
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    queryset = _visible_queryset(request.user)

    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(
            Q(title__icontains=search_term) | Q(message__icontains=search_term)
        )

    type_filter = request.GET.get("type", "")
    if type_filter:
        queryset = queryset.filter(notification_type=type_filter)

    read_filter = request.GET.get("read", "")
    if read_filter == "unread":
        queryset = queryset.filter(is_read=False)
    elif read_filter == "read":
        queryset = queryset.filter(is_read=True)

    queryset = queryset.order_by("-created_at")

    paginator = Paginator(queryset, 25)
    page = request.GET.get("page", 1)
    notifications = paginator.get_page(page)

    base_queryset = _visible_queryset(request.user)
    total_count = base_queryset.count()
    unread_count = base_queryset.filter(is_read=False).count()
    alert_count = base_queryset.filter(notification_type="ERROR").count()
    system_count = base_queryset.filter(notification_type="SYSTEM").count()

    return _json({
        "results": [_serialize_notification(n) for n in notifications.object_list],
        "page": notifications.number,
        "num_pages": notifications.paginator.num_pages,
        "has_next": notifications.has_next(),
        "has_previous": notifications.has_previous(),
        "count": notifications.paginator.count,
        "total_count": total_count,
        "unread_count": unread_count,
        "alert_count": alert_count,
        "system_count": system_count,
        "type_choices": Notification.NOTIFICATION_TYPES,
    })


@require_http_methods(["GET"])
def notification_detail_api(request, pk):
    """
    GET /notifications/api/notifications/<pk>/
    Mirrors notifications.views.notification_detail: same permission
    check, marks as read as a side effect of viewing — same as original.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    notification = get_object_or_404(Notification, pk=pk)

    if not notification.is_global and notification.recipient_id != request.user.id:
        if not request.user.has_admin_access():
            return JsonResponse({"detail": "You do not have permission to view this notification."}, status=403)

    notification.mark_as_read()
    return _json(_serialize_notification(notification))


@require_http_methods(["POST"])
def mark_all_read_api(request):
    """POST /notifications/api/mark-all-read/ — mirrors notifications.views.mark_all_read."""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    if request.user.has_admin_access():
        Notification.objects.filter(is_read=False).update(is_read=True)
    else:
        Notification.objects.filter(
            Q(recipient=request.user) | Q(is_global=True),
            is_read=False,
        ).update(is_read=True)
    return _json({"detail": "All notifications marked as read."})


@require_http_methods(["POST"])
def notification_create_api(request):
    """
    POST /notifications/api/notifications/create/
    Body: {"title","message","notification_type","recipient","is_global"}
    Mirrors notifications.views.notification_create: executive access
    required, same form/validation, same audit log entry.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)
    if not request.user.has_executive_access():
        return JsonResponse({"detail": "Executive access required."}, status=403)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"errors": ["Invalid request body."]}, status=400)

    form = NotificationForm(payload)
    if form.is_valid():
        notification = form.save()
        log_request_action(
            request,
            action="CREATE",
            object_type="Notification",
            object_id=notification.id,
            description=f"Created notification: {notification.title}",
        )
        return _json({"detail": "Notification sent successfully.", "notification": _serialize_notification(notification)})

    errors = [msg for error_list in form.errors.values() for msg in error_list]
    return JsonResponse({"errors": errors}, status=400)


@require_http_methods(["POST"])
def notification_delete_api(request, pk):
    """
    POST /notifications/api/notifications/<pk>/delete/
    Mirrors notifications.views.notification_delete: admin access required.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)
    if not request.user.has_admin_access():
        return JsonResponse({"detail": "Admin access required."}, status=403)

    notification = get_object_or_404(Notification, pk=pk)
    title = notification.title
    notification.delete()
    log_request_action(
        request,
        action="DELETE",
        object_type="Notification",
        object_id=pk,
        description=f"Deleted notification: {title}",
    )
    return _json({"detail": "Notification deleted."})
