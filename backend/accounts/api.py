"""
JSON API views for OYA frontend.
"""
import json
import logging

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from auditlogs.services import log_request_action
from .models import User

logger = logging.getLogger("oya")


def _serialize_user(user):
    """Same fields the templates read off `user` / `request.user`."""
    member = user.member  # cached_property on User — one query, reused
    return {
        "id": user.id,
        "serial_number": user.serial_number,
        "full_name": user.get_full_name(),
        "phone": user.phone,
        "role": user.role,
        "display_role": user.display_role,
        "photo_url": user.photo.url if user.photo else None,
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
