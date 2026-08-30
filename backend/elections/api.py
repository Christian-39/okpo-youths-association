"""
JSON API views for the standalone OYA frontend — elections module.

Scope: Election CRUD + Candidate CRUD + voting only. The Handover
Ledger and Executive Administration Report views/templates
(elections/views.py's handover_* and administration_* functions) are
NOT covered here — see MIGRATION_REPORT.md.

Added alongside the existing elections/views.py (left untouched).
Reuses ElectionForm / CandidateForm exactly. Election result
processing (Election.process_election_results()) is signal-driven
(see elections/signals.py) and fires on Election.save() regardless of
whether the save happens through the old view or this API — so it is
NOT reimplemented here, only triggered via form.save() same as before.
"""
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Q
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action
from dashboard.services import invalidate_dashboard_cache

from .forms import ElectionForm, CandidateForm
from .models import Election, Candidate, Vote


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
