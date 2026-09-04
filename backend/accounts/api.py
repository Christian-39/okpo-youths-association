"""
JSON API views for OYA frontend.
"""
import json
import logging

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.core.serializers.json import DjangoJSONEncoder
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_request_action
from .forms import FloorMemberProfileForm, ChangePINForm
from .models import User
from .views import _get_profile_context

logger = logging.getLogger("oya")


def _json(data, **kwargs):
    return JsonResponse(data, encoder=DjangoJSONEncoder, **kwargs)


def _serialize_user(user):
    """Same fields the templates read off `user` / `request.user`."""
    member = user.member  # cached_property on User — one query, reused
    return {
        "id": user.id,
        "serial_number": user.serial_number,
        "full_name": user.get_full_name(),
        "phone": user.phone,
        "state": user.state,
        "role": user.role,
        "display_role": user.display_role,
        "photo_url": user.photo.url if user.photo else None,
        "is_active": user.is_active,
        "date_joined": user.date_joined,
        "has_admin_access": user.has_admin_access(),
        "has_executive_access": user.has_executive_access(),
        "is_superuser": user.is_superuser,
        "is_floor_member": user.is_floor_member(),
        "member_id": member.id if member else None,
        "member_position": member.position if member else None,
    }


@ensure_csrf_cookie
@require_http_methods(["GET"])
def csrf_api(request):
    token = get_token(request)
    return JsonResponse({"csrfToken": token})


@require_http_methods(["POST"])
def login_api(request):
    """
    POST /accounts/api/login/
    Body: {"serial_number": "OYA-2026-0001", "pin": "123456"}
    Mirrors accounts.views.login_view's logic exactly, minus the
    server-rendered template response.
    """
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"errors": ["Invalid request body."]}, status=400)

    serial_number = (payload.get("serial_number") or "").upper().strip()
    pin = payload.get("pin") or ""

    if not serial_number or not pin:
        return JsonResponse({"errors": ["Serial number and PIN are required."]}, status=400)

    user = authenticate(request, serial_number=serial_number, pin=pin)
    if user is not None:
        login(request, user)
        log_request_action(
            request,
            action="LOGIN",
            object_type="User",
            object_id=user.id,
            description=f"User {user.serial_number} logged in",
        )
        return JsonResponse(_serialize_user(user))

    # Distinguish bad credentials vs deactivated account, same as the
    # template view does.
    try:
        inactive_user = User.objects.get(serial_number=serial_number)
        if not inactive_user.is_active:
            message = "This account has been deactivated. Contact an administrator."
        else:
            message = "Invalid serial number or PIN. Please check your credentials and try again."
    except User.DoesNotExist:
        message = "Invalid serial number or PIN. Please check your credentials and try again."

    return JsonResponse({"errors": [message]}, status=401)


@require_http_methods(["POST"])
def logout_api(request):
    """POST /accounts/api/logout/"""
    if request.user.is_authenticated:
        log_request_action(
            request,
            action="LOGOUT",
            object_type="User",
            object_id=request.user.id,
            description=f"User {request.user.serial_number} logged out",
        )
        logout(request)
    return JsonResponse({"detail": "Logged out."})


@require_http_methods(["GET"])
def me_api(request):
    """
    GET /accounts/api/me/ — current user + permission flags for the frontend shell.

    Deliberately does NOT use @login_required: that decorator redirects
    unauthenticated requests to the HTML login page, which is meaningless
    to a JSON caller. Instead we return a plain 401 so assets/js/api.js
    can redirect the *frontend* to login.html.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)
    return JsonResponse(_serialize_user(request.user))


def _serialize_dues_year_group(group):
    payment = group.get("payment")
    return {
        "status": group["status"],
        "start_year": group["start_year"],
        "end_year": group["end_year"],
        "count": group["count"],
        "total_amount": group["total_amount"],
        "payment": {
            "created_at": payment.created_at,
            "recorded_by": payment.recorded_by.get_full_name() if payment.recorded_by_id else None,
            "notes": payment.notes,
        } if payment else None,
    }


def _serialize_dues_txn_group(group):
    recorded_by = group.get("recorded_by")
    return {
        "reason": group["reason"],
        "amount": group["amount"],
        "recorded_by": recorded_by.get_full_name() if recorded_by else None,
        "payment_date": group["payment_date"],
        "years": group["years"],
        "is_prepaid": group["is_prepaid"],
    }


def _serialize_donation(income):
    return {
        "created_at": income.created_at,
        "income_type": income.income_type,
        "income_type_display": income.get_income_type_display(),
        "reason": income.reason,
        "amount": income.amount,
    }


def _serialize_payment_item(item):
    recorded_by = item.get("recorded_by")
    return {
        "type": item["type"],
        "date_display": item["date_display"],
        "reason": item["reason"],
        "amount": item["amount"],
        "recorded_by": recorded_by.get_full_name() if recorded_by else None,
        "is_prepaid": item.get("is_prepaid", False),
        "income_type": item.get("income_type"),
    }


@require_http_methods(["GET"])
def profile_api(request):
    """
    GET /accounts/api/profile/?payments_page=<n>
    Own profile: dues status, donations, and full contribution/payment
    history. Reuses accounts.views._get_profile_context — the exact same
    computation the Django-template version of this page uses — so the
    dues/debt math lives in one place. See that function's docstring.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    payments_page = request.GET.get("payments_page", 1)
    ctx = _get_profile_context(request.user, payments_page)
    payments = ctx["payments"]  # a Django Page object

    return _json({
        "user": _serialize_user(request.user),
        "total_paid": ctx["total_paid"],
        "total_dues_paid": ctx["total_dues_paid"],
        "total_donations": ctx["total_donations"],
        "debt_info": ctx["debt_info"],
        "yearly_dues": ctx["yearly_dues"],
        "current_year": ctx["current_year"],
        "currency_symbol": ctx["currency_symbol"],
        "year_status_grouped": [_serialize_dues_year_group(g) for g in ctx["year_status_grouped"]],
        "dues_transactions_grouped": [_serialize_dues_txn_group(g) for g in ctx["dues_transactions_grouped"]],
        "donations": [_serialize_donation(d) for d in ctx["donations"]],
        "payments": {
            "results": [_serialize_payment_item(p) for p in payments.object_list],
            "page": payments.number,
            "num_pages": payments.paginator.num_pages,
            "has_next": payments.has_next(),
            "has_previous": payments.has_previous(),
            "count": payments.paginator.count,
        },
    })


@require_http_methods(["POST"])
def profile_update_api(request):
    """
    POST /accounts/api/profile/update/
    Body: {"phone": "...", "state": "..."}
    Mirrors accounts.views.profile_update — same form, same validation,
    same audit log entry — minus the redirect+messages response.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"errors": ["Invalid request body."]}, status=400)

    form = FloorMemberProfileForm(payload, instance=request.user)
    if form.is_valid():
        form.save()
        log_request_action(
            request,
            action="UPDATE",
            object_type="User",
            object_id=request.user.id,
            description=f"Updated profile for {request.user.serial_number}",
        )
        return JsonResponse({"detail": "Profile updated successfully.", "user": _serialize_user(request.user)})

    errors = [msg for error_list in form.errors.values() for msg in error_list]
    return JsonResponse({"errors": errors}, status=400)


@require_http_methods(["POST"])
def change_pin_api(request):
    """
    POST /accounts/api/profile/change-pin/
    Body: {"current_pin": "...", "new_pin": "...", "confirm_pin": "..."}
    Mirrors accounts.views.change_pin exactly (same form/validation/audit
    log), including re-hashing the session so the user isn't logged out
    by Django's session-auth-hash check after their PIN changes.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"errors": ["Invalid request body."]}, status=400)

    form = ChangePINForm(payload, user=request.user)
    if form.is_valid():
        new_pin = form.cleaned_data["new_pin"]
        request.user.set_pin(new_pin)
        request.user.save()
        update_session_auth_hash(request, request.user)
        log_request_action(
            request,
            action="PIN_RESET",
            object_type="User",
            object_id=request.user.id,
            description="User changed their own PIN",
        )
        return JsonResponse({"detail": "PIN updated successfully."})

    errors = [msg for error_list in form.errors.values() for msg in error_list]
    return JsonResponse({"errors": errors}, status=400)
