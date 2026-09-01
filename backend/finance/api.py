"""
JSON API views for the standalone OYA frontend — finance module.
Covers: donations/income, expenses, and the dues tracker (tracker
grid, allocation, member detail, prepaid dues, debtors list). Pledges/
project-donation reconciliation stays in project_donations/api.py.

Added alongside the existing finance/views.py (left untouched). Reuses
IncomeForm / ExpenseForm / DuesPaymentAllocationForm and the exact same
aggregation logic (treasury balance, dues grid computation, debtor
calculation) that the original views compute — copied verbatim rather
than reimplemented differently, so the numbers can't drift between the
two frontends.

Drop this file in as finance/api.py, then wire it up in finance/urls.py
(see urls_patch.py in this same folder).
"""
from decimal import Decimal

from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Count, Q, Sum, Max, Case, When, F, Value, DecimalField
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from accounts.models import User
from auditlogs.services import log_action
from core.utils import exclude_admin_users
from dashboard.services import invalidate_dashboard_cache
from project_donations.models import Donation as ProjectDonation

from .forms import IncomeForm, ExpenseForm, DuesPaymentAllocationForm
from .models import Income, Expense, DuesPayment, DuesPaymentTransaction

PLATFORM_START_YEAR = 2020
# Mirrors finance/views.py's module-level constant (not defined in models.py).
YEARLY_DUES = 5000


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


def _get_treasury_snapshot():
    """Identical calculation to income_create/expense_create/expense_list."""
    total_income = Income.objects.exclude(income_type="PROJECT_DONATION").aggregate(
        total=Coalesce(Sum("amount"), Value(0, output_field=DecimalField()))
    )["total"] or Decimal("0")

    total_project_donations = ProjectDonation.objects.filter(status="CONFIRMED").aggregate(
        total=Coalesce(Sum("amount"), Value(0, output_field=DecimalField()))
    )["total"] or Decimal("0")
    total_income += total_project_donations

    current_year = timezone.now().year
    total_prepaid = DuesPayment.objects.filter(
        year__gt=current_year, amount_paid__gte=YEARLY_DUES,
    ).aggregate(
        total=Coalesce(Sum("amount_paid"), Value(0, output_field=DecimalField()))
    )["total"] or Decimal("0")
    total_income += total_prepaid

    total_expenses = Expense.objects.aggregate(
        total=Coalesce(Sum("amount"), Value(0, output_field=DecimalField()))
    )["total"] or Decimal("0")

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "treasury_balance": total_income - total_expenses,
        "total_prepaid": total_prepaid,
    }


def _serialize_income(i):
    return {
        "id": i.pk,
        "income_type": i.income_type,
        "income_type_display": i.get_income_type_display(),
        "amount": i.amount,
        "reason": i.reason,
        "payer": i.get_payer_display(),
        "created_at": i.created_at,
        "created_by": i.created_by.get_full_name() if i.created_by_id else None,
    }


def _serialize_expense(e):
    return {
        "id": e.pk,
        "amount": e.amount,
        "category": e.category,
        "category_display": e.get_category_display(),
        "description": e.description,
        "receipt_url": e.receipt_file.url if e.receipt_file else None,
        "created_at": e.created_at,
        "created_by": e.created_by.get_full_name() if e.created_by_id else None,
    }


# ── Donations / Income (non-dues) ──────────────────────────────────

@require_http_methods(["GET"])
def donation_list_api(request):
    """
    GET /finance/api/donations/?search=&type=&date_from=&date_to=&page=
    Scope note: mirrors only the "donation_incomes" half of
    finance.views.income_list — the dues-transactions and project-donation
    sections of that page are not covered by this endpoint yet.
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth

    qs = Income.objects.exclude(income_type__in=["DUES", "PROJECT_DONATION"]).select_related("created_by", "member")

    search_term = request.GET.get("search", "")
    if search_term:
        qs = qs.filter(
            Q(reason__icontains=search_term)
            | Q(paid_by__icontains=search_term)
            | Q(member__full_name__icontains=search_term)
            | Q(created_by__full_name__icontains=search_term)
        )
    type_filter = request.GET.get("type", "")
    if type_filter:
        qs = qs.filter(income_type=type_filter)
    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    paginator = Paginator(qs, 10)
    page = paginator.get_page(request.GET.get("page", 1))

    total_donations = qs.aggregate(total=Coalesce(Sum("amount"), Value(0, output_field=DecimalField())))["total"] or Decimal("0")

    return _json({
        "incomes": [_serialize_income(i) for i in page.object_list],
        "income_type_choices": [c for c in Income.INCOME_TYPE_CHOICES if c[0] != "DUES"],
        "total_donations": total_donations,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def income_detail_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    income = get_object_or_404(Income.objects.select_related("created_by", "member"), pk=pk)
    return _json({"income": _serialize_income(income)})


@require_http_methods(["POST"])
def income_create_api(request):
    """POST /finance/api/donations/create/ (JSON body)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = IncomeForm(request.POST)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    income = form.save(commit=False)
    income.created_by = request.user
    income.save()

    log_action(
        user=request.user, action="CREATE", object_type="Income", object_id=income.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Recorded {income.get_income_type_display()}: \u20a6{income.amount:,.2f} - {income.reason} (by {income.get_payer_display()})",
    )
    invalidate_dashboard_cache()

    return _json({"income": _serialize_income(income)}, status=201)


@require_http_methods(["DELETE"])
def income_delete_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    income = get_object_or_404(Income, pk=pk)
    amount, reason = income.amount, income.reason
    income.delete()
    log_action(
        user=request.user, action="DELETE", object_type="Income", object_id=pk,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Deleted income record: \u20a6{amount:,.2f} - {reason}",
    )
    invalidate_dashboard_cache()
    return _json({"detail": "Deleted."})


# ── Expenses ────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def expense_list_api(request):
    """GET /finance/api/expenses/?search=&category=&date_from=&date_to=&page="""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    qs = Expense.objects.select_related("created_by").all()

    search_term = request.GET.get("search", "")
    if search_term:
        qs = qs.filter(
            Q(description__icontains=search_term)
            | Q(category__icontains=search_term)
            | Q(created_by__full_name__icontains=search_term)
        )
    category_filter = request.GET.get("category", "")
    if category_filter:
        qs = qs.filter(category=category_filter)
    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    paginator = Paginator(qs, 10)
    page = paginator.get_page(request.GET.get("page", 1))

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month_expenses = Expense.objects.filter(created_at__gte=month_start).aggregate(total=Sum("amount"))["total"] or 0

    snapshot = _get_treasury_snapshot()

    return _json({
        "expenses": [_serialize_expense(e) for e in page.object_list],
        "category_choices": Expense.CATEGORY_CHOICES,
        "this_month_expenses": this_month_expenses,
        **snapshot,
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })


@require_http_methods(["GET"])
def expense_detail_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    expense = get_object_or_404(Expense.objects.select_related("created_by"), pk=pk)
    return _json({"expense": _serialize_expense(expense)})


@require_http_methods(["POST"])
def expense_create_api(request):
    """POST /finance/api/expenses/create/ (multipart/form-data — receipt_file is mandatory)"""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = ExpenseForm(request.POST, request.FILES)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    expense = form.save(commit=False)
    expense.created_by = request.user
    expense.save()

    log_action(
        user=request.user, action="CREATE", object_type="Expense", object_id=expense.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Recorded expense: \u20a6{expense.amount:,.2f} - {expense.category}",
    )
    invalidate_dashboard_cache()

    return _json({"expense": _serialize_expense(expense)}, status=201)


@require_http_methods(["DELETE"])
def expense_delete_api(request, pk):
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_admin(request)
    if forbidden:
        return forbidden

    expense = get_object_or_404(Expense, pk=pk)
    amount, category = expense.amount, expense.category
    expense.delete()
    log_action(
        user=request.user, action="DELETE", object_type="Expense", object_id=pk,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Deleted expense: \u20a6{amount:,.2f} - {category}",
    )
    invalidate_dashboard_cache()
    return _json({"detail": "Deleted."})


# ── Dues Tracker ────────────────────────────────────────────────

def _serialize_member_brief(m):
    return {"id": m.pk, "full_name": m.get_full_name(), "serial_number": m.serial_number}


@require_http_methods(["GET"])
def dues_tracker_api(request):
    """
    GET /finance/api/dues/tracker/
    Full member x year grid. Mirrors finance.views.dues_tracker's
    aggregation exactly (same queries, same debt math) — the grid is
    just serialized to JSON instead of rendered as an HTML table.
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth

    current_year = timezone.now().year
    years = list(range(PLATFORM_START_YEAR, current_year + 1))

    members = list(
        exclude_admin_users(
            User.objects.filter(serial_number__isnull=False).exclude(serial_number="")
        ).order_by("full_name")
    )

    dues_map = {}
    for dp in DuesPayment.objects.select_related("member").all():
        dues_map[(dp.member_id, dp.year)] = dp

    per_member_totals = (
        DuesPayment.objects.filter(member__in=members)
        .values("member_id")
        .annotate(
            total_paid=Coalesce(
                Sum(Case(When(year__lte=current_year, then=F("amount_paid")), default=Value(0), output_field=DecimalField())),
                Value(0), output_field=DecimalField(),
            ),
        )
    )
    totals_by_member = {row["member_id"]: row for row in per_member_totals}

    member_rows = []
    total_dues_collected = Decimal("0")
    total_dues_expected = Decimal("0")
    total_possible_dues = Decimal("0")

    for member in members:
        join_year = DuesPayment.get_member_join_year(member)
        start_year = max(join_year, PLATFORM_START_YEAR)
        expected_years = current_year - start_year + 1
        total_possible_dues += expected_years * YEARLY_DUES

        totals = totals_by_member.get(member.id, {"total_paid": Decimal("0")})
        total_expected_for_member = expected_years * DuesPayment.YEARLY_DUES_AMOUNT
        debt_owed = max(total_expected_for_member - totals["total_paid"], Decimal("0"))

        row = {"member": _serialize_member_brief(member), "years": {}, "total_debt": debt_owed, "join_year": join_year}

        years_paid_count = 0
        for year in years:
            key = (member.id, year)
            if year < join_year:
                row["years"][year] = {"status": DuesPayment.STATUS_NOT_APPLICABLE, "amount_paid": Decimal("0"), "before_join": True}
            elif key in dues_map:
                dp = dues_map[key]
                row["years"][year] = {"status": dp.status, "amount_paid": dp.amount_paid, "remaining": dp.remaining_balance, "before_join": False}
                total_dues_collected += dp.amount_paid
                if dp.is_fully_paid:
                    years_paid_count += 1
            else:
                row["years"][year] = {"status": DuesPayment.STATUS_OWED, "amount_paid": Decimal("0"), "remaining": Decimal(str(YEARLY_DUES)), "before_join": False}
                total_dues_expected += YEARLY_DUES

        row["years_paid_count"] = years_paid_count
        member_rows.append(row)

    total_prepaid = DuesPayment.objects.filter(year__gt=current_year, amount_paid__gte=YEARLY_DUES).aggregate(
        total=Coalesce(Sum("amount_paid"), Value(0, output_field=DecimalField()))
    )["total"] or Decimal("0")
    total_dues_collected += total_prepaid

    active_members_count = len(members)
    collection_rate = round(float(total_dues_collected) / float(total_possible_dues) * 100, 1) if total_possible_dues > 0 else 0

    this_year_paid = DuesPayment.objects.filter(year=current_year, amount_paid__gte=YEARLY_DUES).count()
    this_year_rate = round((this_year_paid / active_members_count * 100), 1) if active_members_count > 0 else 0

    return _json({
        "years": years,
        "member_rows": member_rows,
        "current_year": current_year,
        "yearly_dues": YEARLY_DUES,
        "total_dues_collected": total_dues_collected,
        "total_dues_expected": total_dues_expected,
        "total_possible_dues": total_possible_dues,
        "collection_rate": collection_rate,
        "this_year_paid": this_year_paid,
        "this_year_expected": active_members_count,
        "this_year_rate": this_year_rate,
        "active_members_count": active_members_count,
        "total_prepaid": total_prepaid,
    })


@require_http_methods(["GET"])
def member_dues_detail_api(request, member_id):
    """GET /finance/api/dues/members/<member_id>/ — mirrors finance.views.member_dues_detail."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    member = get_object_or_404(User, pk=member_id)
    current_year = timezone.now().year
    join_year = DuesPayment.get_member_join_year(member)

    max_year = max(current_year, DuesPayment.objects.filter(member=member).aggregate(
        max_year=Coalesce(Max("year"), Value(current_year))
    )["max_year"])
    years = list(range(PLATFORM_START_YEAR, max_year + 1))

    debt_info = DuesPayment.get_member_debt(member)
    payments = DuesPayment.objects.filter(member=member).select_related("recorded_by", "income").order_by("-year")

    year_status = []
    for year in years:
        if year < join_year:
            year_status.append({"year": year, "status": DuesPayment.STATUS_NOT_APPLICABLE, "is_future": year > current_year, "before_join": True})
        else:
            payment = payments.filter(year=year).first()
            year_status.append({
                "year": year,
                "status": payment.status if payment else DuesPayment.STATUS_OWED,
                "amount_paid": payment.amount_paid if payment else Decimal("0"),
                "is_future": year > current_year,
                "before_join": False,
            })

    transactions = DuesPaymentTransaction.objects.filter(member=member).select_related("recorded_by").order_by("-payment_date")[:20]

    return _json({
        "member": _serialize_member_brief(member),
        "year_status": year_status,
        "debt_info": {
            "debt_owed": debt_info.get("debt_owed", Decimal("0")),
            "years_expected": debt_info.get("years_expected", []),
            "years_paid": debt_info.get("years_paid", []),
        },
        "transactions": [
            {
                "id": t.pk, "total_amount": t.total_amount, "payment_method": t.payment_method,
                "receipt_reference": t.receipt_reference, "payment_date": t.payment_date,
                "recorded_by": t.recorded_by.get_full_name() if t.recorded_by_id else None,
            }
            for t in transactions
        ],
        "yearly_dues": YEARLY_DUES,
        "current_year": current_year,
        "join_year": join_year,
    })


@require_http_methods(["GET"])
def member_dues_preview_api(request):
    """GET /finance/api/dues/preview/?member_id= — mirrors finance.views.member_dues_preview exactly."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    member_id = request.GET.get("member_id")
    if not member_id:
        return _json({"outstanding": []})
    try:
        member = User.objects.get(pk=member_id)
    except User.DoesNotExist:
        return _json({"outstanding": []})

    outstanding = DuesPayment.get_outstanding_years(member)
    return _json({"outstanding": [
        {"year": item["year"], "amount_paid": item["amount_paid"], "remaining_balance": item["remaining_balance"], "status": item["status"]}
        for item in outstanding
    ]})


@require_http_methods(["GET"])
def dues_allocate_form_meta_api(request):
    """GET /finance/api/dues/allocate/form-meta/ — payment method choices + registered members for the allocation form."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    members = exclude_admin_users(
        User.objects.filter(serial_number__isnull=False).exclude(serial_number="")
    ).order_by("full_name")
    return _json({
        "members": [_serialize_member_brief(m) for m in members],
        "payment_method_choices": DuesPaymentTransaction.PAYMENT_METHOD_CHOICES,
        "yearly_dues": YEARLY_DUES,
    })


@require_http_methods(["POST"])
def dues_allocate_api(request):
    """
    POST /finance/api/dues/allocate/ (JSON body)
    Reuses DuesPaymentAllocationForm.allocate() verbatim — the smart
    year-by-year allocation algorithm lives only in that form method,
    not reimplemented here.
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth
    forbidden = _require_executive(request)
    if forbidden:
        return forbidden

    form = DuesPaymentAllocationForm(request.POST, recorded_by=request.user)
    if not form.is_valid():
        return _json({"errors": form.errors}, status=400)

    try:
        with transaction.atomic():
            result = form.allocate()
    except Exception as e:
        return _json({"detail": f"Allocation failed: {e}"}, status=400)

    tx = result["transaction"]
    allocation_summary = ", ".join(f"{a['year']}: \u20a6{a['allocated']:,.2f}" for a in result["allocations"])
    log_action(
        user=request.user, action="CREATE", object_type="DuesPaymentTransaction", object_id=tx.id,
        ip_address=getattr(request, "client_ip", ""),
        description=f"Allocated dues payment: {tx.member.get_full_name()} \u2014 \u20a6{tx.total_amount:,.2f} \u2192 [{allocation_summary}]",
    )
    invalidate_dashboard_cache()

    return _json({
        "allocations": result["allocations"],
        "total_allocated": result["total_allocated"],
        "remaining": result["remaining"],
        "messages": result["messages"],
    }, status=201)


@require_http_methods(["DELETE"])
def dues_delete_api(request, pk):
    """DELETE /finance/api/dues/<pk>/delete/ — deletes the DuesPayment and its linked Income record, same as the original view."""
    unauth = _require_auth(request)
    if unauth:
        return unauth
    if not request.user.has_admin_access():
        return _json({"detail": "Admin access required."}, status=403)

    dues = get_object_or_404(DuesPayment.objects.select_related("member", "income"), pk=pk)
    member_name = dues.member.get_full_name()
    year = dues.year
    if dues.income:
        dues.income.delete()
    dues.delete()

    log_action(user=request.user, action="DELETE", object_type="DuesPayment", object_id=pk,
               ip_address=getattr(request, "client_ip", ""), description=f"Deleted dues record: {member_name} - {year}")
    invalidate_dashboard_cache()
    return _json({"detail": "Deleted."})


@require_http_methods(["GET"])
def prepaid_list_api(request):
    """GET /finance/api/dues/prepaid/ — mirrors finance.views.prepaid_list's grouping-by-member logic exactly."""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    current_year = timezone.now().year
    prepaid_qs = DuesPayment.objects.filter(year__gt=current_year, amount_paid__gte=YEARLY_DUES).select_related(
        "member", "recorded_by"
    ).order_by("member__full_name", "-year")

    member_map = {}
    for dp in prepaid_qs:
        mid = dp.member_id
        if mid not in member_map:
            member_map[mid] = {"member": dp.member, "years": [], "total_amount": Decimal("0"), "recorded_by": dp.recorded_by, "created_at": dp.created_at}
        member_map[mid]["years"].append(dp.year)
        member_map[mid]["total_amount"] += dp.amount_paid
        if dp.created_at > member_map[mid]["created_at"]:
            member_map[mid]["created_at"] = dp.created_at
            member_map[mid]["recorded_by"] = dp.recorded_by

    prepaid_grouped = sorted([
        {
            "member": _serialize_member_brief(data["member"]),
            "years": sorted(data["years"]),
            "total_amount": data["total_amount"],
            "recorded_by": data["recorded_by"].get_full_name() if data["recorded_by"] else None,
            "created_at": data["created_at"],
        }
        for data in member_map.values()
    ], key=lambda x: x["total_amount"], reverse=True)

    return _json({
        "prepaid_records": prepaid_grouped,
        "total_prepaid_amount": sum((r["total_amount"] for r in prepaid_grouped), Decimal("0")),
        "prepaid_members_count": len(prepaid_grouped),
        "current_year": current_year,
        "yearly_dues": YEARLY_DUES,
    })


@require_http_methods(["GET"])
def prepaid_detail_api(request, member_id):
    """GET /finance/api/dues/prepaid/<member_id>/"""
    unauth = _require_auth(request)
    if unauth:
        return unauth

    member = get_object_or_404(User, pk=member_id)
    current_year = timezone.now().year
    prepaid_records = DuesPayment.objects.filter(member=member, year__gt=current_year).select_related("recorded_by").order_by("-year")
    total_prepaid = prepaid_records.aggregate(total=Sum("amount_paid"))["total"] or Decimal("0")
    debt_info = DuesPayment.get_member_debt(member)

    return _json({
        "member": _serialize_member_brief(member),
        "prepaid_records": [
            {"year": r.year, "amount_paid": r.amount_paid, "recorded_by": r.recorded_by.get_full_name() if r.recorded_by_id else None, "created_at": r.created_at}
            for r in prepaid_records
        ],
        "total_prepaid": total_prepaid,
        "debt_info": {"debt_owed": debt_info.get("debt_owed", Decimal("0"))},
        "current_year": current_year,
        "yearly_dues": YEARLY_DUES,
    })


@require_http_methods(["GET"])
def dues_debtors_list_api(request):
    """
    GET /finance/api/dues/debtors/?search=&year=&page=

    Performance note: the previous version called
    DuesPayment.get_member_debt(member) inside a per-member Python loop,
    which runs ~4 aggregate queries per member — with ~1,500 members
    that's 6,000+ queries on a single page load. This version bulk-fetches
    every member's DuesPayment rows and last-payment date in two queries
    total, then computes the same debt math (matching
    DuesPayment.get_member_debt's total_paid/debt_owed/years_paid logic
    exactly) in memory. The business rule — debt only counted from
    join_year onward — is unchanged.
    """
    unauth = _require_auth(request)
    if unauth:
        return unauth

    current_year = timezone.now().year
    search_term = request.GET.get("search", "").strip()
    year_filter = request.GET.get("year", "")

    members_qs = User.objects.filter(serial_number__isnull=False).exclude(serial_number="")
    members_qs = exclude_admin_users(members_qs)
    if search_term:
        members_qs = members_qs.filter(Q(full_name__icontains=search_term) | Q(serial_number__icontains=search_term) | Q(phone__icontains=search_term))
    members = list(members_qs)
    member_ids = [m.id for m in members]

    # Bulk-fetch every DuesPayment row for these members in one query,
    # grouped by member_id, instead of one query per member.
    dues_by_member = {}
    for row in DuesPayment.objects.filter(member_id__in=member_ids).values("member_id", "year", "amount_paid"):
        dues_by_member.setdefault(row["member_id"], []).append((row["year"], row["amount_paid"]))

    # Bulk-fetch each member's last payment date in one query.
    last_payment_by_member = {
        row["member_id"]: row["max_date"]
        for row in DuesPaymentTransaction.objects.filter(member_id__in=member_ids)
        .values("member_id").annotate(max_date=Max("payment_date"))
    }

    debtor_list = []
    for member in members:
        join_year = DuesPayment.get_member_join_year(member)  # pure Python, no query
        start_year = max(join_year, PLATFORM_START_YEAR)
        years_expected = list(range(start_year, current_year + 1))
        years_expected_set = set(years_expected)
        total_expected = len(years_expected) * DuesPayment.YEARLY_DUES_AMOUNT

        member_dues = dues_by_member.get(member.id, [])
        total_paid = sum((amt for yr, amt in member_dues if yr in years_expected_set), Decimal("0"))
        years_paid = [yr for yr, amt in member_dues if yr in years_expected_set and amt >= DuesPayment.YEARLY_DUES_AMOUNT]
        debt_owed = max(total_expected - total_paid, Decimal("0"))

        if debt_owed <= 0:
            continue

        if year_filter:
            year_int = int(year_filter)
            if year_int < join_year or year_int > current_year:
                continue
            year_amt = next((amt for yr, amt in member_dues if yr == year_int), Decimal("0"))
            if year_amt >= DuesPayment.YEARLY_DUES_AMOUNT:
                continue

        last_payment = last_payment_by_member.get(member.id)

        debtor_list.append({
            "member": _serialize_member_brief(member),
            "total_due": total_expected,
            "total_paid": total_expected - debt_owed,
            "debt": debt_owed,
            "years_missed": len(years_expected) - len(years_paid),
            "last_payment_date": last_payment,
        })

    debtor_list.sort(key=lambda x: x["debt"], reverse=True)
    total_outstanding = sum((d["debt"] for d in debtor_list), Decimal("0"))

    paginator = Paginator(debtor_list, 25)
    page = paginator.get_page(request.GET.get("page", 1))

    return _json({
        "debtors": list(page.object_list),
        "years": list(range(PLATFORM_START_YEAR, current_year + 1)),
        "stats": {"total_members": len(debtor_list), "total_outstanding": total_outstanding},
        "pagination": {
            "page": page.number, "num_pages": paginator.num_pages,
            "has_previous": page.has_previous(), "has_next": page.has_next(),
            "previous_page_number": page.previous_page_number() if page.has_previous() else None,
            "next_page_number": page.next_page_number() if page.has_next() else None,
            "start_index": page.start_index(), "end_index": page.end_index(), "count": paginator.count,
        },
    })
