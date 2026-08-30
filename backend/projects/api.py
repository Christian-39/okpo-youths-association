"""
JSON API views for the standalone OYA frontend — projects module.

Added alongside the existing projects/views.py (left untouched).
Reuses ProjectForm as-is and the Project model's own
total_member_donations / total_outside_donations / total_donors_count
properties for fundraising figures — none of that math is duplicated.
"""
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q, Count, Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action
from dashboard.services import invalidate_dashboard_cache

from .forms import ProjectForm
from .models import Project


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


def _serialize_project(p, detail=False):
    data = {
        "id": p.pk,
        "title": p.title,
        "budget": p.budget,
        "description": p.description,
        "status": p.status,
        "status_display": p.get_status_display(),
        "progress_percentage": p.progress_percentage,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "enable_fundraising": p.enable_fundraising,
    }
    if detail:
        data.update({
            "target_amount": p.target_amount,
            "fundraising_amount_raised": p.fundraising_amount_raised,
            "fundraising_remaining_amount": p.fundraising_remaining_amount,
            "fundraising_progress_percentage": p.fundraising_progress_percentage,
            "fundraising_start_date": p.fundraising_start_date,
            "fundraising_end_date": p.fundraising_end_date,
            "fundraising_status": p.fundraising_status,
            "fundraising_status_display": p.get_fundraising_status_display(),
            "include_in_group_reports": p.include_in_group_reports,
        })
    return data


@require_http_methods(["GET"])
def project_list_api(request):
    """GET /projects/api/list/?search=&status=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = Project.objects.all()

    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(Q(title__icontains=search_term) | Q(description__icontains=search_term))
    status_filter = request.GET.get("status", "")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    stats = Project.objects.aggregate(
        future=Count("id", filter=Q(status="FUTURE")),
        at_hand=Count("id", filter=Q(status="AT_HAND")),
        finished=Count("id", filter=Q(status="FINISHED")),
        total=Count("id"),
    )

    return _json({
        "projects": [_serialize_project(p) for p in page.object_list],
        "stats": stats,
        "status_choices": Project.STATUS_CHOICES,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def project_detail_api(request, pk):
    """GET /projects/api/<pk>/ — includes fundraising data when enabled, mirroring projects.views.project_detail exactly."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    project = get_object_or_404(Project, pk=pk)
    data = {"project": _serialize_project(project, detail=True), "fundraising_data": None}

    if project.enable_fundraising:
        from project_donations.models import Donation

        confirmed = Donation.objects.filter(project=project, status="CONFIRMED").select_related(
            "member", "outside_donor", "recorded_by"
        ).order_by("-donation_date")

        member_donations = confirmed.filter(donor_type="MEMBER")
        outside_donations = confirmed.filter(donor_type="OUTSIDE")
        total_donors = confirmed.values("member", "outside_donor").distinct().count()

        top_member_donors = list(
            member_donations.values("member__id", "member__full_name")
            .annotate(total=Sum("amount")).order_by("-total")[:5]
        )
        top_outside_donors = list(
            outside_donations.values("outside_donor__id", "outside_donor__full_name")
            .annotate(total=Sum("amount")).order_by("-total")[:5]
        )
        top_inviters = list(
            confirmed.filter(invited_by__isnull=False)
            .values("invited_by__id", "invited_by__full_name")
            .annotate(total=Sum("amount")).order_by("-total")[:5]
        )
        recent_donations = [
            {
                "id": d.pk,
                "donor_name": d.member.full_name if d.donor_type == "MEMBER" and d.member_id else (d.outside_donor.full_name if d.outside_donor_id else "Anonymous"),
                "amount": d.amount,
                "donation_date": d.donation_date,
            }
            for d in confirmed[:10]
        ]

        data["fundraising_data"] = {
            "total_donors": total_donors,
            "member_donations_total": project.total_member_donations,
            "outside_donations_total": project.total_outside_donations,
            "total_donations_recorded": confirmed.count(),
            "top_member_donors": top_member_donors,
            "top_outside_donors": top_outside_donors,
            "top_inviters": top_inviters,
            "recent_donations": recent_donations,
        }

    return _json(data)


@require_http_methods(["POST"])
def project_create_api(request):
    """POST /projects/api/create/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = ProjectForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    project = form.save()
    log_action(
        user=request.user, action="CREATE", object_type="Project", object_id=project.id,
        ip_address=getattr(request, "client_ip", ""), description=f"Created project: {project.title}",
    )
    invalidate_dashboard_cache()
    return _json({"project": _serialize_project(project, detail=True)}, status=201)


@require_http_methods(["POST"])
def project_update_api(request, pk):
    """POST /projects/api/<pk>/update/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    project = get_object_or_404(Project, pk=pk)
    form = ProjectForm(request.POST, instance=project)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    project = form.save()
    log_action(
        user=request.user, action="UPDATE", object_type="Project", object_id=project.id,
        ip_address=getattr(request, "client_ip", ""), description=f"Updated project: {project.title}",
    )
    invalidate_dashboard_cache()
    return _json({"project": _serialize_project(project, detail=True)})


@require_http_methods(["DELETE"])
def project_delete_api(request, pk):
    """DELETE /projects/api/<pk>/delete/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not request.user.has_admin_access():
        return _json({"detail": "Admin access required."}, status=403)

    project = get_object_or_404(Project, pk=pk)
    title = project.title
    project.delete()

    log_action(
        user=request.user, action="DELETE", object_type="Project", object_id=pk,
        ip_address=getattr(request, "client_ip", ""), description=f"Deleted project: {title}",
    )
    invalidate_dashboard_cache()
    return _json({"detail": "Deleted."})
