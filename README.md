# CloudConsole

A SaaS Cloud Platform Management Console inspired by IDCloudHost — Cloud VPS,
App Deployer (PaaS), Managed Databases, Billing/Wallet, and Resource
Management, built as a single Next.js 14 (App Router) application.

> **Status:** MVP scaffold. The cloud backend is a fully functional in-memory
> **mock provider** (no real cloud credentials needed to run and demo the
> whole product). Swap in a real adapter (OpenStack/Proxmox/AWS) later behind
> the same interface — see [Architecture](#architecture) below.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui-style components, Lucide icons |
| Data fetching | TanStack Query (React Query) |
| Backend | Next.js Route Handlers + Server Components (no separate API server) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js / Auth.js v5 (Credentials provider, JWT sessions, RBAC) |
| Cloud abstraction | Custom `CloudProviderAdapter` interface + `MockCloudProvider` |
| Payments | Custom `PaymentGatewayAdapter` interface + mock (Xendit-shaped) |

---

## Prerequisites

- Node.js **18.18+** (Node 20 LTS recommended)
- PostgreSQL 14+ running locally or accessible remotely
- npm (or pnpm/yarn — adjust commands accordingly)

---

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

```dotenv
# --- Database ---
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cloud_console?schema=public"

# --- Auth.js ---
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# --- Cloud Provider Adapter ---
CLOUD_PROVIDER="mock"   # no credentials needed for local dev/demo

# --- Payment Gateway ---
PAYMENT_GATEWAY="mock"  # no credentials needed for local dev/demo
```

Generate a secret for `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

> Real cloud/payment credentials (OpenStack, Proxmox, AWS, Xendit, Midtrans)
> are **not required** to run the app — the mock adapters make the entire
> product usable end-to-end. Fill in the commented-out variables in
> `.env.example` only when you're ready to wire up a real backend.

## 3. Set up the database

Create the Postgres database referenced in `DATABASE_URL`, then run
migrations:

```bash
npm run db:migrate
```

This creates all tables (users, instances, deployments, invoices,
transactions, ssh_keys, activity_logs, etc.) from `prisma/schema.prisma`.

Seed reference data (regions, instance plans, app blueprints) and two demo
accounts:

```bash
npm run db:seed
```

Seeded logins:

| Role  | Email                     | Password      |
|-------|---------------------------|---------------|
| Admin | admin@cloudconsole.dev    | Admin12345!   |
| User  | demo@cloudconsole.dev     | User12345!    |

## 4. Run the app

```bash
npm run dev
```

Visit **http://localhost:3000** — you'll be redirected to `/login`. Sign in
with one of the seeded accounts above, or register a new account.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (also runs `prisma generate`) |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run db:migrate` | Create/apply a new Prisma migration (dev) |
| `npm run db:migrate:deploy` | Apply pending migrations (production) |
| `npm run db:push` | Push schema changes without a migration (quick prototyping) |
| `npm run db:seed` | Seed regions, plans, blueprints, demo users |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Drop, recreate, migrate, and reseed the database |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode while developing |

---

## Architecture

### Cloud Provider Abstraction

Everything that talks to compute infrastructure goes through one interface:

```
src/lib/cloud/
├── CloudProviderAdapter.ts     # the contract (interface)
├── ProviderFactory.ts          # picks an implementation based on CLOUD_PROVIDER env
└── providers/
    └── MockCloudProvider.ts    # in-memory mock (default, no credentials needed)
```

To add a real provider (OpenStack, Proxmox, AWS EC2, DigitalOcean, ...):

1. Create `src/lib/cloud/providers/<Name>Provider.ts` implementing
   `CloudProviderAdapter`.
2. Register it in `ProviderFactory.ts`.
3. Set `CLOUD_PROVIDER=<name>` and the relevant credentials in `.env`.

No API route, page, or component needs to change — they all call
`getCloudProvider()` and use the interface methods
(`createInstance`, `startInstance`, `stopInstance`, `rebootInstance`,
`terminateInstance`, `getInstanceStatus`, `getInstanceMetrics`,
`getVncConsole`, `listImages`).

### Payment Gateway Abstraction

Same pattern, for billing:

```
src/lib/payment/PaymentGatewayAdapter.ts
```

The mock implementation mirrors Xendit's Invoice API request/response shape
(`createInvoice`, `verifyWebhookSignature`) so swapping in the real Xendit
or Midtrans SDK is a drop-in replacement. The real webhook target is
`POST /api/webhooks/payment`.

### Billing Model

Prepaid wallet, IDCloudHost-style:

- `User.balance` is the wallet balance (integer, smallest currency unit).
- `chargeWallet()` / `creditWallet()` in `src/lib/billing/calculator.ts`
  atomically update balance + write an auditable `Transaction` row.
- `calculateUsageCharge()` prorates hourly vs. monthly plans for metered
  billing (see `UsageRecord` in the schema for how usage snapshots would be
  billed by a scheduled job/cron in production).

### Auth & RBAC

- NextAuth.js v5 (`src/lib/auth.ts`) with a Credentials provider, JWT
  sessions, and a `role` field (`ADMIN` | `USER`) propagated onto the
  session/token.
- `src/middleware.ts` protects all non-public routes and gates `/admin/*`
  to `ADMIN` users only.
- ⚠️ Because sessions are JWTs (not database-backed), resetting a
  password via `/reset-password` invalidates the stored `passwordHash`
  immediately but does **not** invalidate any JWT session already issued
  elsewhere — a device that's still logged in stays logged in until that
  token naturally expires. If you need "reset password also signs out
  every other device," switch to database sessions (`session: { strategy:
  "database" }` + the Prisma adapter's session table, already wired up)
  so sessions can be revoked server-side.

### Project Structure

```
src/
├── app/
│   ├── (auth)/                 # login, register, forgot-password (public)
│   ├── (dashboard)/            # protected app shell (sidebar + header)
│   │   ├── dashboard/          # resource overview
│   │   ├── compute/            # Cloud VPS list, create wizard, detail/actions
│   │   ├── storage/            # placeholder module
│   │   ├── networking/         # placeholder module
│   │   ├── apps/               # App Deployer (PaaS blueprints)
│   │   ├── ssh-keys/
│   │   ├── billing/            # wallet, top-up, invoices, transactions
│   │   └── settings/
│   └── api/                    # route handlers (REST-style JSON API)
│       ├── auth/                (NextAuth handler, register, forgot-password)
│       ├── instances/           (CRUD + start/stop/reboot/terminate)
│       ├── regions/ plans/ images/
│       ├── ssh-keys/
│       ├── billing/             (topup, mock-pay)
│       ├── apps/deploy/
│       └── webhooks/payment/    (real gateway webhook target)
├── components/
│   ├── ui/                     # shadcn-style primitives
│   ├── layout/                 # Sidebar, Header
│   ├── dashboard/ compute/ billing/ apps/ auth/
├── hooks/                      # React Query hooks (useInstances, etc.)
├── lib/
│   ├── auth.ts  prisma.ts  utils.ts
│   ├── cloud/                  # provider abstraction (see above)
│   ├── billing/                # wallet + usage calculator
│   └── payment/                # gateway abstraction
├── providers/                  # QueryProvider
└── types/                      # shared TS types
```

---

## MVP Features Implemented

- **Auth & Dashboard** — login, register, full password reset flow
  (request → emailed-in-dev token → `/reset-password` completion page,
  with expiry/single-use/token-invalidation-on-reuse handling), resource
  overview (running instances, wallet balance, monthly spend, active
  deployments, recent activity).
- **Cloud VPS Management** — create-instance wizard (image, plan/specs,
  region, SSH key, hourly/monthly billing), instance actions (start, stop,
  reboot, terminate), a VNC console placeholder tab, and live status
  polling while an instance is transitioning state.
- **Billing & Wallet** — prepaid balance, top-up flow through a mock
  payment gateway (Xendit-shaped), transaction ledger, and an invoices
  list.
- **App Deployer (PaaS)** — one-click blueprints (WordPress, Node.js,
  Docker, PostgreSQL, MySQL, Redis) with a deployments list and live status.
- **Admin Panel** (`/admin`, RBAC-gated) — platform overview, user
  management (role, suspend/reactivate, manual balance adjustments),
  cross-user instance list with force-terminate, instance plan and region
  CRUD, global transactions/invoices with filters, growth analytics
  (signups and revenue charts), and a filterable/paginated audit log.

- **Hourly Usage Billing** — real elapsed-time metering per instance,
  auto-charges the prepaid wallet, auto-stops instances when balance is
  exhausted, low-balance warnings, runnable via crontab, a secured HTTP
  endpoint, or a manual admin trigger. See
  [Hourly Usage Billing](#hourly-usage-billing).
- **Tests** — Vitest suite for the billing calculator's money-moving
  functions, including a regression test for the double-credit
  vulnerability that was fixed in `confirmTopUp`. See
  [Testing](#testing).

## Not Yet Implemented (natural next steps)

- Additional real cloud provider adapters (OpenStack/Proxmox/AWS) behind
  the existing interface — IDCloudHost's Cloud VPS API is implemented (see
  [Using the Real IDCloudHost Cloud VPS Provider](#using-the-real-idcloudhost-cloud-vps-provider)),
  but hasn't been verified against a live account.
- Wire the Storage and Networking placeholder pages up to IDCloudHost's
  **Block Storage** (`/v1/storage/disks`) and **Floating IP** /
  **Firewall** (`/v1/network/...`) APIs — both are documented and already
  location-scoped the same way VMs are, so they'd follow the same adapter
  pattern as Compute.
- **Verify and finish the doit.id payment gateway adapter.** A scaffold
  exists (`src/lib/payment/providers/DoitPaymentGateway.ts`,
  `PAYMENT_GATEWAY=doit`), but it was built without access to doit.id's
  full API docs (they didn't surface via web search the way IDCloudHost's
  did), so the `POST /v1/payments` request/response field names and the
  webhook payload/signature scheme are **unverified best-effort
  placeholders** — see the file's header comment for exactly what to check
  against your own account's docs before using it for a real payment. See
  [Using the doit.id Payment Gateway](#using-the-doitid-payment-gateway).
- Actually sending the password reset email — the request → token →
  reset-password page flow is fully implemented, but delivery is stubbed
  (the link is logged to the server console in dev instead of emailed —
  wire up a real provider such as Resend/SES; see
  [MVP Features Implemented](#mvp-features-implemented)).
- Real-time updates via WebSockets instead of polling for instance status.
- CSV export for the admin Billing and Activity tables.
- Broader test coverage — `usageBillingJob.ts` moves money the same way
  `calculator.ts` does but isn't covered yet, and there's no integration
  test against a real Postgres instance for either (see
  [Testing](#testing) for what the current suite does and doesn't prove).

---

## Notes on the Mock Backends

- `MockCloudProvider` stores instance state **in-process memory** — it
  resets on server restart. This is intentional for local development/demo
  purposes. It simulates provisioning taking a few seconds and transitions
  instances through realistic states (`PROVISIONING` → `RUNNING`, etc.).
- The mock payment flow skips the "redirect to hosted checkout, wait for
  webhook" round trip for convenience — `/billing/mock-checkout` and
  `/api/billing/mock-pay` immediately confirm payment client-side. The real
  webhook handler (`/api/webhooks/payment`) is scaffolded separately and is
  what a production Xendit/Midtrans integration would call.
- Both confirmation paths go through `confirmTopUp()` in
  `src/lib/billing/calculator.ts`, which only ever credits the amount
  recorded when the top-up was originally requested (never anything a
  client sends at confirmation time) and atomically claims the underlying
  `PENDING` transaction exactly once — so a duplicated webhook delivery or
  a double-tapped "Pay" button is always a safe no-op, never a double
  credit. There's also a unique constraint on `Transaction.gatewayRef` as
  defense-in-depth.

---

## Using the Real IDCloudHost Cloud VPS Provider

`src/lib/cloud/providers/IDCloudHostProvider.ts` implements
`CloudProviderAdapter` against IDCloudHost's public API
(`https://api.idcloudhost.com`), built from their published API reference.

### Setup

1. Get an API token from **app.idcloudhost.com** (API tokens can optionally
   be restricted to a single billing account).
2. Set in `.env`:

   ```dotenv
   CLOUD_PROVIDER="idcloudhost"
   IDCLOUDHOST_API_KEY="<your token>"
   # IDCLOUDHOST_LOCATION="jkt01"              # omit for account default
   # IDCLOUDHOST_BILLING_ACCOUNT_ID="..."      # only if token isn't restricted
   # IDCLOUDHOST_DESIGNATED_POOL_UUID="..."    # omit to auto-detect
   # IDCLOUDHOST_NETWORK_UUID="..."            # omit to use default network
   ```

3. **Update your Regions** in Admin > Regions to use IDCloudHost's actual
   location slugs (`jkt01`, `jkt02`, `jkt03`, `sgp01`, ...) as the `code`
   field — the mock provider's seeded regions use placeholder codes that
   don't correspond to anything on IDCloudHost's side.

### ⚠️ Verify before production use

This adapter was written directly from IDCloudHost's API documentation —
**it has not been exercised against a live account** in this environment
(no credentials were available to test with). Before relying on it:

- Create one real VM through it in a throwaway/dev billing account and
  confirm the response shapes match — especially the exact `status` string
  values IDCloudHost returns (`running`/`stopped` are documented; any
  transitional "installing"/"building" state is not, and is currently
  mapped defensively to `PROVISIONING`).
- Confirm `IMAGE_SLUG_MAP` in the adapter still matches the OS versions
  IDCloudHost currently publishes — check
  `GET /v1/config/vm_images/plain_os` for your account, since available
  versions change over time.

### Known gaps in IDCloudHost's public API (as documented)

- **No live resource metrics** (CPU/RAM/disk usage %) — `getInstanceMetrics()`
  throws `UnsupportedByProviderError`. The Compute UI doesn't currently call
  this method, so nothing breaks, but don't wire up a live-metrics widget
  against this provider without first checking whether IDCloudHost has
  added a metrics endpoint since this was written.
- **No VNC/console API** — `getVncConsole()` throws
  `UnsupportedByProviderError`. Point people at the IDCloudHost web console
  (console.idcloudhost.com) for console access instead.
- **No native reboot endpoint** — `rebootInstance()` is implemented as
  stop-then-start, which is not atomic (a status check mid-sequence will
  briefly show `STOPPED`) and is slower than a true in-place reboot.
- **A root password is always required**, even for SSH-key-based access —
  IDCloudHost's `Create VM` call requires `username`/`password` regardless
  of whether `public_key` is also supplied. This adapter auto-generates a
  strong random password on every create and returns it once via
  `ProvisionInstanceResult.metadata.initialPassword` — the create-instance
  API route surfaces it once in the response (`oneTimeCredentials`) and the
  wizard shows it in a toast. **It is never written to the database in
  plaintext** — if you need to retrieve it later, use IDCloudHost's own
  "Change Password" API/console instead of expecting this app to remember it.

## Testing

There's a Vitest suite for `src/lib/billing/calculator.ts` — the code
handling money movement (`chargeWallet`, `creditWallet`, `confirmTopUp`)
and the usage-pricing math (`calculateUsageCharge`, `estimateMonthlyCost`).
This is the highest-value place to have tests in this codebase: it's where
a bug most directly costs someone real money.

```bash
npm test          # run once
npm run test:watch  # watch mode while developing
```

### Scope and an honest limitation

The wallet-mutating functions are tested against a small **in-memory mock**
of the Prisma client (`vi.mock("@/lib/prisma", ...)` at the top of
`calculator.test.ts`) rather than a real PostgreSQL database. That's a
deliberate trade-off, not an oversight:

- It keeps the suite fast and dependency-free — no test database to
  provision, migrate, or seed in CI or on a fresh clone.
- It's enough to genuinely exercise the logic that matters: balance
  arithmetic, the insufficient-balance guard in `chargeWallet`, and —
  most importantly — `confirmTopUp`'s exactly-once claim semantics. One
  test fires two concurrent `confirmTopUp` calls at the same transaction
  (simulating a duplicated payment webhook or a double-tapped "Pay"
  button) and asserts the wallet is only ever credited once. That's a
  direct regression test for the double-credit bug fixed earlier.

What it does **not** cover: real Postgres transaction isolation or actual
row-level locking under genuinely concurrent database connections. The
concurrency test passes because the mock's mutating step happens to run as
a single synchronous block with no `await` in the middle of it — which
mirrors what a real `UPDATE ... WHERE status = 'PENDING'` guarantees
atomically in Postgres, but doesn't *prove* the real database provides
that guarantee. Treat this suite as a solid unit-testing layer; a true
integration test against a real Postgres instance (e.g. via
[Testcontainers](https://testcontainers.com/)) would be the natural next
step for full end-to-end confidence, and is a good candidate to extend
this same approach to `src/lib/billing/usageBillingJob.ts`, which touches
the database the same way but isn't covered yet.

---

## Using the doit.id Payment Gateway

`src/lib/payment/providers/DoitPaymentGateway.ts` implements
`PaymentGatewayAdapter` for [doit.id](https://doit.id) — a payment gateway
from the IDCloudHost team (VA, QRIS, bank transfer).

### ⚠️ Read this before using it for a real payment

This adapter is built from less certainty than the IDCloudHost Cloud VPS
one. IDCloudHost's Cloud VPS API docs are public and search-indexed, so
that adapter could be written directly from them. doit.id's full API
reference at `doit.id/docs/` did **not** surface through web search in
this session, so this file is built only from their public marketing
homepage (which confirms `POST /v1/payments`, Bearer auth, and a
webhook-on-paid model) plus the webhook signing secret format you were
issued — the exact request/response field names, the webhook payload
shape, and the signature verification scheme are **best-effort,
unverified placeholders**.

**Before going live, using your own account's docs (you're logged in;
whoever finishes this integration should check them directly), confirm
and correct:**

1. The exact JSON field names `POST /v1/payments` expects — this file
   guesses `amount`, `reference`, `description`, `payer_email`,
   `success_redirect_url`, `failure_redirect_url`.
2. The exact response shape — guessed as `id`, `payment_url` or
   `qr_content`, `status`, `expires_at`.
3. The exact webhook payload shape and field names —
   `parseWebhookPayload` guesses `reference`/`external_id` and `status`.
4. **Which header carries the webhook signature**, and **the exact
   algorithm** used to compute it. `verifyWebhookSignature` currently
   implements a conventional HMAC-SHA256-over-the-raw-body check using
   your `whs_...` secret — this is a reasonable, common pattern, but it is
   not confirmed to be what doit.id actually does. Trigger a real test
   webhook from your sandbox dashboard, log the incoming headers and raw
   body, and adjust the header name (`PAYMENT_WEBHOOK_SIGNATURE_HEADER`
   env var) and the algorithm in the adapter to match.

A wrong assumption in (1)–(3) mostly just breaks things visibly (a failed
API call, a webhook that doesn't get parsed). A wrong assumption in (4) is
the dangerous one — it could either reject every legitimate webhook
(safe but broken) or, in the worst case, be checking something that isn't
actually a valid proof the request came from doit.id. Don't flip
`PAYMENT_GATEWAY=doit` on in production until (4) specifically is
confirmed.

### Setup once verified

```dotenv
PAYMENT_GATEWAY="doit"
DOIT_API_KEY="pb_test_..."       # from the doit.id dashboard; use pb_live_... in production
DOIT_WEBHOOK_SECRET="whs_..."    # keep this only in your local/deployment .env — never commit it
PAYMENT_WEBHOOK_SIGNATURE_HEADER="x-callback-token"  # adjust to whatever doit.id actually sends
```

Point doit.id's webhook configuration at `POST /api/webhooks/payment` on
your deployed app (same endpoint used by every gateway — see
[Hourly Usage Billing](#hourly-usage-billing) for the general webhook
idempotency guarantees that apply regardless of which gateway is active).

### Compatibility mode alternative

doit.id also advertises Xendit Invoice API and Duitku compatibility
modes — if their real field names turn out to closely match Xendit's,
it may end up being less work to point the *existing* `MockPaymentGateway`
request/response shape at doit.id's compatibility-mode base URL than to
finish verifying this native adapter. Worth checking both options once
you have the real docs in front of you.

---

## Hourly Usage Billing

The prepaid wallet model only works end-to-end once something actually
meters running instances and charges for elapsed time — that's what this
does.

### How it works

- Every `Instance` has a `lastBilledAt` anchor. It's set to "now" whenever
  the instance starts running (creation, or a **Start** action) and never
  touched while the instance is stopped.
- Billing is based on **real elapsed wall-clock time** since that anchor,
  not a fixed hourly bucket — so it's safe to run the job every hour, every
  15 minutes, or irregularly; a delayed run just bills a larger span next
  time instead of under- or double-charging.
- A **Stop** or **Terminate** action bills the exact usage up to that
  moment first, so you're never charged for time after you stopped an
  instance, nor let a partial hour go unbilled.
- If a user's balance can't cover the full charge, whatever balance
  remains is charged (draining it to zero) and the instance is
  **automatically stopped** via the cloud provider — no overdraft, matching
  how IDCloudHost's own prepaid billing behaves.
- A one-time "low balance" activity-log warning fires when a charge causes
  the balance to cross below `LOW_BALANCE_WARNING_THRESHOLD` (default
  50,000 IDR) — once per crossing, not on every subsequent hourly charge.
- All of this reuses existing plumbing: charges show up as normal
  `Transaction` rows (visible in Billing and Admin > Billing) and
  `ActivityLog` entries (visible in Admin > Activity) — no new UI needed.

Core logic lives in `src/lib/billing/usageBillingJob.ts`
(`billInstanceUsage` for one instance, `runHourlyBillingCycle` for all
running instances) so it can be called from a script, an HTTP endpoint, or
tests without duplicating logic.

### Running it — pick one

**Option A — system crontab on your VPS (recommended for this app's
deployment target):**

```bash
# crontab -e
0 * * * * cd /path/to/cloud-console && /usr/bin/npm run billing:run >> /var/log/cloud-console-billing.log 2>&1
```

This runs `scripts/run-billing-cycle.ts` directly against the database —
no HTTP endpoint exposed, nothing to secure beyond normal server access.

**Option B — HTTP endpoint for hosted/serverless cron:**

If local cron isn't available in your deployment, use the secured
endpoint instead:

```bash
curl -X POST "https://your-app.com/api/cron/billing" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in `.env` to a random value
(`openssl rand -base64 32`) — the endpoint rejects every request without a
matching secret, since it moves money. Point a scheduler at it: a GitHub
Actions scheduled workflow, a service like cron-job.org, or Vercel Cron
(`vercel.json`) if you ever deploy there.

**Option C — manual trigger for testing/demo:**

Admin > Overview has a **"Run Billing Cycle Now"** button
(`POST /api/admin/billing/run-cycle`, admin-only) that runs the exact same
job on demand — useful for seeing the billing flow work without waiting
for a real schedule, or as a manual catch-up if the scheduled job was down.

### ⚠️ Not yet handled

- **Monthly-cycle instances** are billed the same hourly-prorated way as
  hourly ones (see `calculateUsageCharge` in
  `src/lib/billing/calculator.ts`) rather than a single charge at the start
  of the billing period. Fine for a prepaid model, but if you want
  "monthly" to mean "charge once, run for 30 days regardless of hourly
  balance dips," that needs different logic.
- **No retry/backoff** if `provider.stopInstance()` fails during an
  auto-stop — it logs and moves on, leaving the instance marked `STOPPED`
  in our database even if the underlying VM might still be running on the
  provider's side. Worth reconciling via the same status-sync mechanism
  used elsewhere (`reconcileInstanceStatus`) on the next poll, but isn't
  automatic today.
- **No email/notification** when a balance warning fires or an instance is
  auto-stopped — it's an `ActivityLog` entry only. Wire it into whatever
  notification system you build (see the in-app notification bell, which
  is currently decorative).

## Deploying the Database on IDCloudHost

This app's data layer (Prisma + PostgreSQL) works as-is against
**IDCloudHost's Managed Database PostgreSQL** service. Two ways to get a
Postgres instance there:

### Option A — Managed Database PostgreSQL (recommended)

1. Log in at **console.idcloudhost.com** and top up your account balance —
   Managed Database billing is prepaid, deducted hourly/monthly like the
   Cloud VPS product.
2. Provision a Managed PostgreSQL instance. Pick a package sized to your
   stage — the entry tiers (1 vCPU / 1GB RAM / 20–30GB storage) are enough
   for development and early production; scale CPU/RAM/storage up later
   without re-provisioning.
3. From the instance's detail page, copy the **host, port, database name,
   username, and password**.
4. Build your connection string:

   ```dotenv
   DATABASE_URL="postgresql://<db_user>:<db_password>@<db_host>:<db_port>/<db_name>?schema=public&sslmode=require"
   ```

   > Managed instances commonly require SSL for external connections. If
   > you get an SSL-related connection error, double-check the exact
   > `sslmode` value IDCloudHost expects for your instance in the console
   > (some setups use `sslmode=require`, others provide a CA bundle for
   > `verify-full`) — this can vary by package/region, so confirm it there
   > rather than assuming.

5. **Whitelist your application's outbound IP** in the Managed Database's
   firewall/access-control settings if the console exposes one — managed
   Postgres services typically restrict connections to an allow-list rather
   than accepting from anywhere.
6. Run migrations and seed against the managed instance from wherever your
   app is deployed (or temporarily from your machine, pointed at the
   managed `DATABASE_URL`):

   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```

   Use `db:migrate:deploy` (not `db:migrate`) against a shared/production
   database — it applies existing migrations without prompting to create
   new ones interactively.

7. IDCloudHost's Managed Database includes **automated daily backups** —
   still worth scheduling your own periodic `pg_dump` if you need
   point-in-time recovery finer than their backup cadence, or an
   off-provider copy for disaster recovery.

### Option B — Self-hosted PostgreSQL on an IDCloudHost Cloud VPS

If you'd rather run Postgres yourself alongside (or instead of) a managed
instance — e.g. to co-locate it with a self-hosted app server — provision a
Cloud VPS and install PostgreSQL directly (IDCloudHost has a guide for this
under their Panduan/Knowledge Base for Ubuntu). You lose automated backups
and managed scaling in exchange for full control; only worth it if you have
a specific reason to self-manage.

### Connection pooling in production

Next.js can open many short-lived database connections under concurrent
request load (more so if you ever deploy API routes to a serverless
target). If you notice connection exhaustion against the managed instance:

- Put **PgBouncer** in front of it (self-hosted, e.g. on the same VPS as
  the app), or
- Use **Prisma Accelerate** for a managed connection pool without running
  your own PgBouncer.

If you're deploying the whole app as a single long-running Node process on
one Cloud VPS (the straightforward path here), this is less urgent —
Prisma's own connection pool per process is usually enough — but it becomes
important the moment you run multiple app instances/processes against the
same database.

