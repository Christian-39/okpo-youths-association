"""
JSON API views for the standalone OYA frontend — settingsapp module.

Added alongside the existing settingsapp/views.py (left untouched).
Reuses SystemSettingsForm / DonationGroupForm /
DonationGroupMemberAssignForm exactly as they are, plus the same
permission checks (has_admin_access / has_executive_access) each
original view already applies.

Scope note: the original `settings_view` renders a large tabbed page
(System Settings form + Users & Access + Members Management + Clan
Management tabs). Those extra tabs largely duplicate members.html /
accounts user_list functionality already covered elsewhere, so this
API only covers the System Settings form itself — see
MIGRATION_REPORT.md.

Drop this file in as settingsapp/api.py, then wire it up in
settingsapp/urls.py (see urls_patch.py in this same folder).
"""
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_action
from core.utils import build_search_query

from .forms import SystemSettingsForm, DonationGroupForm, DonationGroupMemberAssignForm
from .models import SystemSettings, DonationGroup, DonationGroupMembership


def _json(data, **kwargs):
    return JsonResponse(data, encoder=DjangoJSONEncoder, **kwargs)


def _require_auth(request):
    if not request.user.is_authenticated:
        return _json({"detail": "Not authenticated."}, status=401)
    return None


# ── System Settings ──────────────────────────────────────────────

def _serialize_settings(s):
    return {
        "association_name": s.association_name,
        "motto": s.motto,
        "logo_url": s.logo_url,
        "favicon_url": s.favicon_url,
        "yearly_dues": s.yearly_dues,
        "minimum_age": s.minimum_age,
        "past_member_age": s.past_member_age,
        "primary_color": s.primary_color,
        "accent_color": s.accent_color,
        "theme_mode": s.theme_mode,
        "theme_choices": SystemSettings.THEME_CHOICES,
    }


@require_http_methods(["GET"])
def system_settings_api(request):
    """GET /settingsapp/api/settings/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not request.user.has_executive_access():
        return _json({"detail": "Executive access required."}, status=403)
    return _json({"settings": _serialize_settings(SystemSettings.load())})


@require_http_methods(["POST"])
def system_settings_update_api(request):
    """POST /settingsapp/api/settings/update/ (multipart/form-data — logo/favicon uploads)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not request.user.has_executive_access():
        return _json({"detail": "Executive access required."}, status=403)

    settings_obj = SystemSettings.load()
    form = SystemSettingsForm(request.POST, request.FILES, instance=settings_obj)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    settings_obj = form.save()
    log_action(
        user=request.user, action="UPDATE", object_type="SystemSettings", object_id=settings_obj.id,
        ip_address=getattr(request, "client_ip", ""), description="Updated system settings",
    )
    return _json({"settings": _serialize_settings(settings_obj)})


# ── Donation Groups ───────────────────────────────────────────────

def _serialize_group(g, with_counts=True):
    data = {
        "id": g.pk,
        "name": g.name,
        "description": g.description,
        "minimum_amount": g.minimum_amount,
        "maximum_amount": g.maximum_amount,
        "is_unlimited": g.maximum_amount is None,
        "is_active": g.is_active,
        "created_at": g.created_at,
    }
    if with_counts:
        data["members_count"] = getattr(g, "members_count", None)
        if data["members_count"] is None:
            data["members_count"] = g.member_count
    return data


@require_http_methods(["GET"])
def donation_group_list_api(request):
    """GET /settingsapp/api/donation-groups/?search=&status=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    queryset = DonationGroup.objects.annotate(members_count=Count("memberships", distinct=True)).order_by("name")

    search_term = request.GET.get("search", "")
    if search_term:
        queryset = queryset.filter(build_search_query(["name", "description"], search_term))
    status_filter = request.GET.get("status", "")
    if status_filter == "ACTIVE":
        queryset = queryset.filter(is_active=True)
    elif status_filter == "INACTIVE":
        queryset = queryset.filter(is_active=False)

    paginator = Paginator(queryset, 20)
    page = paginator.get_page(request.GET.get("page", 1))

    stats = {
        "total": DonationGroup.objects.count(),
        "active": DonationGroup.objects.filter(is_active=True).count(),
        "inactive": DonationGroup.objects.filter(is_active=False).count(),
        "total_members_assigned": DonationGroupMembership.objects.values("member").distinct().count(),
    }

    return _json({
        "groups": [_serialize_group(g) for g in page.object_list],
        "stats": stats,
        "can_manage": request.user.has_admin_access() or request.user.has_executive_access(),
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def donation_group_detail_api(request, pk):
    """GET /settingsapp/api/donation-groups/<pk>/?member_search=&mpage="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    group = get_object_or_404(DonationGroup, pk=pk)
    memberships = group.memberships.select_related("member", "member__umu_nna_clan", "added_by").order_by("member__full_name")

    member_search = request.GET.get("member_search", "")
    if member_search:
        memberships = memberships.filter(
            Q(member__full_name__icontains=member_search)
            | Q(member__serial_number__icontains=member_search)
            | Q(member__phone__icontains=member_search)
        )

    paginator = Paginator(memberships, 15)
    page = paginator.get_page(request.GET.get("mpage", 1))

    donations = group.confirmed_donations_queryset().select_related("project", "member").order_by("-donation_date")[:100]

    return _json({
        "group": _serialize_group(group, with_counts=False),
        "report": {
            "total_members": group.member_count,
            "total_money_donated": group.total_money_donated,
            "total_projects_participated": group.total_projects_participated,
            "total_outstanding_pledges": group.total_outstanding_pledges,
        },
        "memberships": [
            {
                "id": m.pk,
                "member_id": m.member_id,
                "member_name": m.member.full_name,
                "member_serial": m.member.serial_number,
                "member_phone": m.member.phone,
                "clan": m.member.umu_nna_clan.name if m.member.umu_nna_clan_id else None,
                "date_added": m.date_added,
                "added_by": m.added_by.get_full_name() if m.added_by_id else None,
            }
            for m in page.object_list
        ],
        "membership_pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
        },
        "donations": [
            {
                "id": d.pk,
                "member_name": d.member.full_name if d.member_id else None,
                "project_name": d.project.name if d.project_id else None,
                "amount": d.amount,
                "donation_date": d.donation_date,
            }
            for d in donations
        ],
        "can_manage": request.user.has_admin_access() or request.user.has_executive_access(),
    })


@require_http_methods(["POST"])
def donation_group_create_api(request):
    """POST /settingsapp/api/donation-groups/create/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not (request.user.has_admin_access() or request.user.has_executive_access()):
        return _json({"detail": "Admin or Executive access required."}, status=403)

    form = DonationGroupForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    group = form.save(commit=False)
    group.created_by = request.user
    group.save()

    log_action(
        user=request.user, action="CREATE", object_type="DonationGroup", object_id=group.id,
        ip_address=getattr(request, "client_ip", ""), description=f"Created donation group '{group.name}'",
    )
    return _json({"group": _serialize_group(group)}, status=201)


@require_http_methods(["POST"])
def donation_group_update_api(request, pk):
    """POST /settingsapp/api/donation-groups/<pk>/update/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not (request.user.has_admin_access() or request.user.has_executive_access()):
        return _json({"detail": "Admin or Executive access required."}, status=403)

    group = get_object_or_404(DonationGroup, pk=pk)
    form = DonationGroupForm(request.POST, instance=group)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    group = form.save()
    log_action(
        user=request.user, action="UPDATE", object_type="DonationGroup", object_id=group.id,
        ip_address=getattr(request, "client_ip", ""), description=f"Updated donation group '{group.name}'",
    )
    return _json({"group": _serialize_group(group)})


@require_http_methods(["DELETE"])
def donation_group_delete_api(request, pk):
    """DELETE /settingsapp/api/donation-groups/<pk>/delete/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not request.user.has_admin_access():
        return _json({"detail": "Admin access required."}, status=403)

    group = get_object_or_404(DonationGroup, pk=pk)
    name, group_id = group.name, group.id
    group.delete()

    log_action(
        user=request.user, action="DELETE", object_type="DonationGroup", object_id=group_id,
        ip_address=getattr(request, "client_ip", ""), description=f"Deleted donation group '{name}'",
    )
    return _json({"detail": "Deleted."})


@require_http_methods(["POST"])
def donation_group_toggle_active_api(request, pk):
    """POST /settingsapp/api/donation-groups/<pk>/toggle-active/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not (request.user.has_admin_access() or request.user.has_executive_access()):
        return _json({"detail": "Admin or Executive access required."}, status=403)

    group = get_object_or_404(DonationGroup, pk=pk)
    group.is_active = not group.is_active
    group.save(update_fields=["is_active", "updated_at"])

    log_action(
        user=request.user, action="UPDATE", object_type="DonationGroup", object_id=group.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"{'Activated' if group.is_active else 'Deactivated'} donation group '{group.name}'",
    )
    return _json({"group": _serialize_group(group)})


@require_http_methods(["POST"])
def donation_group_member_add_api(request, pk):
    """POST /settingsapp/api/donation-groups/<pk>/members/add/ — body: {"member": <id>}"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not (request.user.has_admin_access() or request.user.has_executive_access()):
        return _json({"detail": "Admin or Executive access required."}, status=403)

    group = get_object_or_404(DonationGroup, pk=pk)
    form = DonationGroupMemberAssignForm(request.POST, group=group)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    member = form.cleaned_data["member"]
    membership = DonationGroupMembership.objects.create(group=group, member=member, added_by=request.user)

    log_action(
        user=request.user, action="CREATE", object_type="DonationGroupMembership", object_id=group.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Added {member.full_name} to donation group '{group.name}'",
    )
    return _json({"membership_id": membership.pk}, status=201)


@require_http_methods(["DELETE"])
def donation_group_member_remove_api(request, pk, membership_pk):
    """DELETE /settingsapp/api/donation-groups/<pk>/members/<membership_pk>/remove/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not (request.user.has_admin_access() or request.user.has_executive_access()):
        return _json({"detail": "Admin or Executive access required."}, status=403)

    group = get_object_or_404(DonationGroup, pk=pk)
    membership = get_object_or_404(DonationGroupMembership, pk=membership_pk, group=group)
    member_name = membership.member.full_name
    membership.delete()

    log_action(
        user=request.user, action="DELETE", object_type="DonationGroupMembership", object_id=group.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Removed {member_name} from donation group '{group.name}'",
    )
    return _json({"detail": "Removed."})
