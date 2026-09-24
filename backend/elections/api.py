"""
JSON API views for the standalone OYA frontend — elections module.

Scope: Election CRUD + Candidate CRUD + voting + full Handover Ledger
and Previous Administration report JSON endpoints for the standalone
frontend. All calculations are still delegated to elections.models and
elections.administrations so election/handover business rules remain
server-side.

Added alongside the existing elections/views.py (left untouched).
Reuses ElectionForm / CandidateForm exactly. Election result
processing (Election.process_election_results()) is signal-driven
(see elections/signals.py) and fires on Election.save() regardless of
whether the save happens through the old view or this API — so it is
NOT reimplemented here, only triggered via form.save() same as before.
"""
from decimal import Decimal

from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q, Sum
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action
from dashboard.services import invalidate_dashboard_cache

from .forms import ElectionForm, CandidateForm, HandoverLedgerForm
from .models import Election, Candidate, Vote, HandoverLedger


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




def _choice_label(value, choices):
    return dict(choices).get(value, value)


def _member_label(member):
    if not member:
        return None
    return {
        "id": member.pk,
        "full_name": getattr(member, "full_name", str(member)),
        "serial_number": getattr(member, "serial_number", ""),
        "label": getattr(member, "full_name", str(member)),
    }


def _user_label(user):
    if not user:
        return None
    name = user.get_full_name() if hasattr(user, "get_full_name") else str(user)
    return {
        "id": user.pk,
        "full_name": name,
        "serial_number": getattr(user, "serial_number", ""),
        "label": name,
    }


def _object_label(obj):
    if obj is None:
        return ""
    for attr in ("full_name", "title", "name", "case_number", "asset_tag", "reason", "description"):
        value = getattr(obj, attr, None)
        if value:
            return str(value)
    return str(obj)


def _serialize_model(obj):
    """Small, bounded summaries for model instances inside handover reports.

    The handover/administration engine returns real model objects and querysets
    because the original templates rendered them directly. JSON callers need a
    safe, display-focused shape instead of raw model internals.
    """
    if obj is None:
        return None

    model_name = obj.__class__.__name__
    data = {"id": getattr(obj, "pk", None), "label": _object_label(obj)}

    if hasattr(obj, "created_at"):
        data["created_at"] = obj.created_at
    if hasattr(obj, "updated_at"):
        data["updated_at"] = obj.updated_at

    if model_name == "Executive":
        data.update({
            "full_name": obj.member.full_name if getattr(obj, "member_id", None) else "",
            "post": obj.post,
            "post_display": obj.get_post_display() if hasattr(obj, "get_post_display") else obj.post,
            "start_date": obj.start_date,
            "end_date": obj.end_date,
            "is_current": obj.is_current,
            "member": _member_label(obj.member) if getattr(obj, "member_id", None) else None,
        })
    elif model_name == "Election":
        data.update({
            "title": obj.title,
            "status": obj.status,
            "status_display": obj.get_status_display() if hasattr(obj, "get_status_display") else obj.status,
            "start_date": obj.start_date,
            "end_date": obj.end_date,
        })
    elif model_name == "Income":
        data.update({
            "reason": obj.reason,
            "amount": obj.amount,
            "income_type": obj.income_type,
            "income_type_display": obj.get_income_type_display() if hasattr(obj, "get_income_type_display") else obj.income_type,
            "payer": obj.get_payer_display() if hasattr(obj, "get_payer_display") else "",
        })
    elif model_name == "Expense":
        data.update({
            "description": obj.description,
            "amount": obj.amount,
            "category": getattr(obj, "category", ""),
        })
    elif model_name == "DuesPaymentTransaction":
        data.update({
            "member": _user_label(obj.member) if getattr(obj, "member_id", None) else None,
            "amount": obj.total_amount,
            "total_amount": obj.total_amount,
            "payment_date": obj.payment_date,
            "payment_method": obj.payment_method,
            "receipt_reference": obj.receipt_reference,
        })
    elif model_name == "Project":
        data.update({
            "title": obj.title,
            "status": obj.status,
            "status_display": obj.get_status_display() if hasattr(obj, "get_status_display") else obj.status,
            "budget": getattr(obj, "budget", None),
            "progress_percentage": getattr(obj, "progress_percentage", None),
        })
    elif model_name == "CaseFile":
        data.update({
            "case_number": obj.case_number,
            "title": obj.title,
            "status": obj.status,
            "status_display": obj.get_status_display() if hasattr(obj, "get_status_display") else obj.status,
            "fine_amount": obj.fine_amount,
            "resolved_date": obj.resolved_date,
            "respondent": _member_label(obj.respondent) if getattr(obj, "respondent_id", None) else None,
        })
    elif model_name == "TaskForceMember":
        data.update({
            "member": _member_label(obj.member) if getattr(obj, "member_id", None) else None,
            "full_name": obj.member.full_name if getattr(obj, "member_id", None) else "",
            "assigned_date": obj.assigned_date,
            "is_active": obj.is_active,
            "status": "Active" if obj.is_active else "Inactive",
            "notes": obj.notes,
        })
    elif model_name == "Motorcycle":
        data.update({
            "asset_tag": obj.asset_tag,
            "brand": obj.brand,
            "model": obj.model,
            "year": obj.year,
            "condition": obj.condition,
            "condition_display": obj.get_condition_display() if hasattr(obj, "get_condition_display") else obj.condition,
            "status": "Assigned" if getattr(obj, "assigned_to_id", None) else "In Store",
            "assigned_to": _member_label(obj.assigned_to) if getattr(obj, "assigned_to_id", None) else None,
        })
    elif model_name == "Donation":
        donor = getattr(obj, "member", None) or getattr(obj, "outside_donor", None)
        data.update({
            "project": _serialize_model(obj.project) if getattr(obj, "project_id", None) else None,
            "donor": _member_label(donor) if donor and donor.__class__.__name__ == "Member" else (_serialize_model(donor) if donor else None),
            "amount": getattr(obj, "amount", None),
            "estimated_value": getattr(obj, "estimated_value", None),
            "donation_date": getattr(obj, "donation_date", None),
            "donation_type": getattr(obj, "donation_type", ""),
            "status": getattr(obj, "status", ""),
        })
    elif model_name == "Pledge":
        donor = getattr(obj, "member", None) or getattr(obj, "outside_donor", None)
        data.update({
            "project": _serialize_model(obj.project) if getattr(obj, "project_id", None) else None,
            "donor": _member_label(donor) if donor and donor.__class__.__name__ == "Member" else (_serialize_model(donor) if donor else None),
            "pledged_amount": getattr(obj, "pledged_amount", None),
            "outstanding_balance": getattr(obj, "outstanding_balance", None),
            "donation_type": getattr(obj, "donation_type", ""),
            "status": getattr(obj, "status", ""),
        })
    elif model_name == "OutsideDonor":
        data.update({"full_name": obj.full_name, "phone_number": obj.phone_number})
    elif model_name == "DonationGroup":
        data.update({
            "name": obj.name,
            "description": getattr(obj, "description", ""),
            "is_active": getattr(obj, "is_active", None),
            "member_count": getattr(obj, "member_count", None),
            "total_realized": getattr(obj, "total_money_donated", None),
        })
    elif model_name == "Member":
        data.update(_member_label(obj))
    elif model_name == "User":
        data.update(_user_label(obj))
    elif model_name == "HandoverLedger":
        data.update(_serialize_handover(obj))

    return data


def _serialize_any(value):
    if value is None or isinstance(value, (str, int, float, bool, Decimal)):
        return value
    if hasattr(value, "isoformat") and value.__class__.__module__.startswith("datetime"):
        return value
    if hasattr(value, "model") and hasattr(value, "all"):
        return [_serialize_any(v) for v in value]
    if isinstance(value, (list, tuple, set)):
        return [_serialize_any(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_any(v) for k, v in value.items()}
    if hasattr(value, "_meta"):
        return _serialize_model(value)
    return str(value)


def _serialize_administration(admin):
    election = admin.get("election")
    return {
        "key": admin.get("key"),
        "name": admin.get("name"),
        "status": admin.get("status"),
        "is_current": admin.get("is_current"),
        "tenure_start": admin.get("tenure_start"),
        "tenure_end": admin.get("tenure_end"),
        "member_count": admin.get("member_count", 0),
        "election": _serialize_model(election) if election else None,
        "executives": [_serialize_model(e) for e in admin.get("executives", [])],
    }


def _serialize_report(report):
    if not report:
        return None
    serialized = {k: _serialize_any(v) for k, v in report.items() if k != "administration"}
    serialized["administration"] = _serialize_administration(report["administration"])
    if isinstance(serialized.get("extra_sections"), list):
        sections = serialized["extra_sections"]
        serialized["extra_sections"] = {
            "items": sections,
            "counts": {"sections": len(sections)},
            "description": "Additional registered report sections.",
        }
    return serialized


def _serialize_election(e):
    return {
        "id": e.pk,
        "title": e.title,
        "start_date": e.start_date,
        "end_date": e.end_date,
        "status": e.status,
        "status_display": e.get_status_display(),
        "description": e.description,
        "candidate_count": getattr(e, "candidate_count", None) or e.candidates.count(),
    }


def _serialize_candidate(c, voted_posts=None):
    return {
        "id": c.pk,
        "election_id": c.election_id,
        "post": c.post,
        "votes": c.votes,
        "manifesto": c.manifesto,
        "photo_url": c.photo.url if c.photo and c.photo.name else None,
        "member": {
            "id": c.member_id,
            "full_name": c.member.full_name,
            "serial_number": c.member.serial_number,
        },
        "already_voted": (voted_posts is not None and c.post in voted_posts),
    }


@require_http_methods(["GET"])
def election_list_api(request):
    """GET /elections/api/list/?search=&status=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = Election.objects.all()
    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(Q(title__icontains=search_term) | Q(description__icontains=search_term))
    status_filter = request.GET.get("status", "")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    return _json({
        "elections": [_serialize_election(e) for e in page.object_list],
        "status_choices": Election.STATUS_CHOICES,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def election_detail_api(request, pk):
    """GET /elections/api/<pk>/ — mirrors elections.views.election_detail exactly."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    election = get_object_or_404(Election.objects.prefetch_related("candidates"), pk=pk)
    candidates = election.candidates.select_related("member").all()

    voted_posts = set()
    try:
        voted_posts = set(Vote.objects.filter(voter=request.user, election=election).values_list("post", flat=True))
    except OperationalError:
        pass

    return _json({
        "election": _serialize_election(election),
        "candidates": [_serialize_candidate(c, voted_posts) for c in candidates],
        "can_manage": request.user.has_executive_access(),
    })


@require_http_methods(["POST"])
def election_create_api(request):
    """POST /elections/api/create/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = ElectionForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    election = form.save()
    log_action(
        user=request.user, action="CREATE", object_type="Election", object_id=election.id,
        ip_address=getattr(request, "client_ip", ""), description=f"Created election: {election.title}",
    )
    invalidate_dashboard_cache()
    return _json({"election": _serialize_election(election)}, status=201)


@require_http_methods(["POST"])
def election_update_api(request, pk):
    """
    POST /elections/api/<pk>/update/ (JSON body)
    Note: if this update transitions status to COMPLETED, the same
    post_save signal that runs for the original view fires here too —
    process_election_results() is not bypassed or duplicated.
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    election = get_object_or_404(Election, pk=pk)
    form = ElectionForm(request.POST, instance=election)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    election = form.save()
    log_action(
        user=request.user, action="UPDATE", object_type="Election", object_id=election.id,
        ip_address=getattr(request, "client_ip", ""), description=f"Updated election: {election.title}",
    )
    invalidate_dashboard_cache()
    return _json({"election": _serialize_election(election)})


@require_http_methods(["GET"])
def candidate_form_meta_api(request):
    """GET /elections/api/candidates/form-meta/ — member + post choices for the add-candidate form."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    from executives.models import Executive
    from members.models import Member

    members = Member.objects.filter(status="ACTIVE").order_by("full_name")
    return _json({
        "members": [{"id": m.pk, "full_name": m.full_name, "serial_number": m.serial_number} for m in members],
        "post_choices": Executive.POST_CHOICES,
    })


@require_http_methods(["POST"])
def candidate_create_api(request):
    """POST /elections/api/candidates/create/ (multipart/form-data — photo upload)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = CandidateForm(request.POST, request.FILES)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    candidate = form.save()
    log_action(
        user=request.user, action="CREATE", object_type="Candidate", object_id=candidate.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Added candidate {candidate.member.full_name} for {candidate.post}",
    )
    invalidate_dashboard_cache()
    return _json({"candidate": _serialize_candidate(candidate)}, status=201)


@require_http_methods(["GET"])
def candidate_detail_api(request, pk):
    """GET /elections/api/candidates/<pk>/ — used by candidate-form.html to pre-fill on edit."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    candidate = get_object_or_404(Candidate.objects.select_related("member", "election"), pk=pk)
    return _json({"candidate": _serialize_candidate(candidate)})


@require_http_methods(["POST"])
def candidate_update_api(request, pk):
    """POST /elections/api/candidates/<pk>/update/ (multipart/form-data)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    candidate = get_object_or_404(Candidate, pk=pk)
    form = CandidateForm(request.POST, request.FILES, instance=candidate)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    candidate = form.save()
    log_action(
        user=request.user, action="UPDATE", object_type="Candidate", object_id=candidate.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Updated candidate {candidate.member.full_name} for {candidate.post}",
    )
    invalidate_dashboard_cache()
    return _json({"candidate": _serialize_candidate(candidate)})


@require_http_methods(["POST"])
def cast_vote_api(request, pk):
    """
    POST /elections/api/candidates/<pk>/vote/
    Mirrors elections.views.cast_vote's logic and error cases exactly
    (ongoing-only, one vote per post per election).
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth

    candidate = get_object_or_404(Candidate.objects.select_related("election", "member"), pk=pk)
    election = candidate.election

    if election.status != "ONGOING":
        return _json({"detail": "Voting is only allowed for ongoing elections."}, status=400)

    try:
        already_voted = Vote.objects.filter(voter=request.user, election=election, post=candidate.post).exists()
    except OperationalError:
        return _json({"detail": "Voting system is temporarily unavailable. Please try again later."}, status=503)

    if already_voted:
        return _json({"detail": f"You have already voted for {candidate.post} in this election."}, status=409)

    with transaction.atomic():
        Vote.objects.create(voter=request.user, election=election, candidate=candidate, post=candidate.post)
        candidate.votes += 1
        candidate.save(update_fields=["votes"])

    log_action(
        user=request.user, action="VOTE", object_type="Candidate", object_id=candidate.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Voted for {candidate.member.full_name} ({candidate.post}) in {election.title}",
    )
    invalidate_dashboard_cache()
    return _json({"candidate": _serialize_candidate(candidate)})


# ── Handover Ledger (list only — see module docstring) ──────────────

def _serialize_handover(h):
    return {
        "id": h.pk,
        "executive": {
            "id": h.executive_id,
            "full_name": h.executive.member.full_name,
            "post": h.executive.post,
        } if h.executive_id else None,
        "election": {"id": h.election_id, "title": h.election.title} if h.election_id else None,
        "tenure_start": h.tenure_start,
        "tenure_end": h.tenure_end,
        "cash_remaining": h.cash_remaining,
        "total_income": h.total_income,
        "total_dues": h.total_dues,
        "total_donations": h.total_donations,
        "taskforce_revenue": h.taskforce_revenue,
        "total_expenses": h.total_expenses,
        "created_at": h.created_at,
    }


@require_http_methods(["GET"])
def handover_list_api(request):
    """GET /elections/api/handovers/list/?search=&page= — mirrors elections.views.handover_list exactly."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = HandoverLedger.objects.select_related("executive__member", "election").all()

    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(
            Q(executive__member__full_name__icontains=search_term)
            | Q(executive__post__icontains=search_term)
            | Q(election__title__icontains=search_term)
        )

    queryset = queryset.order_by("-tenure_start")
    paginator = Paginator(queryset, 12)
    page = paginator.get_page(request.GET.get("page", 1))

    agg = HandoverLedger.objects.aggregate(
        total_cash_remaining=Sum("cash_remaining"),
        sum_income=Sum("total_income"),
        sum_dues=Sum("total_dues"),
        sum_donations=Sum("total_donations"),
        sum_taskforce=Sum("taskforce_revenue"),
    )
    stats = {
        "total": HandoverLedger.objects.count(),
        "total_cash_remaining": agg["total_cash_remaining"] or Decimal("0"),
        "total_revenue": (
            (agg["sum_income"] or Decimal("0"))
            + (agg["sum_dues"] or Decimal("0"))
            + (agg["sum_donations"] or Decimal("0"))
            + (agg["sum_taskforce"] or Decimal("0"))
        ),
    }

    return _json({
        "results": [_serialize_handover(h) for h in page.object_list],
        "page": page.number,
        "num_pages": paginator.num_pages,
        "has_next": page.has_next(),
        "has_previous": page.has_previous(),
        "count": paginator.count,
        "stats": stats,
    })


@require_http_methods(["GET"])
def handover_form_meta_api(request):
    """GET /elections/api/handovers/form-meta/ — select options for the handover form."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    from executives.models import Executive

    elections = Election.objects.order_by("-created_at")[:200]
    executives = Executive.objects.select_related("member", "elected_via").order_by("-start_date", "post")[:500]
    return _json({
        "can_edit_cash_remaining": request.user.has_admin_access(),
        "elections": [
            {"id": e.pk, "title": e.title, "status": e.status, "status_display": e.get_status_display()}
            for e in elections
        ],
        "executives": [
            {
                "id": ex.pk,
                "full_name": ex.member.full_name if ex.member_id else str(ex),
                "post": ex.post,
                "post_display": ex.get_post_display(),
                "is_current": ex.is_current,
                "start_date": ex.start_date,
                "end_date": ex.end_date,
                "elected_via": _serialize_model(ex.elected_via) if ex.elected_via_id else None,
            }
            for ex in executives
        ],
    })


def _report_for_handover(handover):
    from .administrations import build_administration_report

    key = None
    if handover.election_id:
        key = str(handover.election_id)
    elif handover.executive_id and handover.executive.elected_via_id:
        key = str(handover.executive.elected_via_id)
    else:
        key = "founding"
    return build_administration_report(key)


@require_http_methods(["GET"])
def handover_detail_api(request, pk):
    """GET /elections/api/handovers/<pk>/ — ledger + calculated report data."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    handover = get_object_or_404(
        HandoverLedger.objects.select_related("executive__member", "executive__elected_via", "election"),
        pk=pk,
    )
    report = _report_for_handover(handover)
    return _json({
        "handover": _serialize_handover(handover),
        "report": _serialize_report(report) if report else None,
        "can_manage": request.user.has_executive_access(),
        "can_delete": request.user.has_admin_access(),
    })


@require_http_methods(["POST"])
def handover_create_api(request):
    """POST /elections/api/handovers/create/ — creates ledger atomically."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    with transaction.atomic():
        form = HandoverLedgerForm(request.POST, user=request.user)
        if not form.is_valid():
            return _json({"errors": form.errors}, status=400)
        handover = form.save()

    log_action(
        user=request.user,
        action="CREATE",
        object_type="HandoverLedger",
        object_id=handover.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Created handover ledger for {handover.executive} (₦{handover.net_financial_position:,.2f})",
    )
    invalidate_dashboard_cache()
    return _json({"handover": _serialize_handover(handover)}, status=201)


@require_http_methods(["POST"])
def handover_update_api(request, pk):
    """POST /elections/api/handovers/<pk>/update/ — recalculates aggregates server-side."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    handover = get_object_or_404(HandoverLedger, pk=pk)
    with transaction.atomic():
        form = HandoverLedgerForm(request.POST, instance=handover, user=request.user)
        if not form.is_valid():
            return _json({"errors": form.errors}, status=400)
        handover = form.save()

    log_action(
        user=request.user,
        action="UPDATE",
        object_type="HandoverLedger",
        object_id=handover.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Updated handover ledger for {handover.executive}",
    )
    invalidate_dashboard_cache()
    return _json({"handover": _serialize_handover(handover)})


@require_http_methods(["POST", "DELETE"])
def handover_delete_api(request, pk):
    """DELETE/POST /elections/api/handovers/<pk>/delete/ — admin only."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not request.user.has_admin_access():
        return _json({"detail": "Admin access required."}, status=403)

    handover = get_object_or_404(HandoverLedger.objects.select_related("executive__member"), pk=pk)
    executive_name = str(handover.executive)
    with transaction.atomic():
        handover.delete()

    log_action(
        user=request.user,
        action="DELETE",
        object_type="HandoverLedger",
        object_id=pk,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Deleted handover ledger for {executive_name}",
    )
    invalidate_dashboard_cache()
    return _json({"detail": f"Handover ledger for {executive_name} deleted."})


@require_http_methods(["GET"])
def administration_list_api(request):
    """GET /elections/api/administrations/ — previous/current administration summaries."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    from .administrations import list_administrations

    return _json({
        "administrations": [_serialize_administration(a) for a in list_administrations()]
    })


@require_http_methods(["GET"])
def administration_report_api(request, key):
    """GET /elections/api/administrations/<key>/ — full server-generated report."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    from .administrations import build_administration_report

    report = build_administration_report(key)
    if report is None:
        return _json({"detail": "That administration could not be found."}, status=404)

    log_action(
        user=request.user,
        action="VIEW",
        object_type="ExecutiveHandoverReport",
        object_id=None,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Viewed Executive Handover Report for {report['administration']['name']}",
    )
    return _json({"report": _serialize_report(report)})
