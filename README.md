# Okpo Youths Association Management System (OYA)

## PEACE & PROGRESS

*A complete digital management system for the Okpo Youths Association.*

---

# Table of Contents

- Overview
- Purpose of the System
- Who Can Use the System
- Main Features
- User Roles
- System Modules
- How the System Works
- Security & Accountability
- Benefits of the System
- Summary

---

# Overview

The **Okpo Youths Association Management System (OYA)** is a digital platform created to help the association manage its daily activities in one secure place.

Instead of keeping information in notebooks, paper files, spreadsheets, or different WhatsApp chats, everything is stored safely in one system that authorized members can access.

The system makes it easier to manage:

- Members
- Executives
- Finances
- Projects
- Elections
- Donations
- Community operations
- Notifications
- Association records

---

# Purpose of the System

The system was designed to help the association:

- Keep accurate records of every member.
- Improve accountability and transparency.
- Reduce paperwork.
- Prevent loss of important records.
- Track the association's income and expenses.
- Manage projects from start to completion.
- Conduct organized elections.
- Keep historical records for future executives.
- Make information easy to find whenever needed.

---

# Who Can Use the System

The system has three types of users.

## Administrator

Administrators manage the entire system.

They can:

- Register members.
- Manage executives.
- Record income and expenses.
- Manage projects.
- Manage elections.
- View reports.
- Reset member PINs.
- Change system settings.

---

## Executives

Executives assist in managing the association.

They can:

- Register members.
- Update member information.
- Record finances.
- Manage projects.
- Manage operations.
- Manage elections.
- View reports.

Some sensitive settings remain available only to administrators.

---

## Members

Regular members have limited access.

They can:

- View their profile.
- View announcements.
- View projects.
- View election information.
- Update their phone number and address.
- Receive notifications.

Members cannot edit association records.

---

# Main Features

## Member Management

The system keeps complete information about every registered member, including:

- Full name
- Membership serial number
- Clan (Umu Nna)
- Phone number
- Occupation
- Date joined
- Membership status
- Passport photograph

The system also automatically changes members to **Past Member** when they reach the association's retirement age.

---

## Executive Management

The system keeps records of both current and past executives.

It records:

- Position held
- Start date
- End date
- Executive history

This preserves the leadership history of the association.

---

## Finance Management

Every financial transaction can be recorded.

This includes:

- Annual dues
- Donations
- Event payments
- Other income
- Expenses
- Receipts

The system automatically calculates the association's available balance.

---

## Project Management

Association projects can be monitored from beginning to completion.

Each project contains:

- Project description
- Budget
- Progress
- Current status
- Donations received

Project status includes:

- Future
- Ongoing
- Completed

---

## Project Donations

Donations made towards projects are properly recorded.

The system keeps track of:

- Donor name
- Donation amount
- Project supported
- Donation status

Every confirmed donation is automatically added to the association's financial records.

---

## Elections

The election section helps manage the association's electoral process.

It allows administrators to:

- Schedule elections
- Register candidates
- Store manifestos
- Record election results
- Keep handover records

This creates a complete election history.

---

## Operations

The operations section manages daily association activities.

### Task Force

Assign members to different committees or task forces.

### Motorcycles

Keep records of association motorcycles and their condition.

### Case Management

Record community cases, investigations, resolutions, and fines where necessary.

---

## Notifications

The system allows important announcements to be sent directly to members.

Notifications include:

- General announcements
- Meeting reminders
- Financial notices
- Election updates
- Project updates

Members can easily see which notifications they have already read.

---

## Dashboard

The dashboard provides a quick summary of the association.

It displays:

- Total members
- Current executives
- Available treasury balance
- Ongoing projects
- Open cases
- Recent activities

This helps leaders understand the association's current status at a glance.

---

# System Modules

| Module | Purpose |
|---------|---------|
| Members | Manage all member records |
| Executives | Manage executive positions and history |
| Finance | Record income, expenses, and treasury balance |
| Projects | Manage association projects |
| Donations | Record project donations |
| Elections | Conduct and record elections |
| Operations | Manage task force, motorcycles, and cases |
| Notifications | Send announcements to members |
| Reports | View summaries and statistics |
| Settings | Configure association information |

---

# How the System Works

## Register a Member

Administrator registers a new member.

⬇️

Member receives a unique serial number.

⬇️

Member logs into the system using the serial number and PIN.

⬇️

Member becomes part of the association's records.

---

## Record Income

Administrator records income.

⬇️

Income is added to the treasury.

⬇️

The available balance updates automatically.

⬇️

The transaction becomes part of the association's financial history.

---

## Manage Projects

Create a project.

⬇️

Set the budget.

⬇️

Receive donations.

⬇️

Track progress.

⬇️

Mark the project as completed.

---

## Conduct Elections

Create an election.

⬇️

Register candidates.

⬇️

Record election results.

⬇️

Generate handover records.

⬇️

Store the election history.

---

# Security & Accountability

The system is designed to keep association records safe and trustworthy.

Some important features include:

- Every user has a unique login.
- Every member has a personal 6-digit PIN.
- Only authorized users can access sensitive information.
- Every important action is recorded automatically.
- Financial records remain traceable.
- Historical records are preserved for future executives.

These features improve transparency and accountability within the association.

---

# Benefits of the System

Using this system helps the association:

- Eliminate paper record keeping.
- Keep all information in one place.
- Improve financial accountability.
- Reduce human errors.
- Protect important association records.
- Access information quickly.
- Preserve the association's history.
- Improve communication with members.
- Support better decision-making.
- Increase transparency in leadership.

---

# Summary

The **Okpo Youths Association Management System (OYA)** is a complete digital platform built to simplify the daily management of the association.

It brings together membership records, finances, projects, elections, operations, and communication into one secure system.

By replacing manual record-keeping with a centralized digital solution, the association can operate more efficiently, improve accountability, preserve its history, and provide better service to all members.

---

**Version:** 1.0  
**Prepared For:** Okpo Youths Association  
**Motto:** *Peace & Progress*
---

# Developer handover

## Repository layout

- `backend/` is the Django 5.2 authoritative backend. The original models,
  forms, signals, calculations, audit services, migrations, and server-rendered
  templates remain in place so existing business rules and historical data are
  preserved.
- `frontend/` is a standalone HTML5/CSS3/vanilla-JavaScript client. It talks
  to the backend through JSON APIs and never imports Django template syntax.
- `frontend/assets/js/api.js` is the centralized API client; `auth.js`,
  `shell.js`, `theme.js`, and `pwa.js` provide the shared client modules.

## Local setup

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

In a second terminal:

```bash
cd frontend
python -m http.server 5500 --bind 127.0.0.1
```

Open `http://127.0.0.1:5500/login.html`. Configure deployment values only
through `backend/.env` and the runtime frontend configuration described in
`frontend/README.md`; do not commit credentials or PINs.

## Authoritative API contract

All protected API endpoints use Django session authentication and CSRF. The
backend performs every permission check, form validation, financial
calculation, election transition, linked-record update, upload, and audit log.
The frontend role flags are presentation hints only.

Stable entry points include `/health/`, `/api/version/`,
`/accounts/api/`, `/members/api/`, `/executives/api/`, `/elections/api/`,
`/finance/api/`, `/projects/api/`, `/project-donations/api/`,
`/operations/api/`, `/notifications/api/`, `/auditlogs/api/`, and
`/dashboard/api/`. Handover and administration report endpoints are documented
in `backend/README.md`.

## Release checks

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test --noinput
python -m py_compile $(find . -name '*.py' -not -path './.venv/*')
cd ../frontend
find assets/js -name '*.js' -print0 | xargs -0 -n1 node --check
```

Before deployment, test authenticated and unauthenticated behavior, admin,
executive, and floor-member permissions, pagination/search, file uploads,
400/401/403/404/409/429/500 responses, network timeout/offline behavior, cache
expiry, service-worker updates, and responsive layouts at 360px, 768px,
1024px, and 1440px. The service worker never caches authenticated API,
finance, election, permission, or live-status responses.

---

# Migration implementation update — 2026-09-24

The target repository now runs as a separated application:

- **Backend:** Django API backend in `backend/`, with versioned aliases under
  `/api/v1/`, Django session authentication, CSRF protection, backend-enforced
  RBAC, server-side validation/calculation, audit logging, and MySQL-ready
  configuration.
- **Frontend:** standalone HTML/CSS/vanilla JavaScript in `frontend/`, with no
  Django template syntax and page scripts in `frontend/assets/js/pages/`.
- **API client:** all frontend API calls go through `frontend/assets/js/api.js`,
  which applies the API base URL, `/api/v1` prefix, credentials, CSRF, timeout,
  retry, de-duplication, and normalized error handling.
- **Authentication:** members sign in with membership serial number and 6-digit
  PIN through the backend. PINs are hashed; login attempts are rate-limited;
  sessions are HttpOnly Django cookies.

Important endpoints include:

- `/api/v1/accounts/api/csrf/`
- `/api/v1/accounts/api/login/`
- `/api/v1/accounts/api/logout/`
- `/api/v1/accounts/api/me/`
- `/api/v1/members/api/list/`
- `/api/v1/executives/api/list/`
- `/api/v1/finance/api/summary/`
- `/api/v1/projects/api/list/`
- `/api/v1/project-donations/api/donations/list/`
- `/api/v1/elections/api/list/`
- `/api/v1/elections/api/handovers/list/`
- `/api/v1/elections/api/administrations/`
- `/api/v1/operations/api/cases/list/`
- `/api/v1/notifications/api/notifications/`
- `/api/v1/auditlogs/api/list/`
- `/api/v1/settings/api/settings/`
- `/api/v1/search/api/`

## Development setup

```bash
cd backend
python -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
cp .env.example .env
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py runserver 127.0.0.1:8000
```

In a second terminal:

```bash
cd frontend
python -m http.server 5500 --bind 127.0.0.1
```

Open `http://127.0.0.1:5500/login.html`.

## Frontend runtime configuration

Use `window.OYA_RUNTIME_CONFIG` (see `frontend/config.runtime.example.js`) or
`localStorage.oya_api_base_url` for staging checks. Do not hardcode production
API origins across pages.

## Tests

```bash
./run-tests.sh            # backend + frontend checks
./run-tests.sh backend    # Django API contract tests
./run-tests.sh frontend   # JS syntax and static frontend contract checks
```

Latest local result: all suites passed.

See `MIGRATION_IMPLEMENTATION_NOTES.md` for the implementation/audit notes and
remaining manual staging checks.
