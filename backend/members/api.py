"""
JSON API views for the standalone OYA frontend — members module.

Added alongside the existing members/views.py (left untouched — it still
powers the original templates and the existing api/stats + api/autocomplete
endpoints). These new views reuse the exact same querysets, forms
(MemberForm / MemberUpdateForm), permission checks, audit logging, and
cache invalidation as the template-based views — no business logic is
duplicated.

Drop this file in as members/api.py, then wire it up in members/urls.py
(see urls_patch.py in this same folder).
"""
import json

from dashboard.services import invalidate_dashboard_cache
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action
from core.utils import build_search_query
from .forms import MemberForm, MemberUpdateForm
from .models import Member, Clan


def _require_auth(request):
    """Returns a JsonResponse(401) if not authenticated, else None."""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)
    return None


def _require_executive(request):
    """Returns a JsonResponse(403) if the user lacks executive access, else None."""
    if not request.user.has_executive_access():
        return JsonResponse({"detail": "Executive access required."}, status=403)
    return None


def _serialize_member(member, detail=False):
    data = {
        "id": member.pk,
        "serial_number": member.serial_number,
        "full_name": member.full_name,
        "phone": member.phone,
        "age": member.age,
        "status": member.status,
        "status_display": member.get_status_display(),
        "position": getattr(member, "position", None),
        "is_taskforce": getattr(member, "is_taskforce", False),
        "state_or_abroad": member.state_or_abroad,
        "year_joined": member.year_joined,
        "photo_url": member.photo.url if member.photo and member.photo.name else None,
        "clan": {"id": member.umu_nna_clan_id, "name": member.umu_nna_clan.name} if member.umu_nna_clan_id else None,
    }
    if detail:
        data.update({
            "age_check": getattr(member, "age_check", None),
            "should_be_past_member": getattr(member, "should_be_past_member", None),
            "is_active_member": getattr(member, "is_active_member", member.status == "ACTIVE"),
            "is_past_member": getattr(member, "is_past_member", member.status == "PAST_MEMBER"),
            "removal_reason": member.removal_reason,
            "offense_committed": member.offense_committed,
            "created_at": member.created_at.isoformat() if member.created_at else None,
            "updated_at": member.updated_at.isoformat() if member.updated_at else None,
        })
    return data


@require_http_methods(["GET"])
def member_list_api(request):
    """
    GET /members/api/list/?search=&status=&clan=&order_by=&page=
    Mirrors members.views.member_list exactly (same filters, same
    Paginator page size of 25, same stats aggregate).
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth

    from django.db.models import Count, Q

    queryset = Member.objects.select_related("umu_nna_clan").prefetch_related(
        "executive_roles", "task_force_assignments"
    ).all()

    search_term = request.GET.get("search", "")
    if search_term:
        search_fields = ["serial_number", "full_name", "phone", "state_or_abroad", "umu_nna_clan__name"]
        queryset = queryset.filter(build_search_query(search_fields, search_term))

    status_filter = request.GET.get("status", "")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    clan_filter = request.GET.get("clan", "")
    if clan_filter:
        queryset = queryset.filter(umu_nna_clan_id=clan_filter)

    order_by = request.GET.get("order_by", "-created_at")
    queryset = queryset.order_by(order_by)

    paginator = Paginator(queryset, 25)
    page_number = request.GET.get("page", 1)
    page = paginator.get_page(page_number)

    stats = Member.objects.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status="ACTIVE")),
        past=Count("id", filter=Q(status="PAST_MEMBER")),
        removed=Count("id", filter=Q(status="REMOVED")),
    )

    return JsonResponse({
        "members": [_serialize_member(m) for m in page.object_list],
        "stats": stats,
        "clans": [{"id": c.id, "name": c.name} for c in Clan.objects.all()],
        "status_choices": Member.STATUS_CHOICES,
        "pagination": {
            "page": page.number,
            "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(),
            "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(),
            "end_index": page.end_index(),
            "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def member_detail_api(request, pk):
    """GET /members/api/<pk>/ — same fields as members.views.member_detail's core `member` context."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    member = get_object_or_404(Member.objects.select_related("umu_nna_clan"), pk=pk)
    return JsonResponse({"member": _serialize_member(member, detail=True)})


@require_http_methods(["POST"])
def member_create_api(request):
    """
    POST /members/api/create/  (multipart/form-data — the form includes a
    photo file upload, so this must NOT be sent as JSON.)
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = MemberForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({"errors": form.errors}, status=400)

    member = form.save()
    generated_pin = getattr(member, "_generated_pin", None)

    log_action(
        user=request.user,
        action="CREATE",
        object_type="Member",
        object_id=member.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Created member {member.serial_number} with login account",
    )
    invalidate_dashboard_cache()

    return JsonResponse({
        "member": _serialize_member(member),
        "generated_pin": generated_pin,  # show once, exactly like the template does
    }, status=201)


@require_http_methods(["POST"])
def member_update_api(request, pk):
    """POST /members/api/<pk>/update/ (multipart/form-data)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    member = get_object_or_404(Member, pk=pk)
    form = MemberUpdateForm(request.POST, request.FILES, instance=member)
    if not form.is_valid():
        return JsonResponse({"errors": form.errors}, status=400)

    member = form.save()
    updated_pin = getattr(member, "_updated_pin", None) or getattr(member, "_generated_pin", None)

    log_action(
        user=request.user,
        action="UPDATE",
        object_type="Member",
        object_id=member.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Updated member {member.serial_number}",
    )
    invalidate_dashboard_cache()

    return JsonResponse({
        "member": _serialize_member(member),
        "updated_pin": updated_pin,
    })


# ── Clans ────────────────────────────────────────────────────────
# Mirrors members.views.clan_list/clan_create exactly. There is no
# clan_update/clan_delete in the original app — Clan only has a `name`
# field and these two views are the entire feature.

@require_http_methods(["GET"])
def clan_list_api(request):
    """GET /members/api/clans/list/ — mirrors members.views.clan_list."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    from django.db.models import Count
    clans = Clan.objects.annotate(member_count=Count("members")).order_by("name")
    return JsonResponse({
        "results": [{"id": c.id, "name": c.name, "member_count": c.member_count} for c in clans]
    })


@require_http_methods(["POST"])
def clan_create_api(request):
    """POST /members/api/clans/create/ — mirrors members.views.clan_create (executive access required)."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    from .forms import ClanForm
    form = ClanForm(request.POST)
    if not form.is_valid():
        errors = [msg for error_list in form.errors.values() for msg in error_list]
        return JsonResponse({"errors": errors}, status=400)

    clan = form.save()
    log_action(
        user=request.user, action="CREATE", object_type="Clan", object_id=clan.id,
        ip_address=getattr(request, "client_ip", ""), description=f"Created clan {clan.name}",
    )
    invalidate_dashboard_cache()
    return JsonResponse({"detail": f"Clan '{clan.name}' created successfully.", "clan": {"id": clan.id, "name": clan.name, "member_count": 0}}, status=201)
