"""
JSON API views for the standalone OYA frontend — operations module
(task force, motorcycles, case files).

Added alongside the existing operations/views.py (left untouched).
Reuses TaskForceMemberForm / MotorcycleForm / CaseFileForm /
CaseResolutionForm exactly, plus the same "auto-record case fine as
Income" logic verbatim from case_create/case_resolve — not duplicated
elsewhere, called the same way here.
"""
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q, Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action
from dashboard.services import invalidate_dashboard_cache
from finance.models import Income

from .forms import TaskForceMemberForm, MotorcycleForm, CaseFileForm, CaseResolutionForm
from .models import TaskForceMember, Motorcycle, CaseFile


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


# ── Task Force ──────────────────────────────────────────────────

def _serialize_tf(tf):
    return {
        "id": tf.pk,
        "member": {
            "id": tf.member_id,
            "full_name": tf.member.full_name,
            "serial_number": tf.member.serial_number,
            "clan": tf.member.umu_nna_clan.name if tf.member.umu_nna_clan_id else None,
        },
        "assigned_date": tf.assigned_date,
        "notes": tf.notes,
        "is_active": tf.is_active,
    }


@require_http_methods(["GET"])
def taskforce_list_api(request):
    """GET /operations/api/taskforce/list/?status=active|inactive&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = TaskForceMember.objects.select_related("member", "member__umu_nna_clan").all()
    status_filter = request.GET.get("status", "")
    if status_filter == "active":
        queryset = queryset.filter(is_active=True)
    elif status_filter == "inactive":
        queryset = queryset.filter(is_active=False)

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    stats = TaskForceMember.objects.aggregate(
        total=Count("id"), active=Count("id", filter=Q(is_active=True)), inactive=Count("id", filter=Q(is_active=False)),
    )

    return _json({
        "taskforce": [_serialize_tf(tf) for tf in page.object_list],
        "stats": stats,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def taskforce_form_meta_api(request):
    """GET /operations/api/taskforce/form-meta/ — available members for assignment."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    from members.models import Member
    from executives.models import Executive

    assigned_ids = TaskForceMember.objects.filter(is_active=True).values_list("member_id", flat=True)
    current_executive_ids = Executive.objects.filter(is_current=True).values_list("member_id", flat=True)
    available_members = Member.objects.filter(status="ACTIVE").exclude(id__in=assigned_ids).exclude(id__in=current_executive_ids).order_by("full_name")
    return _json({"available_members": [{"id": m.pk, "full_name": m.full_name, "serial_number": m.serial_number} for m in available_members]})


@require_http_methods(["POST"])
def taskforce_create_api(request):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = TaskForceMemberForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    tf = form.save()
    log_action(user=request.user, action="CREATE", object_type="TaskForceMember", object_id=tf.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Assigned {tf.member.full_name} to task force")
    invalidate_dashboard_cache()
    return _json({"taskforce": _serialize_tf(tf)}, status=201)


@require_http_methods(["GET"])
def taskforce_detail_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    tf = get_object_or_404(TaskForceMember.objects.select_related("member"), pk=pk)
    return _json({"taskforce": _serialize_tf(tf)})


@require_http_methods(["POST"])
def taskforce_update_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    tf = get_object_or_404(TaskForceMember, pk=pk)
    form = TaskForceMemberForm(request.POST, instance=tf)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    tf = form.save()
    log_action(user=request.user, action="UPDATE", object_type="TaskForceMember", object_id=tf.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Updated task force assignment for {tf.member.full_name}")
    invalidate_dashboard_cache()
    return _json({"taskforce": _serialize_tf(tf)})


@require_http_methods(["POST"])
def taskforce_remove_api(request, pk):
    """POST /operations/api/taskforce/<pk>/remove/ — soft-remove (is_active=False), same as the original view."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    tf = get_object_or_404(TaskForceMember, pk=pk)
    tf.is_active = False
    tf.save()
    log_action(user=request.user, action="UPDATE", object_type="TaskForceMember", object_id=tf.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Removed {tf.member.full_name} from task force")
    invalidate_dashboard_cache()
    return _json({"taskforce": _serialize_tf(tf)})


# ── Motorcycles ──────────────────────────────────────────────────

def _serialize_mc(mc):
    return {
        "id": mc.pk,
        "asset_tag": mc.asset_tag,
        "brand": mc.brand,
        "model": mc.model,
        "year": mc.year,
        "condition": mc.condition,
        "condition_display": mc.get_condition_display(),
        "assigned_to": {"id": mc.assigned_to_id, "full_name": mc.assigned_to.full_name} if mc.assigned_to_id else None,
    }


@require_http_methods(["GET"])
def motorcycle_list_api(request):
    """GET /operations/api/motorcycles/list/?search=&condition=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = Motorcycle.objects.select_related("assigned_to").all()
    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(Q(asset_tag__icontains=search_term) | Q(brand__icontains=search_term) | Q(model__icontains=search_term))
    condition_filter = request.GET.get("condition", "")
    if condition_filter:
        queryset = queryset.filter(condition=condition_filter)

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    stats = Motorcycle.objects.aggregate(
        total=Count("id"),
        excellent=Count("id", filter=Q(condition="EXCELLENT")),
        needs_service=Count("id", filter=Q(condition="NEEDS_SERVICE")),
        grounded=Count("id", filter=Q(condition="GROUNDED")),
    )

    return _json({
        "motorcycles": [_serialize_mc(mc) for mc in page.object_list],
        "stats": stats,
        "condition_choices": Motorcycle.CONDITION_CHOICES,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def motorcycle_form_meta_api(request):
    """GET /operations/api/motorcycles/form-meta/ — active members for the assigned_to select."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    from members.models import Member
    members = Member.objects.filter(status="ACTIVE").order_by("full_name")
    return _json({
        "members": [{"id": m.pk, "full_name": m.full_name} for m in members],
        "condition_choices": Motorcycle.CONDITION_CHOICES,
    })


@require_http_methods(["GET"])
def motorcycle_detail_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    mc = get_object_or_404(Motorcycle.objects.select_related("assigned_to"), pk=pk)
    return _json({"motorcycle": _serialize_mc(mc)})


@require_http_methods(["POST"])
def motorcycle_create_api(request):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = MotorcycleForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    mc = form.save()
    log_action(user=request.user, action="CREATE", object_type="Motorcycle", object_id=mc.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Registered motorcycle {mc.asset_tag}")
    invalidate_dashboard_cache()
    return _json({"motorcycle": _serialize_mc(mc)}, status=201)


@require_http_methods(["POST"])
def motorcycle_update_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    mc = get_object_or_404(Motorcycle, pk=pk)
    form = MotorcycleForm(request.POST, instance=mc)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    mc = form.save()
    log_action(user=request.user, action="UPDATE", object_type="Motorcycle", object_id=mc.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Updated motorcycle {mc.asset_tag}")
    invalidate_dashboard_cache()
    return _json({"motorcycle": _serialize_mc(mc)})


@require_http_methods(["DELETE"])
def motorcycle_delete_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    mc = get_object_or_404(Motorcycle, pk=pk)
    asset_tag = mc.asset_tag
    mc.delete()
    log_action(user=request.user, action="DELETE", object_type="Motorcycle", object_id=pk,
               ip_address=getattr(request, "client_ip", ""), description=f"Deleted motorcycle {asset_tag}")
    invalidate_dashboard_cache()
    return _json({"detail": "Deleted."})


# ── Case Files ───────────────────────────────────────────────────

def _serialize_case(c, detail=False):
    data = {
        "id": c.pk,
        "case_number": c.case_number,
        "title": c.title,
        "status": c.status,
        "status_display": c.get_status_display(),
        "fine_amount": c.fine_amount,
        "respondent": {"id": c.respondent_id, "full_name": c.respondent.full_name} if c.respondent_id else None,
        "created_at": c.created_at,
    }
    if detail:
        data.update({
            "description": c.description,
            "reported_to": {"id": c.reported_to_id, "name": c.reported_to.member.full_name} if c.reported_to_id else None,
            "resolved_by": {"id": c.resolved_by_id, "name": c.resolved_by.member.full_name} if c.resolved_by_id else None,
            "created_by": c.created_by.get_full_name() if c.created_by_id else None,
            "resolution_notes": c.resolution_notes,
            "resolved_date": c.resolved_date,
        })
    return data


def _record_fine_if_needed(case, request):
    """Verbatim copy of the auto-record-fine-as-income block from case_create/case_resolve."""
    if case.fine_amount and case.fine_amount > 0:
        income, created = Income.objects.get_or_create(
            case=case, income_type="CASE_FINE",
            defaults={
                "amount": case.fine_amount,
                "reason": f"Fine for case {case.case_number}: {case.title}",
                "paid_by": case.respondent.full_name if case.respondent else "Unknown",
                "created_by": request.user,
            },
        )
        if created:
            log_action(user=request.user, action="CREATE", object_type="Income", object_id=income.id,
                       ip_address=getattr(request, "client_ip", ""),
                       description=f"Recorded case fine: \u20a6{case.fine_amount:,.2f} for {case.case_number}")
        return created
    return False


@require_http_methods(["GET"])
def case_list_api(request):
    """GET /operations/api/cases/list/?search=&status=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = CaseFile.objects.select_related("respondent", "created_by").all()
    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(Q(title__icontains=search_term) | Q(case_number__icontains=search_term) | Q(respondent__full_name__icontains=search_term))
    status_filter = request.GET.get("status", "")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    stats = CaseFile.objects.aggregate(
        open=Count("id", filter=Q(status="OPEN")),
        in_progress=Count("id", filter=Q(status="IN_PROGRESS")),
        resolved=Count("id", filter=Q(status="RESOLVED")),
        total=Count("id"),
    )

    return _json({
        "cases": [_serialize_case(c) for c in page.object_list],
        "stats": stats,
        "status_choices": CaseFile.STATUS_CHOICES,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def case_form_meta_api(request, pk=None):
    """GET /operations/api/cases/form-meta/ or /<pk>/form-meta/ — respondent + reported_to choices, mirroring CaseFileForm.__init__."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    from members.models import Member
    from core.utils import exclude_removed_members
    from django.db.models import Q as _Q

    respondent_qs = exclude_removed_members(Member.objects.all())
    if pk:
        case = get_object_or_404(CaseFile, pk=pk)
        if case.respondent_id:
            respondent_qs = Member.objects.filter(_Q(pk=case.respondent_id) | _Q(pk__in=respondent_qs.values_list("pk", flat=True)))
    respondent_qs = respondent_qs.order_by("full_name")

    reported_to_qs = TaskForceMember.objects.filter(is_active=True).exclude(member__status="REMOVED").select_related("member").order_by("member__full_name")

    return _json({
        "respondents": [{"id": m.pk, "full_name": m.full_name} for m in respondent_qs],
        "task_force_members": [{"id": t.pk, "name": t.member.full_name} for t in reported_to_qs],
        "status_choices": CaseFile.STATUS_CHOICES,
    })


@require_http_methods(["GET"])
def case_detail_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    case = get_object_or_404(CaseFile.objects.select_related("respondent", "created_by", "reported_to__member", "resolved_by__member"), pk=pk)
    return _json({"case": _serialize_case(case, detail=True)})


@require_http_methods(["POST"])
def case_create_api(request):
    """POST /operations/api/cases/create/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = CaseFileForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    case = form.save(commit=False)
    case.created_by = request.user
    case.save()
    _record_fine_if_needed(case, request)

    log_action(user=request.user, action="CREATE", object_type="CaseFile", object_id=case.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Created case {case.case_number}: {case.title}")
    invalidate_dashboard_cache()
    return _json({"case": _serialize_case(case, detail=True)}, status=201)


@require_http_methods(["POST"])
def case_update_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    case = get_object_or_404(CaseFile, pk=pk)
    form = CaseFileForm(request.POST, instance=case)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    case = form.save()
    if case.status == "RESOLVED":
        _record_fine_if_needed(case, request)
    log_action(user=request.user, action="UPDATE", object_type="CaseFile", object_id=case.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Updated case {case.case_number}")
    invalidate_dashboard_cache()
    return _json({"case": _serialize_case(case, detail=True)})


@require_http_methods(["POST"])
def case_resolve_api(request, pk):
    """POST /operations/api/cases/<pk>/resolve/ (JSON body) — same auto-fine-as-income logic as the original view."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    case = get_object_or_404(CaseFile, pk=pk)
    form = CaseResolutionForm(request.POST, instance=case)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    case = form.save()
    fine_recorded = _record_fine_if_needed(case, request)

    log_action(user=request.user, action="UPDATE", object_type="CaseFile", object_id=case.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Resolved case {case.case_number}: {case.status}")
    invalidate_dashboard_cache()
    return _json({"case": _serialize_case(case, detail=True), "fine_recorded": fine_recorded})


@require_http_methods(["DELETE"])
def case_delete_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    case = get_object_or_404(CaseFile, pk=pk)
    case_number = case.case_number
    case.delete()
    log_action(user=request.user, action="DELETE", object_type="CaseFile", object_id=pk,
               ip_address=getattr(request, "client_ip", ""), description=f"Deleted case {case_number}")
    invalidate_dashboard_cache()
    return _json({"detail": "Deleted."})
