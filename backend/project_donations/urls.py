"""
URL patterns for OYA Project Donations.
"""
from django.urls import path
from . import views
from . import api

app_name = "project_donations"

urlpatterns = [
    # Outside Donors
    path("outside-donors/<int:pk>/delete/", views.outside_donor_delete, name="outside_donor_delete"),

    # Donations
    path("donations/<int:pk>/delete/", views.donation_delete, name="donation_delete"),
    path("donations/<int:pk>/fulfill/", views.donation_fulfill, name="donation_fulfill"),
    path("donations/<int:pk>/cancel-pledge/", views.donation_cancel_pledge, name="donation_cancel_pledge"),

    # Reports
    path("reports/project/<int:project_id>/", views.project_fundraising_report, name="project_fundraising_report"),
    path("reports/outside-donor/<int:pk>/", views.outside_donor_statement_pdf, name="outside_donor_statement"),
    path("reports/member/<int:pk>/", views.member_donation_history_pdf, name="member_donation_history"),
    path("reports/history/", views.donation_history_report, name="donation_history_report"),

    # Pledges
    path("pledges/<int:pk>/payments/create/", views.pledge_payment_create, name="pledge_payment_create"),
    path("pledges/<int:pk>/payments/<int:payment_pk>/delete/", views.pledge_payment_delete, name="pledge_payment_delete"),
    path("pledges/<int:pk>/fulfill/", views.pledge_fulfill, name="pledge_fulfill"),
    path("pledges/<int:pk>/cancel/", views.pledge_cancel, name="pledge_cancel"),

    # AJAX
    path("api/search-outside-donors/", views.search_outside_donors_ajax, name="search_outside_donors_ajax"),
    path("api/donor-inviter/", views.get_outside_donor_inviter_ajax, name="get_donor_inviter_ajax"),

    # Standalone-frontend JSON API
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

    path("api/pledges/list/", api.pledge_list_api, name="pledge_list_api"),
    path("api/pledges/form-meta/", api.pledge_form_meta_api, name="pledge_form_meta_api"),
    path("api/pledges/create/", api.pledge_create_api, name="pledge_create_api"),
    path("api/pledges/<int:pk>/", api.pledge_detail_api, name="pledge_detail_api"),
    path("api/pledges/<int:pk>/update/", api.pledge_update_api, name="pledge_update_api"),
    path("api/pledges/<int:pk>/delete/", api.pledge_delete_api, name="pledge_delete_api"),
    path("api/pledges/<int:pk>/payments/create/", api.pledge_payment_create_api, name="pledge_payment_create_api"),
    path("api/pledges/<int:pk>/payments/<int:payment_pk>/delete/", api.pledge_payment_delete_api, name="pledge_payment_delete_api"),
    path("api/pledges/<int:pk>/fulfill/", api.pledge_fulfill_api, name="pledge_fulfill_api"),
    path("api/pledges/<int:pk>/cancel/", api.pledge_cancel_api, name="pledge_cancel_api"),
]
