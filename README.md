# AyurVaidya Inventory ERP

Inventory management for the All India Institute of Ayurveda (AIIA), Faridabad campus. Tracks CAPEX assets, OPEX consumables, goods receipt (GRN), stock issues, department demand requests, AMC contracts, alerts, and role-based access.

## Stack

- Next.js 16 (App Router, Turbopack, Proxy) with React 19
- PostgreSQL with Prisma 7
- Tailwind CSS 4
- Password auth with Node `scrypt` and opaque database-backed sessions

## Roles

| Role | Code | Access |
| --- | --- | --- |
| Super Admin | `super_admin` | Everything, including user management and demand oversight |
| Admin | `admin` | Operations: catalog, GRN, issues, reports, demand review and fulfilment — no user management |
| Procurement Officer | `procurement_officer` | Catalog, GRN, QR codes, reports, demand fulfilment — no stock issue |
| HOD | `hod` | Read-only catalog; dashboard, issue history, consumption and wastage limited to own department; authorises own department's issues and reviews its demand requests; no GRN |
| Requester | `requester` | Dashboard counts plus demand requests; no inventory operations |

Only Super Admins can create, edit, deactivate, or reset passwords for accounts from **User Management** in the sidebar. Every account management action is written to the audit log.

## Demand requests

Users raise multi-line requests against the item catalog from **Demand Requests** in the sidebar. A request moves through `pending → approved → fulfilled`, or can be `rejected` / `cancelled`.

- Requesters and HODs can raise requests; an assigned department is locked automatically, while an unassigned requester selects one.
- HODs review requests for their own department and cannot review their own request. Admins and Super Admins can review any request.
- Procurement Officers, Admins and Super Admins mark approved requests as fulfilled.
- Requesters see only their own requests, HODs see their department, and procurement/admin roles see all. Every transition is audited.

## Prerequisites

- Node.js 20+ (24 recommended)
- PostgreSQL 15+

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` with your database connection:

   ```env
   DATABASE_URL="postgresql://postgres:<password>@localhost:5432/ayurvaidya?schema=public"
   ```

3. Apply migrations:

   ```bash
   npx prisma migrate deploy
   ```

4. Seed departments (12 clinical and support departments):

   ```bash
   npm run seed
   ```

5. Create the first Super Admin. Credentials come from one-shot environment variables and are never stored in the repo:

   ```bash
   BOOTSTRAP_SUPERADMIN_USERNAME=admin \
   BOOTSTRAP_SUPERADMIN_PASSWORD='<strong-password>' \
   BOOTSTRAP_SUPERADMIN_FULL_NAME='Super Admin' \
   BOOTSTRAP_SUPERADMIN_EMPLOYEE_ID=SA-0001 \
   npm run bootstrap:superadmin
   ```

   Optional: `BOOTSTRAP_SUPERADMIN_EMAIL`. The script is idempotent — re-running with an existing Super Admin username makes no changes. Password rules: 8–128 characters after NFKC normalization.

6. Optional sample data (requires an active Super Admin from step 5):

   ```bash
   npm run seed:dashboard
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000); unauthenticated requests are redirected to `/login`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Prisma generate + production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run bootstrap:superadmin` | Create the first Super Admin (idempotent) |
| `npm run seed` / `npm run seed:departments` | Seed departments |
| `npm run seed:dashboard` | Seed sample items, supplier, AMC, and alerts |
| `npm run seed:roles` | Seed test users for each system role |

## Auth notes

- Sessions are random 32-byte tokens; only a SHA-256 hash is stored in `sessions`.
- Session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, with a 12-hour expiry.
- Login is rate limited; failed attempts are audited.
- Password resets and deactivation revoke all of the user's sessions.
- The Proxy (`src/proxy.ts`) only performs optimistic redirects. Every API route and server page checks the session and role again before returning data.
- All protected API responses are sent with `Cache-Control: private, no-store`, and mutations require a same-origin request.

## First sign-in

Sign in with the bootstrap account, then use the account menu (bottom of the sidebar) to change the password. Create additional accounts from **User Management**.
