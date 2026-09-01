# URL wiring — additive changes only

For each file below, add the two marked lines. Nothing existing is
removed, renamed, or reordered.

## accounts/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "accounts"

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("profile/", views.profile_view, name="profile"),
    path("profile/update/", views.profile_update, name="profile_update"),
    path("profile/change-pin/", views.change_pin, name="change_pin"),
    path("users/", views.user_list, name="user_list"),
    path("users/create/", views.user_create, name="user_create"),
    path("users/<int:pk>/", views.user_detail, name="user_detail"),
    path("users/<int:pk>/update/", views.user_update, name="user_update"),
    path("users/<int:pk>/delete/", views.user_delete, name="user_delete"),
    path("pin-reset/", views.pin_reset, name="pin_reset"),
    path("api/users/search/", views.user_search_ajax, name="user_search_ajax"),
    # NEW — standalone-frontend JSON API
    path("api/csrf/", api.csrf_api, name="csrf_api"),
    path("api/login/", api.login_api, name="login_api"),
    path("api/logout/", api.logout_api, name="logout_api"),
    path("api/me/", api.me_api, name="me_api"),
]
```

## members/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "members"

urlpatterns = [
    path("", views.member_list, name="member_list"),
    path("create/", views.member_create, name="member_create"),
    path("<int:pk>/", views.member_detail, name="member_detail"),
    path("<int:pk>/update/", views.member_update, name="member_update"),
    path("<int:pk>/remove/", views.member_remove, name="member_remove"),
    path("<int:pk>/delete/", views.member_delete, name="member_delete"),
    path("clans/", views.clan_list, name="clan_list"),
    path("clans/create/", views.clan_create, name="clan_create"),
    path("api/stats/", views.member_stats_ajax, name="member_stats_ajax"),
    path("api/autocomplete/", views.member_autocomplete_search, name="member_autocomplete_search"),
    # NEW — standalone-frontend JSON API
    path("api/list/", api.member_list_api, name="member_list_api"),
    path("api/create/", api.member_create_api, name="member_create_api"),
    path("api/<int:pk>/", api.member_detail_api, name="member_detail_api"),
    path("api/<int:pk>/update/", api.member_update_api, name="member_update_api"),
]
```

## dashboard/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "dashboard"

urlpatterns = [
    path("", views.index, name="index"),
    path("member/", views.member_dashboard, name="member_dashboard"),
    path("admin/", views.admin_dashboard, name="admin_dashboard"),
    path("search/api/", views.global_search_ajax, name="global_search_ajax"),
    path("financial-trend/ajax/", views.financial_trend_ajax, name="financial_trend_ajax"),
    # NEW — standalone-frontend JSON API
    path("api/summary/", api.dashboard_api, name="dashboard_api"),
]
```

## notifications/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "notifications"

urlpatterns = [
    path("", views.notification_list, name="notification_list"),
    path("create/", views.notification_create, name="notification_create"),
    path("<int:pk>/", views.notification_detail, name="notification_detail"),
    path("<int:pk>/delete/", views.notification_delete, name="notification_delete"),
    path("mark-all-read/", views.mark_all_read, name="mark_all_read"),
    # NEW — also fixes a pre-existing dead endpoint (see notifications/api.py docstring)
    path("api/unread-count/", api.unread_count_api, name="unread_count_api"),
]
```

No changes are needed to `oya/urls.py` — the app-level includes already
route `/accounts/api/...`, `/members/api/...`, `/dashboard/api/...`, and
`/notifications/api/...` correctly through the existing
`include("accounts.urls")` etc. lines.

## finance/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "finance"

urlpatterns = [
    # Dashboard
    path("", views.finance_summary, name="finance_summary"),
    path("summary/", views.finance_summary, name="finance_summary"),

    # Dues Tracker
    path("dues/", views.dues_tracker, name="dues_tracker"),
    path("dues/debtors/", views.dues_debtors_list, name="dues_debtors_list"),
    path("dues/allocate/", views.dues_allocate, name="dues_allocate"),
    path("dues/create/", views.dues_allocate, name="dues_create"),
    path("dues/<int:pk>/delete/", views.dues_delete, name="dues_delete"),
    path("members/<int:member_id>/dues/", views.member_dues_detail, name="member_dues_detail"),

    # Prepaid Dues
    path("prepaid/", views.prepaid_list, name="prepaid_list"),
    path("prepaid/<int:member_id>/", views.prepaid_detail, name="prepaid_detail"),

    # Donations / Contributions
    path("donations/", views.donation_list, name="donation_list"),
    path("donations/create/", views.income_create, name="donation_create"),
    path("donations/<int:pk>/", views.income_detail, name="income_detail"),
    path("donations/<int:pk>/delete/", views.income_delete, name="income_delete"),

    # Legacy Income (redirects to donations)
    path("income/", views.income_list, name="income_list"),
    path("income/create/", views.income_create, name="income_create"),
    path("income/<int:pk>/", views.income_detail, name="income_detail"),
    path("income/<int:pk>/delete/", views.income_delete, name="income_delete"),

    # Expenses
    path("expenses/", views.expense_list, name="expense_list"),
    path("expenses/create/", views.expense_create, name="expense_create"),
    path("expenses/<int:pk>/", views.expense_detail, name="expense_detail"),
    path("expenses/<int:pk>/delete/", views.expense_delete, name="expense_delete"),

    # AJAX
    path("api/search-members/", views.search_members, name="search_members"),
    path("api/member-dues-preview/", views.member_dues_preview, name="member_dues_preview"),

    # NEW — standalone-frontend JSON API (donations + expenses only —
    # dues tracker/prepaid/debtors are not covered yet)
    path("api/donations/", api.donation_list_api, name="donation_list_api"),
    path("api/donations/create/", api.income_create_api, name="income_create_api"),
    path("api/donations/<int:pk>/", api.income_detail_api, name="income_detail_api"),
    path("api/donations/<int:pk>/delete/", api.income_delete_api, name="income_delete_api"),
    path("api/expenses/", api.expense_list_api, name="expense_list_api"),
    path("api/expenses/create/", api.expense_create_api, name="expense_create_api"),
    path("api/expenses/<int:pk>/", api.expense_detail_api, name="expense_detail_api"),
    path("api/expenses/<int:pk>/delete/", api.expense_delete_api, name="expense_delete_api"),

    # NEW — dues tracker JSON API
    path("api/dues/tracker/", api.dues_tracker_api, name="dues_tracker_api"),
    path("api/dues/members/<int:member_id>/", api.member_dues_detail_api, name="member_dues_detail_api"),
    path("api/dues/preview/", api.member_dues_preview_api, name="member_dues_preview_api"),
    path("api/dues/allocate/form-meta/", api.dues_allocate_form_meta_api, name="dues_allocate_form_meta_api"),
    path("api/dues/allocate/", api.dues_allocate_api, name="dues_allocate_api"),
    path("api/dues/<int:pk>/delete/", api.dues_delete_api, name="dues_delete_api"),
    path("api/dues/prepaid/", api.prepaid_list_api, name="prepaid_list_api"),
    path("api/dues/prepaid/<int:member_id>/", api.prepaid_detail_api, name="prepaid_detail_api"),
    path("api/dues/debtors/", api.dues_debtors_list_api, name="dues_debtors_list_api"),
]
```

## executives/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "executives"

urlpatterns = [
    path("", views.executive_list, name="executive_list"),
    path("create/", views.executive_create, name="executive_create"),
    path("<int:pk>/", views.executive_detail, name="executive_detail"),
    path("<int:pk>/update/", views.executive_update, name="executive_update"),
    path("<int:pk>/end-tenure/", views.executive_end_tenure, name="executive_end_tenure"),
    # NEW — standalone-frontend JSON API
    path("api/list/", api.executive_list_api, name="executive_list_api"),
    path("api/form-meta/", api.executive_form_meta_api, name="executive_form_meta_api"),
    path("api/create/", api.executive_create_api, name="executive_create_api"),
    path("api/<int:pk>/", api.executive_detail_api, name="executive_detail_api"),
    path("api/<int:pk>/form-meta/", api.executive_form_meta_api, name="executive_form_meta_edit_api"),
    path("api/<int:pk>/update/", api.executive_update_api, name="executive_update_api"),
    path("api/<int:pk>/end-tenure/", api.executive_end_tenure_api, name="executive_end_tenure_api"),
]
```

## auditlogs/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "auditlogs"

urlpatterns = [
    path("", views.auditlog_list, name="auditlog_list"),
    path("<int:pk>/detail/", views.auditlog_detail, name="detail"),
    path("export/", views.auditlog_export, name="export"),
    # NEW — standalone-frontend JSON API (export/ above is reused as-is,
    # linked to directly for CSV downloads — see auditlogs/api.py)
    path("api/list/", api.auditlog_list_api, name="auditlog_list_api"),
    path("api/<int:pk>/detail/", api.auditlog_detail_api, name="auditlog_detail_api"),
]
```

## settingsapp/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "settingsapp"

urlpatterns = [
    path("", views.settings_view, name="settings"),

    # Donation Groups (Feature 1, 2, 3)
    path("donation-groups/", views.donation_group_list, name="donation_group_list"),
    path("donation-groups/create/", views.donation_group_create, name="donation_group_create"),
    path("donation-groups/<int:pk>/", views.donation_group_detail, name="donation_group_detail"),
    path("donation-groups/<int:pk>/update/", views.donation_group_update, name="donation_group_update"),
    path("donation-groups/<int:pk>/delete/", views.donation_group_delete, name="donation_group_delete"),
    path("donation-groups/<int:pk>/toggle-active/", views.donation_group_toggle_active, name="donation_group_toggle_active"),
    path("donation-groups/<int:pk>/members/add/", views.donation_group_member_add, name="donation_group_member_add"),
    path("donation-groups/<int:pk>/members/<int:membership_pk>/remove/", views.donation_group_member_remove, name="donation_group_member_remove"),

    # NEW — standalone-frontend JSON API (system settings form only —
    # the Users/Members/Clans tabs on the original settings page are
    # not covered; those are separate concerns already served by
    # members.html and (partially) executives.html)
    path("api/settings/", api.system_settings_api, name="system_settings_api"),
    path("api/settings/update/", api.system_settings_update_api, name="system_settings_update_api"),
    path("api/donation-groups/", api.donation_group_list_api, name="donation_group_list_api"),
    path("api/donation-groups/create/", api.donation_group_create_api, name="donation_group_create_api"),
    path("api/donation-groups/<int:pk>/", api.donation_group_detail_api, name="donation_group_detail_api"),
    path("api/donation-groups/<int:pk>/update/", api.donation_group_update_api, name="donation_group_update_api"),
    path("api/donation-groups/<int:pk>/delete/", api.donation_group_delete_api, name="donation_group_delete_api"),
    path("api/donation-groups/<int:pk>/toggle-active/", api.donation_group_toggle_active_api, name="donation_group_toggle_active_api"),
    path("api/donation-groups/<int:pk>/members/add/", api.donation_group_member_add_api, name="donation_group_member_add_api"),
    path("api/donation-groups/<int:pk>/members/<int:membership_pk>/remove/", api.donation_group_member_remove_api, name="donation_group_member_remove_api"),
]
```

## projects/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "projects"

urlpatterns = [
    path("", views.project_list, name="project_list"),
    path("create/", views.project_create, name="project_create"),
    path("<int:pk>/", views.project_detail, name="project_detail"),
    path("<int:pk>/update/", views.project_update, name="project_update"),
    path("<int:pk>/delete/", views.project_delete, name="project_delete"),
    # NEW — standalone-frontend JSON API
    path("api/list/", api.project_list_api, name="project_list_api"),
    path("api/create/", api.project_create_api, name="project_create_api"),
    path("api/<int:pk>/", api.project_detail_api, name="project_detail_api"),
    path("api/<int:pk>/update/", api.project_update_api, name="project_update_api"),
    path("api/<int:pk>/delete/", api.project_delete_api, name="project_delete_api"),
]
```

## elections/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "elections"

urlpatterns = [
    path("", views.election_list, name="election_list"),
    path("create/", views.election_create, name="election_create"),
    path("<int:pk>/", views.election_detail, name="election_detail"),
    path("<int:pk>/update/", views.election_update, name="election_update"),
    path("candidates/create/", views.candidate_create, name="candidate_create"),
    path("candidates/<int:pk>/update/", views.candidate_update, name="candidate_update"),
    path("candidate/<int:pk>/vote/", views.cast_vote, name="cast_vote"),

    # Handover Ledger URLs
    path("handovers/", views.handover_list, name="handover_list"),
    path("handovers/create/", views.handover_create, name="handover_create"),
    path("handovers/<int:pk>/", views.handover_detail, name="handover_detail"),
    path("handovers/<int:pk>/update/", views.handover_update, name="handover_update"),
    path("handovers/<int:pk>/delete/", views.handover_delete, name="handover_delete"),

    # Executive Handover Report URLs
    path("administrations/", views.administration_list, name="administration_list"),
    path("administrations/<str:key>/", views.administration_report, name="administration_report"),

    # NEW — standalone-frontend JSON API (Election + Candidate + Vote
    # only — Handover Ledger and Administration Reports are NOT covered,
    # see MIGRATION_REPORT.md)
    path("api/list/", api.election_list_api, name="election_list_api"),
    path("api/create/", api.election_create_api, name="election_create_api"),
    path("api/<int:pk>/", api.election_detail_api, name="election_detail_api"),
    path("api/<int:pk>/update/", api.election_update_api, name="election_update_api"),
    path("api/candidates/form-meta/", api.candidate_form_meta_api, name="candidate_form_meta_api"),
    path("api/candidates/create/", api.candidate_create_api, name="candidate_create_api"),
    path("api/candidates/<int:pk>/", api.candidate_detail_api, name="candidate_detail_api"),
    path("api/candidates/<int:pk>/update/", api.candidate_update_api, name="candidate_update_api"),
    path("api/candidates/<int:pk>/vote/", api.cast_vote_api, name="cast_vote_api"),
]
```

## operations/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "operations"

urlpatterns = [
    path("taskforce/", views.taskforce_list, name="taskforce_list"),
    path("taskforce/create/", views.taskforce_create, name="taskforce_create"),
    path("taskforce/<int:pk>/update/", views.taskforce_update, name="taskforce_update"),
    path("taskforce/<int:pk>/remove/", views.taskforce_remove, name="taskforce_remove"),
    path("motorcycles/", views.motorcycle_list, name="motorcycle_list"),
    path("motorcycles/create/", views.motorcycle_create, name="motorcycle_create"),
    path("motorcycles/<int:pk>/update/", views.motorcycle_update, name="motorcycle_update"),
    path("motorcycles/<int:pk>/delete/", views.motorcycle_delete, name="motorcycle_delete"),
    path("cases/", views.case_list, name="case_list"),
    path("cases/create/", views.case_create, name="case_create"),
    path("cases/<int:pk>/", views.case_detail, name="case_detail"),
    path("cases/<int:pk>/resolve/", views.case_resolve, name="case_resolve"),
    path("cases/<int:pk>/edit/", views.case_update, name="case_update"),
    path("cases/<int:pk>/delete/", views.case_delete, name="case_delete"),

    # NEW — standalone-frontend JSON API
    path("api/taskforce/list/", api.taskforce_list_api, name="taskforce_list_api"),
    path("api/taskforce/form-meta/", api.taskforce_form_meta_api, name="taskforce_form_meta_api"),
    path("api/taskforce/create/", api.taskforce_create_api, name="taskforce_create_api"),
    path("api/taskforce/<int:pk>/", api.taskforce_detail_api, name="taskforce_detail_api"),
    path("api/taskforce/<int:pk>/update/", api.taskforce_update_api, name="taskforce_update_api"),
    path("api/taskforce/<int:pk>/remove/", api.taskforce_remove_api, name="taskforce_remove_api"),

    path("api/motorcycles/list/", api.motorcycle_list_api, name="motorcycle_list_api"),
    path("api/motorcycles/form-meta/", api.motorcycle_form_meta_api, name="motorcycle_form_meta_api"),
    path("api/motorcycles/create/", api.motorcycle_create_api, name="motorcycle_create_api"),
    path("api/motorcycles/<int:pk>/", api.motorcycle_detail_api, name="motorcycle_detail_api"),
    path("api/motorcycles/<int:pk>/update/", api.motorcycle_update_api, name="motorcycle_update_api"),
    path("api/motorcycles/<int:pk>/delete/", api.motorcycle_delete_api, name="motorcycle_delete_api"),

    path("api/cases/list/", api.case_list_api, name="case_list_api"),
    path("api/cases/form-meta/", api.case_form_meta_api, name="case_form_meta_api"),
    path("api/cases/<int:pk>/form-meta/", api.case_form_meta_api, name="case_form_meta_edit_api"),
    path("api/cases/create/", api.case_create_api, name="case_create_api"),
    path("api/cases/<int:pk>/", api.case_detail_api, name="case_detail_api"),
    path("api/cases/<int:pk>/update/", api.case_update_api, name="case_update_api"),
    path("api/cases/<int:pk>/resolve/", api.case_resolve_api, name="case_resolve_api"),
    path("api/cases/<int:pk>/delete/", api.case_delete_api, name="case_delete_api"),
]
```

## project_donations/urls.py

```python
from django.urls import path
from . import views
from . import api                      # NEW

app_name = "project_donations"

urlpatterns = [
    # Outside Donors
    path("outside-donors/", views.outside_donor_list, name="outside_donor_list"),
    path("outside-donors/create/", views.outside_donor_create, name="outside_donor_create"),
    path("outside-donors/<int:pk>/", views.outside_donor_detail, name="outside_donor_detail"),
    path("outside-donors/<int:pk>/update/", views.outside_donor_update, name="outside_donor_update"),
    path("outside-donors/<int:pk>/delete/", views.outside_donor_delete, name="outside_donor_delete"),

    # Donations
    path("donations/", views.donation_list, name="donation_list"),
    path("donations/create/", views.donation_create, name="donation_create"),
    path("donations/<int:pk>/", views.donation_detail, name="donation_detail"),
    path("donations/<int:pk>/update/", views.donation_update, name="donation_update"),
    path("donations/<int:pk>/delete/", views.donation_delete, name="donation_delete"),
    path("donations/<int:pk>/fulfill/", views.donation_fulfill, name="donation_fulfill"),
    path("donations/<int:pk>/cancel-pledge/", views.donation_cancel_pledge, name="donation_cancel_pledge"),

    # Reports
    path("reports/project/<int:project_id>/", views.project_fundraising_report, name="project_fundraising_report"),
    path("reports/outside-donor/<int:pk>/", views.outside_donor_statement_pdf, name="outside_donor_statement"),
    path("reports/member/<int:pk>/", views.member_donation_history_pdf, name="member_donation_history"),
    path("reports/history/", views.donation_history_report, name="donation_history_report"),

    # Pledges
    path("pledges/", views.pledge_list, name="pledge_list"),
    path("pledges/create/", views.pledge_create, name="pledge_create"),
    path("pledges/<int:pk>/", views.pledge_detail, name="pledge_detail"),
    path("pledges/<int:pk>/update/", views.pledge_update, name="pledge_update"),
    path("pledges/<int:pk>/delete/", views.pledge_delete, name="pledge_delete"),
    path("pledges/<int:pk>/payments/create/", views.pledge_payment_create, name="pledge_payment_create"),
    path("pledges/<int:pk>/payments/<int:payment_pk>/delete/", views.pledge_payment_delete, name="pledge_payment_delete"),
    path("pledges/<int:pk>/fulfill/", views.pledge_fulfill, name="pledge_fulfill"),
    path("pledges/<int:pk>/cancel/", views.pledge_cancel, name="pledge_cancel"),

    # AJAX
    path("api/search-outside-donors/", views.search_outside_donors_ajax, name="search_outside_donors_ajax"),
    path("api/donor-inviter/", views.get_outside_donor_inviter_ajax, name="get_donor_inviter_ajax"),

    # NEW — standalone-frontend JSON API (Outside Donors + Donations
    # only — Pledges and PDF reports are NOT covered, see MIGRATION_REPORT.md)
    path("api/outside-donors/list/", api.outside_donor_list_api, name="outside_donor_list_api"),
    path("api/outside-donors/form-meta/", api.outside_donor_form_meta_api, name="outside_donor_form_meta_api"),
    path("api/outside-donors/create/", api.outside_donor_create_api, name="outside_donor_create_api"),
    path("api/outside-donors/<int:pk>/", api.outside_donor_detail_api, name="outside_donor_detail_api"),
    path("api/outside-donors/<int:pk>/update/", api.outside_donor_update_api, name="outside_donor_update_api"),
    path("api/outside-donors/<int:pk>/delete/", api.outside_donor_delete_api, name="outside_donor_delete_api"),

    path("api/donations/list/", api.donation_list_api, name="donation_list_api"),
    path("api/donations/form-meta/", api.donation_form_meta_api, name="donation_form_meta_api"),
    path("api/donations/create/", api.donation_create_api, name="donation_create_api"),
    path("api/donations/<int:pk>/", api.donation_detail_api, name="donation_detail_api"),
    path("api/donations/<int:pk>/update/", api.donation_update_api, name="donation_update_api"),
    path("api/donations/<int:pk>/delete/", api.donation_delete_api, name="donation_delete_api"),
    path("api/donations/<int:pk>/fulfill/", api.donation_fulfill_api, name="donation_fulfill_api"),
    path("api/donations/<int:pk>/cancel-pledge/", api.donation_cancel_pledge_api, name="donation_cancel_pledge_api"),
]
```
