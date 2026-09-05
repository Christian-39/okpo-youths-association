"""URL patterns for finance app."""
from django.urls import path
from . import views
from . import api

app_name = "finance"

urlpatterns = [
    # AJAX
    path("api/search-members/", views.search_members, name="search_members"),
    path("api/member-dues-preview/", views.member_dues_preview, name="member_dues_preview"),

    # Standalone-frontend JSON API
    path("api/donations/", api.donation_list_api, name="donation_list_api"),
    path("api/donations/create/", api.income_create_api, name="income_create_api"),
    path("api/donations/<int:pk>/", api.income_detail_api, name="income_detail_api"),
    path("api/donations/<int:pk>/delete/", api.income_delete_api, name="income_delete_api"),
    path("api/expenses/", api.expense_list_api, name="expense_list_api"),
    path("api/expenses/create/", api.expense_create_api, name="expense_create_api"),
    path("api/expenses/<int:pk>/", api.expense_detail_api, name="expense_detail_api"),
    path("api/expenses/<int:pk>/delete/", api.expense_delete_api, name="expense_delete_api"),
    path("api/dues/tracker/", api.dues_tracker_api, name="dues_tracker_api"),
    path("api/dues/members/<int:member_id>/", api.member_dues_detail_api, name="member_dues_detail_api"),
    path("api/dues/preview/", api.member_dues_preview_api, name="member_dues_preview_api"),
    path("api/dues/allocate/form-meta/", api.dues_allocate_form_meta_api, name="dues_allocate_form_meta_api"),
    path("api/dues/allocate/", api.dues_allocate_api, name="dues_allocate_api"),
    path("api/dues/<int:pk>/delete/", api.dues_delete_api, name="dues_delete_api"),
    path("api/dues/prepaid/", api.prepaid_list_api, name="prepaid_list_api"),
    path("api/dues/prepaid/<int:member_id>/", api.prepaid_detail_api, name="prepaid_detail_api"),
    path("api/dues/debtors/", api.dues_debtors_list_api, name="dues_debtors_list_api"),
    path("api/summary/", api.finance_summary_api, name="finance_summary_api"),
]
