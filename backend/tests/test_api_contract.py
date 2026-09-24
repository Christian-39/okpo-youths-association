import json

from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from accounts.models import User


@override_settings(ALLOWED_HOSTS=["testserver", "localhost"])
class ApiContractTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = self._user("OYA-2026-0001", "Admin User", "ADMIN", True)
        self.member = self._user("OYA-2026-0002", "Floor Member", "FLOOR_MEMBER", False)

    def _user(self, serial, name, role, superuser=False):
        user = User.objects.create(
            serial_number=serial,
            full_name=name,
            role=role,
            is_staff=role in {"ADMIN", "EXECUTIVE"} or superuser,
            is_superuser=superuser,
            is_active=True,
        )
        user.set_pin("123456")
        user.save()
        return user

    def _client(self):
        return Client(enforce_csrf_checks=True)

    def _csrf(self, client):
        response = client.get("/api/v1/accounts/api/csrf/")
        self.assertEqual(response.status_code, 200)
        return response.json()["csrfToken"]

    def _login(self, client, serial="OYA-2026-0001", pin="123456"):
        token = self._csrf(client)
        return client.post(
            "/api/v1/accounts/api/login/",
            data=json.dumps({"serial_number": serial, "pin": pin}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

    def test_login_requires_csrf_and_me_uses_session_cookie(self):
        client = self._client()
        no_csrf = client.post(
            "/api/v1/accounts/api/login/",
            data=json.dumps({"serial_number": "OYA-2026-0001", "pin": "123456"}),
            content_type="application/json",
        )
        self.assertEqual(no_csrf.status_code, 403)

        login = self._login(client)
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["serial_number"], "OYA-2026-0001")

        me = client.get("/api/v1/accounts/api/me/")
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.json()["has_admin_access"])

    def test_logout_clears_authenticated_session(self):
        client = self._client()
        self.assertEqual(self._login(client).status_code, 200)
        token = self._csrf(client)
        logout = client.post("/api/v1/accounts/api/logout/", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(client.get("/api/v1/accounts/api/me/").status_code, 401)

    def test_invalid_login_is_rate_limited_without_accepting_raw_pin(self):
        client = self._client()
        token = self._csrf(client)
        statuses = []
        for _ in range(6):
            response = client.post(
                "/api/v1/accounts/api/login/",
                data=json.dumps({"serial_number": "OYA-2026-0001", "pin": "000000"}),
                content_type="application/json",
                HTTP_X_CSRFTOKEN=token,
            )
            statuses.append(response.status_code)
        self.assertIn(429, statuses)
        self.admin.refresh_from_db()
        self.assertNotEqual(self.admin.pin, "123456")
        self.assertIn("$", self.admin.pin)

    def test_versioned_protected_endpoints_return_json_not_template_redirects(self):
        client = self._client()
        for path in [
            "/api/v1/accounts/api/me/",
            "/api/v1/elections/api/handovers/list/",
            "/api/v1/elections/api/administrations/",
            "/api/v1/dashboard/api/summary/",
        ]:
            response = client.get(path)
            self.assertEqual(response.status_code, 401, path)
            self.assertIn("application/json", response.headers.get("content-type", ""))

    def test_member_cannot_access_executive_handover_admin_reports(self):
        client = self._client()
        self.assertEqual(self._login(client, "OYA-2026-0002").status_code, 200)
        response = client.get("/api/v1/elections/api/administrations/")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_read_handover_and_administration_endpoints(self):
        client = self._client()
        self.assertEqual(self._login(client).status_code, 200)
        handovers = client.get("/api/v1/elections/api/handovers/list/")
        self.assertEqual(handovers.status_code, 200)
        self.assertEqual(handovers.json()["results"], [])

        meta = client.get("/api/v1/elections/api/handovers/form-meta/")
        self.assertEqual(meta.status_code, 200)
        self.assertIn("executives", meta.json())

        administrations = client.get("/api/v1/elections/api/administrations/")
        self.assertEqual(administrations.status_code, 200)
        self.assertIn("administrations", administrations.json())
