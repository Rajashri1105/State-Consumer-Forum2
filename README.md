change12# State Consumer Forum Complaint Registration and Intelligent Hearing Management Portal

A full-stack web application that digitizes the complete consumer dispute resolution
process — from complaint registration to final judgment — for a State Consumer
Disputes Redressal Forum. Built with React, Node.js/Express, PostgreSQL (via
Prisma), and JWT authentication with role-based access control.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Core Features](#core-features)
3. [The Five Intelligent Engines](#the-five-intelligent-engines)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Setup — Option A: Docker](#setup--option-a-docker-recommended)
7. [Setup — Option B: Manual (Node + PostgreSQL)](#setup--option-b-manual-node--postgresql)
8. [Default Seeded Accounts](#default-seeded-accounts)
9. [Environment Variables](#environment-variables)
10. [API Overview](#api-overview)
11. [Known Limitations](#known-limitations)

---

## Tech Stack

**Frontend:** React 18 + Vite, React Router DOM, Material UI, Redux Toolkit, Axios,
React Hook Form + Yup, React Toastify, Chart.js, Framer Motion, Day.js, Lucide Icons

**Backend:** Node.js + Express, Prisma ORM, JWT (access + rotating refresh tokens),
Bcrypt, Multer, Nodemailer, Helmet, Morgan, express-validator, CORS

**Database:** PostgreSQL, fully normalized schema (14 models), hand-verified
migration SQL, seed script with realistic sample data

---

## Core Features

**Public site:** Home, About, Consumer Rights, Complaint Procedure, FAQs, Contact

**Consumer:** Register/login/email verification, file complaints with evidence
upload, track complaints with a full visual timeline, view hearing calendar,
receive notifications, download judgments, download a PDF complaint receipt,
withdraw a complaint before a hearing is scheduled, edit profile, change password

**Scrutiny Clerk:** works a *shared* intake queue — claims a complaint (atomic, so two
clerks can never hold the same one), then accepts it, returns it to the consumer as
*defective* with remarks, or rejects it. Unattended claims return to the pool automatically.

**Court Clerk:** belongs to one bench. Sees only that bench's cases, schedules/reschedules
hearings (engine-suggested or manual), auto-generated hearing notices, bench cause list,
judge availability panel (who's on leave today)

**Registrar:** allots accepted complaints to benches (automatic least-loaded, or manual
choice), re-allots cases between benches, approves cross-bench moves when a judge goes on
leave, and watches per-bench workload

**Judge:** Assigned case list, hearing remarks, adjourn/complete hearings, upload
judgments, close cases, mark personal leave (with automatic conflict detection
against already-scheduled hearings)

**Administrator:** Bench set-up (create benches, seat judges, attach court clerks),
allotment mode (automatic / manual), User & judge account management (including permanent deletion
for accounts with no history), category & priority-rule configuration, analytics
dashboard with CSV export, audit logs, holiday calendar, forum settings including
configurable hearing time slots

## The Five Intelligent Engines

All five are **rule-based**, not machine learning, per the original project brief:

1. **Hearing Scheduling Engine** — walks forward from a priority-weighted lead
   time, skipping holidays, non-working days, unavailable judges, *and judges
   on marked leave*, respecting each judge's max-hearings-per-day and the
   forum's configurable time slots, and returns a suggested date + time with a
   human-readable reasoning trail. The clerk can accept or override it.
2. **Smart Priority Engine** — matches admin-configurable keyword rules against
   the complaint text; falls back to the category's default priority.
3. **Judge Workload Balancer** — ranks judges by pending cases, today's hearing
   load, and this week's load, surfaced to the clerk during assignment.
4. **Duplicate Complaint Detection** — Jaccard word-overlap on descriptions +
   name-similarity on the opposite party, flagged to the filer before saving.
5. **Real-Time Complaint Timeline** — every status transition is written with a
   timestamp and shown as a visual case history.

## Additional Notable Features

- **Judge leave/unavailability tracking** — when a judge marks leave, the
  system immediately flags any already-scheduled hearings that fall within
  that period, so the clerk knows exactly what needs rescheduling instead of
  finding out when the judge doesn't show up.
- **Auto-generated PDF documents** — hearing notices are generated automatically
  the moment a hearing is scheduled (and regenerated on reschedule); consumers
  can download a PDF acknowledgment receipt for any complaint at any time.
- **CSV export** on the admin analytics page (overview stats, monthly volume,
  category distribution, judge workload).
- **Route-level code splitting** — each role's pages are a separate JS chunk,
  so a consumer's browser never downloads admin/analytics code and vice versa.
- **Automated tests** for the priority engine and duplicate-detection engine
  (`npm test` in `server/`, using Node's built-in test runner).

---

## Project Structure

```
consumer-forum-portal/
├── client/                 React + Vite frontend
│   └── src/
│       ├── pages/           consumer/ clerk/ judge/ admin/ shared/ public/ auth/
│       ├── components/      layout/ common/
│       ├── services/        one file per API resource
│       ├── redux/           auth, notifications, UI slices
│       ├── routes/          guards + nav config
│       └── theme/           design tokens (light/dark)
├── server/                 Node + Express backend
│   ├── controllers/
│   ├── routes/
│   ├── services/            the 5 engines + audit/notification services
│   ├── middleware/          auth, validation, rate limiting, error handling, upload
│   ├── validators/
│   ├── prisma/               schema, migrations, seed.js
│   └── uploads/               complaints/ evidence/ judgments/ profile-images/
├── docker-compose.yml
└── .env.example
```

---

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (local install, or via Docker)
- Git (optional, for cloning)

---

## Setup — Option A: Docker (recommended)

This spins up PostgreSQL, the backend, and the frontend together.

```bash
# From the consumer-forum-portal folder
docker compose up -d postgres    # start just the database first
```

Then set up the backend against it (migrations/seed need to run once):

```bash
cd server
cp ../.env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
```

Then bring up everything:

```bash
cd ..
docker compose up -d
```

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:8080`
- Password-reset and verification links use `DOCKER_CLIENT_URL` (default `http://localhost:8080`); set it to the address used to open the Docker frontend if different.

---

## Setup — Option B: Manual (Node + PostgreSQL)

### 1. Database

Create a database named `consumer_forum_portal` in your local PostgreSQL
instance (via `psql`, pgAdmin, or any client).

### 2. Backend

```bash
cd server
cp ../.env.example .env
```

Edit `.env` and set `DATABASE_URL` to match your PostgreSQL credentials:

```
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/consumer_forum_portal?schema=public"
```

Then:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm test        # optional — runs the automated test suite
npm run dev
```

The API runs on `http://localhost:5000`.

### 3. Frontend

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Vite listens on port `5173` on all network interfaces and prints the available
LAN URL in this client terminal. Open the displayed `Network` URL on another
device connected to the same network. The IP address (for example,
`192.168.137.1`) depends on the active network adapter and may change; port
`5173` is fixed, and Vite will report an error rather than silently switching
ports if it is already occupied. Allow Node.js through the Windows firewall if
other devices cannot connect.

The app runs on `http://localhost:5173`.

---

## Default Seeded Accounts

All seeded accounts use the password **`Password@123`**.

| Role | Email |
|---|---|
| Administrator | admin@consumerforum.gov.in |
| Registrar | registrar@consumerforum.gov.in |
| Scrutiny clerk | scrutiny1@consumerforum.gov.in, scrutiny2@… |
| Court clerk | courtclerk1@consumerforum.gov.in … courtclerk3@… (Bench 1–3) |
| Judge | judge1@consumerforum.gov.in … judge3@… (Bench 1–3) |
| Consumer | consumer1@example.com (consumer1–consumer20) |

The seed also creates 10 complaint categories, priority rules, government
holidays, 100 sample complaints, 50 hearings, and 30 judgments.

---

## Environment Variables

See `.env.example` (root) and `client/.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Change these in production |
| `SMTP_*` | Optional — without SMTP configured, emails are logged instead of sent, so local development works without an email account |
| `RATE_LIMIT_MAX_REQUESTS` | API rate limit per IP per 15 minutes (default: 10,000); authentication endpoints remain limited to 100 attempts per 15 minutes |
| `VITE_API_BASE_URL` | Frontend's backend API base (client/.env) |

---

## API Overview

All endpoints are prefixed with `/api/v1`. Highlights:

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`
- `GET /auth/account-deletion-status`, `DELETE /auth/account` (consumer and opposite party; deletion is allowed only after every linked case is completed)
- `PATCH /auth/profile`
- `POST /complaints`, `GET /complaints/mine`, `GET /complaints/:id`
- `PATCH /complaints/:id/claim`, `/release`, `/verify`, `/defective`, `/reject` (scrutiny clerk)
- `PATCH /complaints/:id/resubmit` (consumer, after a defect), `/withdraw`
- `GET /complaints/allotment-queue`, `PATCH /complaints/:id/allot` (registrar — allot / re-allot)
- `POST /complaints/:id/recuse` (judge — back to the Registrar)
- `GET/POST /benches`, `PATCH/DELETE /benches/:id`, `POST/DELETE /benches/:id/judges|clerks` (admin), `GET /benches/workload`
- `GET /complaints/:id/receipt` (PDF download)
- `GET /complaints/judge-recommendations` (workload balancer)
- `GET /hearings/suggest`, `POST /hearings`, `PATCH /hearings/:id/reschedule`
- `PATCH /hearings/:id/adjourn`, `/complete`
- `POST /judgments/:complaintId`, `PATCH /judgments/:complaintId/close`
- `GET /notifications`, `PATCH /notifications/:id/read`
- `GET/POST /categories`, `/categories/priority-rules`
- `GET/POST /users` (admin), `DELETE /users/:id` (admin, hard delete)
- `GET /analytics/dashboard` (admin), `GET /audit-logs` (admin)
- `GET/POST /settings/holidays`, `GET/PATCH /settings/forum`
- `GET/POST /judge-leaves/mine` (judge self-service), `GET/POST /judge-leaves` (admin),
  `GET /judge-leaves/today` (availability panel), `DELETE /judge-leaves/:id`
- `POST /complaints/:id/feedback` (consumer, post-judgment only)
- `GET /reassignments`, `PATCH /reassignments/:id/approve`, `/reject` (clerk/admin)
- `POST /system/trigger-daily-digest` (admin — manually fire the judges' daily case digest)

---

## Recent Revisions

**Round 2 — workflow and business-rule features:**

- **Judge absence notifications & auto-reassignment**: when a judge marks leave, any hearings already scheduled in that window are automatically flagged; the system recommends a replacement judge/slot via the workload balancer + scheduling engine, notifies the affected clerk immediately, and the clerk must explicitly approve or reject the recommendation before anything changes. Approval reschedules the hearing, regenerates the notice PDF, and notifies both the new judge and the consumer.
- **Judge case-assignment notifications**: judges now get an in-app notification the moment a case or hearing is assigned/rescheduled to them, plus an automated daily digest (7 AM cron, or manually triggerable via `POST /system/trigger-daily-digest`) summarizing their hearings for the day.
- **Clerk hearing/calendar view** now shows the assigned judge's name and the case title alongside each scheduled hearing.
- **Court hours changed** to 10:30 AM–4:30 PM IST with a 1:30–2:30 PM lunch break, 15-minute sessions (20 slots/day) — configurable in Admin Settings, with a "Reset to Standard Schedule" convenience button.
- **Priority-based clerk routing**: new complaints are automatically routed to a specific clerk based on priority (LOW → first registered clerk, MEDIUM → second, HIGH → third), with a "My Queue vs All Complaints" toggle on the clerk's complaint list.
- **Evidence upload simplified**: no more Invoice/Warranty/Image/Document category selection — just upload the files.
- **Automatic court fee**: 5% of the claim amount, computed and displayed the moment the consumer enters the claim amount, shown on the complaint detail page and the PDF receipt.
- **Multiple opposite parties**: consumers can name more than one respondent when filing a complaint; all are shown on the complaint detail page.
- **Post-judgment feedback**: consumers can rate their experience (1–5 stars + comments) once a judgment has been uploaded — not before.

**Round 1 — see above sections** (judge leave tracking, PDF receipts/notices, complaint withdrawal, CSV export, hard user deletion, automated tests, dark-mode/photo-upload removal, code-splitting, configurable time slots).

Following a project review, the following changes were made:

**Added:** judge leave/unavailability tracking with hearing-conflict detection,
PDF complaint receipts and auto-generated hearing notices, complaint withdrawal,
CSV export on the analytics dashboard, permanent (hard) user deletion with
safety checks, and an automated test suite for the two most algorithmically
interesting engines.

**Removed:** dark mode (out of scope for a domain-focused submission), profile
photo upload (low value, extra attack surface), and manual hearing-notice
upload (superseded by auto-generation).

**Changed:** hearing time slots are now configurable via admin settings
instead of hardcoded; frontend routes are code-split by role to reduce initial
bundle size.

## Known Limitations

- The frontend's `AdminAnalytics` chunk (which bundles Chart.js) is still
  fairly large in isolation; further splitting per-chart-type would help if
  the analytics page becomes a bottleneck.
- Email delivery requires SMTP credentials in `.env`; without them, emails are
  logged to the console instead of sent (fine for local development/demo).
- File uploads (including generated PDFs) are stored on local disk
  (`server/uploads/`). For deployment to a host with an ephemeral filesystem
  (e.g. some PaaS free tiers), swap in an object storage service (S3,
  Cloudinary, etc.) inside `middleware/upload.js`.
- Hard-deleting a user is intentionally blocked once they have any complaints,
  evidence, hearings, or judgments on record — deactivation is the only path
  for accounts with history, to keep the audit trail intact.


---

## Case Flow: Scrutiny → Allotment → Bench

```
Consumer files ──> SUBMITTED ──claim──> UNDER_VERIFICATION ──accept──> PENDING_ALLOTMENT
 (shared queue)                              │  ├─ DEFECTIVE ──(consumer fixes, resubmits)──> SUBMITTED
                                             │  └─ REJECTED
                       Registrar / automatic least-loaded bench
                                             ▼
        JUDGE_ASSIGNED (benchId + judge set) ──> HEARING_SCHEDULED ──> HEARING_COMPLETED ──> CLOSED
        (court clerk of that bench schedules; the bench's judge hears and decides)
```

**Who sees what** (one rule set, in `server/services/scopeService.js`):

| Role | Sees |
|---|---|
| Consumer | own complaints |
| Scrutiny clerk | unclaimed intake queue + complaints they claimed |
| Court clerk | complaints allotted to their bench |
| Judge | complaints assigned to them |
| Registrar / Admin | everything |

**Multiple judges & clerks:** a *bench* = judge(s) + court clerk(s). Allotment picks the
least-loaded judge who is on an active bench and not on leave today. If nobody is available the
case waits in the Registrar's queue. A judge can *recuse* (conflict of interest) and the Registrar re-allots; re-allotting a
case that has a hearing cancels that hearing so the new bench can reschedule. Every move is recorded
in `case_allotments` and the case timeline.

**Migrating an existing database:** `npx prisma migrate deploy` converts each old judge-clerk pair into a bench
(judge + court clerk), turns all other clerks into scrutiny clerks, and back-fills `benchId` on existing complaints.
Complaints that were mid-way through the old Yes/No loop move to the Registrar's queue.


---

## Opposite-Party Portal & E-mail Updates

**Serving the notice.** When a case is first allotted to a bench, the system serves the notice on the opposite party
(using the e-mail the consumer entered when filing):

1. A portal account is created for that e-mail (or reused) and a *set your password* link is e-mailed (valid 14 days). Following the link sets the password and verifies the opposite party's email.
2. The **30-day reply clock** starts (`replyDueDate`). The notice is recorded on the case timeline.

If the consumer gave no opposite-party e-mail, the timeline says the notice could not be served online so the clerk can serve it by post.

**What the opposite party can do** (`/party/...`): read the complaint and the consumer's documents (not the consumer's contact
details), file a written reply with attachments, ask for more time (max **15 days in total**, the judge decides), offer a settlement
(the consumer accepts or rejects; accepting closes the case as `SETTLED` and cancels hearings), and see the case timeline from the day of service.
When a settlement is accepted, the opposite-party reply status is updated to **Case settled**. Hearing notice delivery tracking uses email only; SMS delivery is not used.

**Password recovery and account deletion.** Consumers and opposite parties can request a password reset from the login page. The one-time reset link is e-mailed to the account address; using it verifies the address and resets the password. A user can request account deletion from **My Profile** only when all linked cases are complete (`REJECTED`, `DISPOSED`, `CLOSED`, `WITHDRAWN`, or `SETTLED`). The server rechecks eligibility and the current password before closing the account. Login/profile information is removed, active sessions are revoked, and completed case records are retained in redacted form. Accounts with any open, pending, or otherwise incomplete case cannot be deleted.

**Reply deadline.** A background job reminds the party 7 days and 1 day before the deadline. If the deadline passes with no reply
the case becomes **EX_PARTE_ELIGIBLE**, the judge is notified, and both sides are e-mailed. A late reply can still be filed and is marked *late*.

**E-mail on every step.** Each entry written to the case timeline (filing, scrutiny, defect, acceptance, allotment, notice, reply,
extension, settlement, hearing scheduled / rescheduled / adjourned / completed, verdict, withdrawal) e-mails the people who should know:

| Event | Consumer | Opposite party |
|---|---|---|
| Before the notice is served | yes | no (they don't know of the case yet) |
| From the notice onward | yes | yes (plus any additional respondents who have an e-mail) |

Every attempt is stored in `email_logs`; **Admin → Email Log** shows sent / failed / skipped, and has a *Send test e-mail* button.

**Configure SMTP** in `server/.env` (never commit it):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=<16-character Google App Password, no spaces>
EMAIL_FROM="State Consumer Forum <your_email@gmail.com>"
CLIENT_URL=http://localhost:5173
```

Gmail needs 2-Step Verification and an *App password* (https://myaccount.google.com/apppasswords). Without SMTP settings the app still
works — e-mails are recorded as SKIPPED instead of sent. After editing `.env`, restart the server and use the *Send test e-mail* button.

**Migrating:** run `npx prisma migrate deploy` to apply all pending migrations, including the opposite-party portal and settled-reply status updates.



git add .
git commit -m "Updated project files"
git push