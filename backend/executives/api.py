"""
JSON API views for the standalone OYA frontend — executives module.

Added alongside the existing executives/views.py (left untouched).
Reuses ExecutiveForm as-is (same member-exclusion/validation rules),
plus the same "available members" queryset logic the create/update
views already use.

Note on permissions: the original executive_list.html template only
shows the Add/Edit/End-Tenure UI to `user.is_superuser`, while the
actual create/update/end_tenure *views* check `has_executive_access()`.
This is a pre-existing mismatch in the original app (a non-superuser
executive could reach those URLs directly even though the UI hides the
buttons from them). This API preserves both behaviors exactly as they
are: the frontend gates buttons on `is_superuser` (matching the
template), while these endpoints enforce `has_executive_access()`
(matching the views) — nothing was "fixed" here since it's not clearly
a bug, just an existing inconsistency worth knowing about.

Drop this file in as executives/api.py, then wire it up in
executives/urls.py (see urls_patch.py in this same folder).
"""
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action
from members.models import Member

from .forms import ExecutiveForm
from .models import Executive


def _json(data, **kwargs):
    return JsonResponse(data, encoder=DjangoJSONEncoder, **kwargs)


def _require_auth(request):
    if not request.user.is_authenticated:
        return _json({"detail": "Not authenticated."}, status=401)
    return None


def _require_executive(request):
    if not request.user.has_executive_access():
        return _json({"detail": "Executive access required."}, status=403)
    return None


def _serialize_executive(e):
    return {
        "id": e.pk,
        "post": e.post,
        "start_date": e.start_date,
        "end_date": e.end_date,
        "is_current": e.is_current,
        "member": {
            "id": e.member_id,
            "full_name": e.member.full_name,
            "serial_number": e.member.serial_number,
            "phone": e.member.phone,
            "photo_url": e.member.photo.url if e.member.photo and e.member.photo.name else None,
        },
    }


def _available_members(exclude_current_pk=None):
    """Mirrors executive_create/executive_update's available_members logic."""
    assigned_qs = Executive.objects.filter(is_current=True)
    if exclude_current_pk:
        assigned_qs = assigned_qs.exclude(pk=exclude_current_pk)
    assigned_member_ids = assigned_qs.values_list("member_id", flat=True)
    qs = Member.objects.filter(status="ACTIVE").exclude(id__in=assigned_member_ids)

    if exclude_current_pk:
        executive = Executive.objects.filter(pk=exclude_current_pk).first()
        if executive and executive.member_id not in qs.values_list("id", flat=True):
            qs = Member.objects.filter(Q(id=executive.member_id) | Q(id__in=qs.values_list("id", flat=True)))

    return qs.select_related("umu_nna_clan").order_by("full_name")


def _serialize_member_option(m):
    return {
        "id": m.pk,
        "full_name": m.full_name,
        "serial_number": m.serial_number,
        "clan": m.umu_nna_clan.name if m.umu_nna_clan_id else None,
    }


@require_http_methods(["GET"])
def executive_list_api(request):
    """GET /executives/api/list/?search=&status=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    qs = Executive.objects.select_related("member").all()

    search_term = request.GET.get("search", "")
    if search_term:
        qs = qs.filter(
            Q(member__full_name__icontains=search_term)
            | Q(member__serial_number__icontains=search_term)
            | Q(post__icontains=search_term)
        )
    status_filter = request.GET.get("status", "")
    if status_filter == "current":
        qs = qs.filter(is_current=True)
    elif status_filter == "past":
        qs = qs.filter(is_current=False)

    qs = qs.order_by("-is_current", "-start_date")

    paginator = Paginator(qs, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    current_executives = Executive.objects.filter(is_current=True).select_related("member").order_by("post")

    return _json({
        "executives": [_serialize_executive(e) for e in page.object_list],
        "current_executives": [_serialize_executive(e) for e in current_executives],
        "total_executives": Executive.objects.count(),
        "current_count": Executive.objects.filter(is_current=True).count(),
        "post_choices": Executive.POST_CHOICES,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def executive_detail_api(request, pk):
    """
    GET /executives/api/<pk>/
    Scope note: the original executive_detail view also surfaces the
    member's latest election manifesto and handover records — the
    elections app isn't migrated yet, so those aren't included here.
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth
    executive = get_object_or_404(Executive.objects.select_related("member"), pk=pk)
    return _json({"executive": _serialize_executive(executive)})


@require_http_methods(["GET"])
def executive_form_meta_api(request, pk=None):
    """GET /executives/api/form-meta/ or /executives/api/<pk>/form-meta/ — available members + post choices for the create/edit form."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    members = _available_members(exclude_current_pk=pk)
    return _json({
        "available_members": [_serialize_member_option(m) for m in members],
        "post_choices": Executive.POST_CHOICES,
    })


@require_http_methods(["POST"])
def executive_create_api(request):
    """POST /executives/api/create/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = ExecutiveForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    executive = form.save()
    log_action(
        user=request.user, action="CREATE", object_type="Executive", object_id=executive.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Assigned {executive.post} to {executive.member.full_name}",
    )
    return _json({"executive": _serialize_executive(executive)}, status=201)


@require_http_methods(["POST"])
def executive_update_api(request, pk):
    """POST /executives/api/<pk>/update/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    executive = get_object_or_404(Executive, pk=pk)
    form = ExecutiveForm(request.POST, instance=executive)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    executive = form.save()
    log_action(
        user=request.user, action="UPDATE", object_type="Executive", object_id=executive.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Updated {executive.post} for {executive.member.full_name}",
    )
    return _json({"executive": _serialize_executive(executive)})


@require_http_methods(["POST"])
def executive_end_tenure_api(request, pk):
    """POST /executives/api/<pk>/end-tenure/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    executive = get_object_or_404(Executive, pk=pk)
    executive.end_date = timezone.now().date()
    executive.is_current = False
    executive.save()

    log_action(
        user=request.user, action="UPDATE", object_type="Executive", object_id=executive.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Ended tenure for {executive.post} - {executive.member.full_name}",
    )
    return _json({"executive": _serialize_executive(executive)})
