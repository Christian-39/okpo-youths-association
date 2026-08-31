"""
URL patterns for OYA Project Donations.
"""
from django.urls import path
from . import views

app_name = "project_donations"

urlpatterns = [
    # Outside Donors
    path("api/outside-donors/", views.outside_donor_list, name="outside_donor_list"),
    path("api/outside-donors/create/", views.outside_donor_create, name="outside_donor_create"),
    path("api/outside-donors/<int:pk>/", views.outside_donor_detail, name="outside_donor_detail"),
    path("api/outside-donors/<int:pk>/update/", views.outside_donor_update, name="outside_donor_update"),
    path("api/outside-donors/<int:pk>/delete/", views.outside_donor_delete, name="outside_donor_delete"),

    # Donations
    path("api/donations/", views.donation_list, name="donation_list"),
    path("api/donations/create/", views.donation_create, name="donation_create"),
    path("api/donations/<int:pk>/", views.donation_detail, name="donation_detail"),
    path("api/donations/<int:pk>/update/", views.donation_update, name="donation_update"),
    path("api/donations/<int:pk>/delete/", views.donation_delete, name="donation_delete"),
    path("api/donations/<int:pk>/fulfill/", views.donation_fulfill, name="donation_fulfill"),
    path("api/donations/<int:pk>/cancel-pledge/", views.donation_cancel_pledge, name="donation_cancel_pledge"),

    # Reports
    path("api/reports/project/<int:project_id>/", views.project_fundraising_report, name="project_fundraising_report"),
    path("api/reports/outside-donor/<int:pk>/", views.outside_donor_statement_pdf, name="outside_donor_statement"),
    path("api/reports/member/<int:pk>/", views.member_donation_history_pdf, name="member_donation_history"),
    path("api/reports/history/", views.donation_history_report, name="donation_history_report"),

    # Pledges
    path("api/pledges/", views.pledge_list, name="pledge_list"),
    path("api/pledges/create/", views.pledge_create, name="pledge_create"),
    path("api/pledges/<int:pk>/", views.pledge_detail, name="pledge_detail"),
    path("api/pledges/<int:pk>/update/", views.pledge_update, name="pledge_update"),
    path("api/pledges/<int:pk>/delete/", views.pledge_delete, name="pledge_delete"),
    path("api/pledges/<int:pk>/payments/create/", views.pledge_payment_create, name="pledge_payment_create"),
    path("api/pledges/<int:pk>/payments/<int:payment_pk>/delete/", views.pledge_payment_delete, name="pledge_payment_delete"),
    path("api/pledges/<int:pk>/fulfill/", views.pledge_fulfill, name="pledge_fulfill"),
    path("api/pledges/<int:pk>/cancel/", views.pledge_cancel, name="pledge_cancel"),

    # AJAX
    path("api/api/search-outside-donors/", views.search_outside_donors_ajax, name="search_outside_donors_ajax"),
    path("api/api/donor-inviter/", views.get_outside_donor_inviter_ajax, name="get_donor_inviter_ajax"),
]
