"""
JSON API views for the standalone OYA frontend — auditlogs module.

Added alongside the existing auditlogs/views.py (left untouched — its
CSV export view is reused as-is, not reimplemented, since a file
download doesn't need a JSON wrapper).
"""
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .models import AuditLog

ENTITY_CHOICES = [
    "Member", "Executive", "Finance", "Project", "Donation",
    "Case", "Setting", "System", "Election", "Notification",
]


def _json(data, **kwargs):
    return JsonResponse(data, encoder=DjangoJSONEncoder, **kwargs)


def _serialize_log(log):
    return {
        "id": log.pk,
        "created_at": log.created_at,
        "user": (log.user.display_role or "User") + f" ({log.user.get_full_name() or log.user.serial_number})" if log.user_id else None,
        "action": log.action,
        "object_type": log.object_type,
        "object_id": log.object_id,
        "description": log.description,
        "ip_address": log.ip_address,
    }


@require_http_methods(["GET"])
def auditlog_list_api(request):
    """
    GET /auditlogs/api/list/?search=&action=&entity=&user_search=&date_from=&date_to=&page=
    Mirrors auditlogs.views.auditlog_list's filtering exactly.
    """
    if not request.user.is_authenticated:
        return _json({"detail": "Not authenticated."}, status=401)
    if not request.user.has_executive_access():
        return _json({"detail": "Executive access required."}, status=403)

    queryset = AuditLog.objects.select_related("user").all()

    search_term = request.GET.get("search", "").strip()
    if search_term:
        queryset = queryset.filter(
            Q(user__full_name__icontains=search_term)
            | Q(user__serial_number__icontains=search_term)
            | Q(action__icontains=search_term)
            | Q(object_type__icontains=search_term)
            | Q(description__icontains=search_term)
            | Q(ip_address__icontains=search_term)
        )
    action_filter = request.GET.get("action", "").strip()
    if action_filter:
        queryset = queryset.filter(action=action_filter)
    entity_filter = request.GET.get("entity", "").strip()
    if entity_filter:
        queryset = queryset.filter(object_type__iexact=entity_filter)
    user_search = request.GET.get("user_search", "").strip()
    if user_search:
        queryset = queryset.filter(
            Q(user__full_name__icontains=user_search) | Q(user__serial_number__icontains=user_search)
        )
    date_from = request.GET.get("date_from", "").strip()
    date_to = request.GET.get("date_to", "").strip()
    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)

    queryset = queryset.order_by("-created_at")

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    return _json({
        "logs": [_serialize_log(l) for l in page.object_list],
        "action_choices": AuditLog.ACTION_CHOICES,
        "entity_choices": ENTITY_CHOICES,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def auditlog_detail_api(request, pk):
    """GET /auditlogs/api/<pk>/detail/"""
    if not request.user.is_authenticated:
        return _json({"detail": "Not authenticated."}, status=401)
    if not request.user.has_executive_access():
        return _json({"detail": "Access denied."}, status=403)

    log = get_object_or_404(AuditLog.objects.select_related("user"), pk=pk)
    return _json({"log": _serialize_log(log)})

# Note: auditlog CSV export is served directly by the existing
# auditlogs.views.auditlog_export view (registered at
# /auditlogs/export/, unchanged) — a file download doesn't need a JSON
# wrapper, so the frontend just links straight to that URL with the
# current filters in the querystring, exactly like the original template did.
