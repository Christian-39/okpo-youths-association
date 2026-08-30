"""
JSON API view for the standalone OYA frontend — dashboard module.

This intentionally reuses dashboard.views.index()'s own helper functions
(_patch_finance_stats_with_project_donations,
_patch_finance_stats_with_prepaid_dues) and every dashboard.services
function it calls, so the KPI/financial math lives in exactly one place
(Django) — nothing is recalculated in JavaScript, per the "no duplicate
business logic" migration rule.

Drop this file in as dashboard/api.py, then wire it up in dashboard/urls.py
(see urls_patch.py in this same folder).
"""
from django.core.serializers.json import DjangoJSONEncoder
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from . import views as dashboard_views
from .services import (
    get_dashboard_kpis,
    get_member_statistics,
    get_finance_statistics,
    get_dashboard_extras,
    get_clan_distribution,
    get_income_expense_trend,
    get_member_contributions,
    get_member_recent_activities,
)


def _json(data, **kwargs):
    return JsonResponse(data, encoder=DjangoJSONEncoder, **kwargs)


def _serialize_activity(a):
    return {
        "action": a.action,
        "description": a.description,
        "created_at": a.created_at,
        "user": a.user.get_full_name() if a.user_id else None,
    }


def _serialize_case(c):
    return {
        "case_number": c.case_number,
        "title": c.title,
        "status": c.status,
        "created_at": c.created_at,
        "respondent_name": c.respondent.full_name if c.respondent_id else None,
    }


def _serialize_executive(e):
    return {
        "position": e.position,
        "post_order": e.post_order,
        "member_name": e.member.full_name if e.member_id else None,
        "photo_url": e.member.photo.url if e.member_id and e.member.photo and e.member.photo.name else None,
    }


def _serialize_taskforce(t):
    return {
        "member_name": t.member.full_name if t.member_id else None,
        "assigned_date": t.assigned_date,
    }


def _serialize_notice(n):
    return {
        "id": n.pk,
        "title": n.title,
        "is_urgent": getattr(n, "is_urgent", False),
        "created_at": n.created_at,
    }


def _serialize_contribution(c):
    return {
        "description": getattr(c, "description", None) or getattr(c, "purpose", None),
        "amount": c.amount,
        "created_at": c.created_at,
    }


@require_http_methods(["GET"])
def dashboard_api(request):
    """
    GET /dashboard/api/summary/
    Returns the same context dashboard.views.index() builds for
    dashboard/admin_dashboard.html, and the restricted member-facing
    version dashboard.views.member_dashboard() builds when the caller
    isn't an executive/admin — so ONE endpoint serves both dashboard.html
    variants, same as the Django templates did via role checks.
    """
    if not request.user.is_authenticated:
        return _json({"detail": "Not authenticated."}, status=401)

    user = request.user
    kpis = get_dashboard_kpis()
    member_stats = get_member_statistics()
    finance_stats = get_finance_statistics()

    finance_stats, total_project_donations = dashboard_views._patch_finance_stats_with_project_donations(finance_stats)
    finance_stats, total_prepaid = dashboard_views._patch_finance_stats_with_prepaid_dues(finance_stats)

    if isinstance(finance_stats, dict):
        tb = finance_stats.get("treasury_balance", 0)
        ti = finance_stats.get("total_income", 0)
        if isinstance(kpis, dict):
            kpis["treasury_balance"] = tb
            kpis["total_income"] = ti

    extras = get_dashboard_extras()
    clan_distribution = get_clan_distribution()
    trend_data = get_income_expense_trend()

    is_admin = user.has_admin_access()
    is_executive = user.has_executive_access()

    payload = {
        "is_admin": is_admin,
        "is_executive": is_executive,
        "kpis": kpis,
        "member_stats": member_stats,
        "finance_stats": finance_stats,
        "clan_distribution": clan_distribution,
        "trend_data": trend_data,
        "total_income": finance_stats.get("total_income", 0) if isinstance(finance_stats, dict) else 0,
        "treasury_balance": finance_stats.get("treasury_balance", 0) if isinstance(finance_stats, dict) else 0,
        "total_expenses": finance_stats.get("total_expenses", 0) if isinstance(finance_stats, dict) else 0,
        "total_project_donations": total_project_donations,
        "total_prepaid": total_prepaid,
        "active_fundraising_projects": extras["active_fundraising_projects"],
        "total_outside_donors": extras["total_outside_donors"],
        "total_raised_through_invitees": extras["total_raised_through_invitees"],
        "total_donation_groups": extras["total_donation_groups"],
        "members_in_donation_groups": extras["members_in_donation_groups"],
        "total_money_donations": extras["total_money_donations"],
        "total_material_donations": extras["total_material_donations"],
        "total_labour_contributions": extras["total_labour_contributions"],
        "pending_pledges": extras["pending_pledges"],
        "completed_pledges": extras["completed_pledges"],
        "outstanding_pledge_amount": extras["outstanding_pledge_amount"],
        "yearly_dues_debtors": extras["yearly_dues_debtors"],
        "outstanding_dues": extras["outstanding_dues"],
        "executives": [_serialize_executive(e) for e in extras["executives"]],
        "task_force": [_serialize_taskforce(t) for t in extras["task_force"]],
        "notices": [_serialize_notice(n) for n in extras["notices"]],
    }

    if is_admin or is_executive:
        payload["recent_activities"] = [_serialize_activity(a) for a in extras["recent_activities"]]
        payload["urgent_cases"] = [_serialize_case(c) for c in extras["urgent_cases"]]
    else:
        # Restricted view, same as dashboard.views.member_dashboard() intends
        # (that view calls get_member_recent_activities() without importing
        # it — a pre-existing bug in dashboard/views.py this API avoids by
        # importing it directly from .services here).
        payload["recent_activities"] = [_serialize_activity(a) for a in get_member_recent_activities(limit=5)]
        try:
            from members.models import Member
            member = Member.objects.get(user=user)
            contribution_data = get_member_contributions(member)
            payload["contributions"] = [_serialize_contribution(c) for c in contribution_data["contributions"]]
            payload["total_contributed"] = contribution_data["total_contributed"]
        except Exception:
            payload["contributions"] = []
            payload["total_contributed"] = 0

    return _json(payload)
