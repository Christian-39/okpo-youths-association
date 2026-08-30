"""
JSON API views for the standalone OYA frontend — project_donations
module.

Scope: Outside Donors CRUD + Donations CRUD only. The Pledges module
(pledge_list/create/update/delete/payments/fulfill/cancel) and the PDF
report views (project_fundraising_report, outside_donor_statement_pdf,
member_donation_history_pdf, donation_history_report) are NOT covered
here — see MIGRATION_REPORT.md.

Added alongside the existing project_donations/views.py (left
untouched). Reuses OutsideDonorForm / DonationForm exactly. Donation
save() and the linked Income record are kept in sync by
project_donations/signals.py (post_save/post_delete on Donation) —
that signal fires the same way whether the save happens through this
API or the original view, so it is NOT reimplemented here.
"""
from decimal import Decimal

from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q, Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action

from .forms import OutsideDonorForm, DonationForm
from .models import OutsideDonor, Donation


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


def _require_admin(request):
    if not request.user.has_admin_access():
        return _json({"detail": "Admin access required."}, status=403)
    return None


# ── Outside Donors ───────────────────────────────────────────────

def _serialize_donor(d, detail=False):
    data = {
        "id": d.pk,
        "full_name": d.full_name,
        "phone_number": d.phone_number,
        "occupation": d.occupation,
        "profile_picture_url": d.profile_picture_url or None,
        "invited_by": {"id": d.invited_by_id, "full_name": d.invited_by.full_name} if d.invited_by_id else None,
    }
    if detail:
        data.update({
            "address": d.address,
            "gender": d.gender,
            "notes": d.notes,
            "total_donations": d.total_donations,
            "donation_count": d.donation_count,
            "projects_supported": d.projects_supported,
        })
    return data


@require_http_methods(["GET"])
def outside_donor_list_api(request):
    """GET /project_donations/api/outside-donors/list/?search=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = OutsideDonor.objects.select_related("invited_by").all()
    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(
            Q(full_name__icontains=search_term) | Q(phone_number__icontains=search_term)
            | Q(occupation__icontains=search_term) | Q(invited_by__full_name__icontains=search_term)
        )

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    total_outside_donations = Donation.objects.filter(status="CONFIRMED", donor_type="OUTSIDE").aggregate(
        total=Coalesce(Sum("amount"), Value(0, output_field=DecimalField()))
    )["total"]

    return _json({
        "donors": [_serialize_donor(d) for d in page.object_list],
        "stats": {"total": OutsideDonor.objects.count(), "total_donations": total_outside_donations},
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def outside_donor_detail_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    donor = get_object_or_404(OutsideDonor.objects.select_related("invited_by"), pk=pk)
    donations = Donation.objects.filter(outside_donor=donor).select_related("project", "recorded_by").order_by("-donation_date")
    return _json({
        "donor": _serialize_donor(donor, detail=True),
        "donations": [_serialize_donation(d) for d in donations],
    })


@require_http_methods(["GET"])
def outside_donor_form_meta_api(request):
    """GET /project_donations/api/outside-donors/form-meta/ — active members for the invited_by field."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    from members.models import Member
    members = Member.objects.filter(status="ACTIVE").order_by("full_name")
    return _json({"members": [{"id": m.pk, "full_name": m.full_name, "serial_number": m.serial_number} for m in members]})


@require_http_methods(["POST"])
def outside_donor_create_api(request):
    """POST /project_donations/api/outside-donors/create/ (multipart/form-data)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = OutsideDonorForm(request.POST, request.FILES)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    donor = form.save()
    log_action(user=request.user, action="CREATE", object_type="OutsideDonor", object_id=donor.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Created outside donor: {donor.full_name}")
    return _json({"donor": _serialize_donor(donor, detail=True)}, status=201)


@require_http_methods(["POST"])
def outside_donor_update_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    donor = get_object_or_404(OutsideDonor, pk=pk)
    form = OutsideDonorForm(request.POST, request.FILES, instance=donor)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    donor = form.save()
    log_action(user=request.user, action="UPDATE", object_type="OutsideDonor", object_id=donor.id,
               ip_address=getattr(request, "client_ip", ""), description=f"Updated outside donor: {donor.full_name}")
    return _json({"donor": _serialize_donor(donor, detail=True)})


@require_http_methods(["DELETE"])
def outside_donor_delete_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    donor = get_object_or_404(OutsideDonor, pk=pk)
    name = donor.full_name
    donor.delete()
    log_action(user=request.user, action="DELETE", object_type="OutsideDonor", object_id=pk,
               ip_address=getattr(request, "client_ip", ""), description=f"Deleted outside donor: {name}")
    return _json({"detail": "Deleted."})


# ── Donations ────────────────────────────────────────────────────

def _donation_log_description(donation, action_verb):
    donor = donation.member.full_name if donation.member_id else (donation.outside_donor.full_name if donation.outside_donor_id else "Anonymous")
    return f"{action_verb} {donation.get_donation_type_display()} donation ({donation.display_value}) from {donor} for {donation.project.title}"


def _serialize_donation(d):
    return {
        "id": d.pk,
        "project": {"id": d.project_id, "title": d.project.title} if d.project_id else None,
        "donor_type": d.donor_type,
        "donor_name": d.member.full_name if d.member_id else (d.outside_donor.full_name if d.outside_donor_id else "Anonymous"),
        "donation_type": d.donation_type,
        "donation_type_display": d.get_donation_type_display(),
        "display_value": d.display_value,
        "amount": d.amount,
        "status": d.status,
        "status_display": d.get_status_display(),
        "payment_method": d.payment_method,
        "reference_number": d.reference_number,
        "donation_date": d.donation_date,
        "recorded_by": d.recorded_by.get_full_name() if d.recorded_by_id else None,
        "invited_by": d.invited_by.full_name if d.invited_by_id else None,
    }


@require_http_methods(["GET"])
def donation_list_api(request):
    """GET /project_donations/api/donations/list/?search=&project=&donor_type=&donation_type=&status=&date_from=&date_to=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = Donation.objects.select_related("project", "member", "outside_donor", "recorded_by", "invited_by").all()

    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(
            Q(project__title__icontains=search_term) | Q(member__full_name__icontains=search_term)
            | Q(outside_donor__full_name__icontains=search_term) | Q(reference_number__icontains=search_term)
        )
    for param, field in [("project", "project_id"), ("donor_type", "donor_type"), ("donation_type", "donation_type"), ("status", "status")]:
        value = request.GET.get(param, "")
        if value:
            queryset = queryset.filter(**{field: value})
    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")
    if date_from:
        queryset = queryset.filter(donation_date__gte=date_from)
    if date_to:
        queryset = queryset.filter(donation_date__lte=date_to)

    paginator = Paginator(queryset, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    zero = Value(0, output_field=DecimalField())
    total_donations = Donation.objects.filter(status="CONFIRMED").aggregate(total=Coalesce(Sum("amount"), zero))["total"]
    member_total = Donation.objects.filter(status="CONFIRMED", donor_type="MEMBER").aggregate(total=Coalesce(Sum("amount"), zero))["total"]
    outside_total = Donation.objects.filter(status="CONFIRMED", donor_type="OUTSIDE").aggregate(total=Coalesce(Sum("amount"), zero))["total"]

    from projects.models import Project
    return _json({
        "donations": [_serialize_donation(d) for d in page.object_list],
        "donor_type_choices": Donation.DONOR_TYPE_CHOICES,
        "donation_type_choices": Donation.DONATION_TYPE_CHOICES,
        "status_choices": Donation.STATUS_CHOICES,
        "fundraising_projects": [{"id": p.id, "title": p.title} for p in Project.objects.filter(enable_fundraising=True).order_by("-created_at")],
        "totals": {"total_donations": total_donations, "member_total": member_total, "outside_total": outside_total},
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def donation_detail_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    donation = get_object_or_404(Donation.objects.select_related("project", "member", "outside_donor", "recorded_by", "invited_by"), pk=pk)
    return _json({"donation": _serialize_donation(donation)})


@require_http_methods(["GET"])
def donation_form_meta_api(request):
    """GET /project_donations/api/donations/form-meta/ — members/outside-donors/projects for the donation form."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    from members.models import Member
    from projects.models import Project

    members = Member.objects.filter(status="ACTIVE").order_by("full_name")
    donors = OutsideDonor.objects.order_by("full_name")
    projects = Project.objects.filter(enable_fundraising=True).order_by("-created_at")
    return _json({
        "members": [{"id": m.pk, "full_name": m.full_name, "serial_number": m.serial_number} for m in members],
        "outside_donors": [{"id": d.pk, "full_name": d.full_name} for d in donors],
        "projects": [{"id": p.pk, "title": p.title} for p in projects],
        "donor_type_choices": Donation.DONOR_TYPE_CHOICES,
        "donation_type_choices": Donation.DONATION_TYPE_CHOICES,
        "payment_method_choices": Donation.PAYMENT_METHOD_CHOICES,
        "status_choices": Donation.STATUS_CHOICES,
    })


@require_http_methods(["POST"])
def donation_create_api(request):
    """POST /project_donations/api/donations/create/ (multipart/form-data — receipt upload)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = DonationForm(request.POST, request.FILES)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    donation = form.save(commit=False)
    donation.recorded_by = request.user
    donation.save()

    log_action(user=request.user, action="CREATE", object_type="Donation", object_id=donation.id,
               ip_address=getattr(request, "client_ip", ""), description=_donation_log_description(donation, "Recorded"))
    return _json({"donation": _serialize_donation(donation)}, status=201)


@require_http_methods(["POST"])
def donation_update_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    donation = get_object_or_404(Donation, pk=pk)
    form = DonationForm(request.POST, request.FILES, instance=donation)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    donation = form.save()
    log_action(user=request.user, action="UPDATE", object_type="Donation", object_id=donation.id,
               ip_address=getattr(request, "client_ip", ""), description=_donation_log_description(donation, "Updated"))
    return _json({"donation": _serialize_donation(donation)})


@require_http_methods(["DELETE"])
def donation_delete_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    donation = get_object_or_404(Donation, pk=pk)
    desc = _donation_log_description(donation, "Deleted")
    donation.delete()
    log_action(user=request.user, action="DELETE", object_type="Donation", object_id=pk,
               ip_address=getattr(request, "client_ip", ""), description=desc)
    return _json({"detail": "Deleted."})


@require_http_methods(["POST"])
def donation_fulfill_api(request, pk):
    """POST /project_donations/api/donations/<pk>/fulfill/ — mirrors donation_fulfill's status transition."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    donation = get_object_or_404(Donation, pk=pk)
    if donation.status != "PLEDGE":
        return _json({"detail": "Only pledged donations can be fulfilled."}, status=400)
    donation.status = "CONFIRMED"
    donation.save()
    log_action(user=request.user, action="UPDATE", object_type="Donation", object_id=donation.id,
               ip_address=getattr(request, "client_ip", ""), description=_donation_log_description(donation, "Fulfilled pledge:"))
    return _json({"donation": _serialize_donation(donation)})


@require_http_methods(["POST"])
def donation_cancel_pledge_api(request, pk):
    """POST /project_donations/api/donations/<pk>/cancel-pledge/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    donation = get_object_or_404(Donation, pk=pk)
    if donation.status != "PLEDGE":
        return _json({"detail": "Only pledged donations can be cancelled."}, status=400)
    donation.status = "CANCELLED"
    donation.save()
    log_action(user=request.user, action="UPDATE", object_type="Donation", object_id=donation.id,
               ip_address=getattr(request, "client_ip", ""), description=_donation_log_description(donation, "Cancelled pledge:"))
    return _json({"donation": _serialize_donation(donation)})
