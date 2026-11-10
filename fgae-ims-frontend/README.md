# FGAE IMS frontend

React, strict TypeScript and Vite frontend for the Family Guidance Association of Ethiopia.

## Current review scope
**AUTH-01, Sign in (`/sign-in`)** is approved. **AUTH-02, Password recovery (`/forgot-password`)** is implemented for review. English and Amharic include form validation, service errors, account-state outcomes and an accessible expandable language selector. Language changes preserve typed values and persist across refresh. Self-hosted Noto Sans and Noto Sans Ethiopic fonts use the SIL Open Font License. Phosphor is the icon family. `public/brand/mark.svg` is a replaceable placeholder, not the organization's official logo.

Successful authentication stays on Sign in with an inline confirmation. Reset completion, registration, first-login password replacement, application status and dashboards await their own page approvals. Their navigation journeys are pending; there are no fake destination screens. URLs other than Sign in and Password recovery resolve to Sign in without exposing protected content. No deployment has been performed.

## Commands
Requires Node.js 22.12+ (verified with 22.20.0) and npm. From this frontend directory:

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run verify:live
```

`npm run dev` serves synthetic Sign in at http://127.0.0.1:5173/sign-in. `npm run dev:live` selects the live service. Copy `.env.example` to `.env.local` to set the public API origin. `npm run build` builds live assets; `npm run build:mock` explicitly builds a synthetic review version. `npm run preview` serves the most recent build. Build modes select one adapter through a Vite alias; a data-mode environment variable cannot silently override them. Live mode never falls back to synthetic data.

Browser tests use installed Microsoft Edge (Chromium), start mock/live servers on ports 5173/5174 and check both languages at 360, 390, 768, 1024 and 1440 px. Reports are written to ignored `playwright-report/`, traces to `test-results/`, screenshots to local ignored `docs/screenshots/`.

## Synthetic review accounts
Development only; do not enter real credentials in the synthetic review app. Every account below uses `Demo-only-2026!`:

| Role/state | Email |
|---|---|
| Super Admin | super.admin@example.test |
| HR | hr@example.test |
| Area Manager | area.manager@example.test |
| Branch Manager | branch.manager@example.test |
| Volunteer Manager | volunteer.manager@example.test |
| Field Supervisor | field.supervisor@example.test |
| Finance Officer | finance.officer@example.test |
| Volunteer | volunteer@example.test |
| Project Manager | project.manager@example.test |
| Member | member@example.test |
| Pending applicant | pending@example.test |
| Temporary credential | first.login@example.test |
| Volunteer and Member | multi.role@example.test |
| Inactive | inactive@example.test |

Synthetic sessions use versioned sessionStorage, expire after 15 minutes, survive refresh and are cleared by Sign out. Passwords are never stored. Invalid schema resets the synthetic session. Clearing site session storage resets this page's synthetic state. Offline behavior uses the browser's real connection status; loading and HTTP failures are tested through service doubles/network interception outside the workplace interface. No development switch is rendered in the application. Live bundles exclude fixtures and demo credentials.

## Architecture and integration
`src/features/auth` owns the current page; `src/app` the public layout; `src/components` shared primitives; `src/i18n` typed dictionaries; `src/services/contracts` stable models; `src/services/http` transport; `src/services/adapters` live DTO mapping; `src/mocks` synthetic service; `src/permissions` role/scope pairs. Components consume services rather than fixtures. Empty feature directories are plans only.

Role grants retain individual scopes. SYSTEM_ADMIN maps to Super Admin at the API boundary. Unknown roles have no grants. Pending applicants and first-login identities cannot acquire operational access. These checks are frontend behavior; backend authorization remains required.

Documented endpoint paths implemented by the live adapter: POST /auth/login, POST /auth/refresh, GET /auth/me. The DTOs remain proposed. POST /auth/logout is also proposed. Access tokens stay in memory; cookie credentials are included, refreshes are serialized and identity requests retry once after renewal. No running authentication backend has been verified; the repository backend currently exposes only a health scaffold. Cookie/CORS policy, DTO agreement, logout invalidation and real authentication require backend work.

Local `docs/` holds requirements, the ordered 87-page implementation plan, progress and integration handover, and remains ignored. Page approval, cross-page integration, backend readiness and fluent Amharic terminology review are separate milestones. Password recovery awaits explicit user approval; no later page is authorized by this implementation alone.

## Shared motion
`src/components/Button.tsx` provides immediate pointer/touch and centered keyboard ripple feedback. Use it for buttons on every future page. `src/styles/motion.css` provides reusable entrance/stagger/state transitions using centralized duration/easing tokens; current Sign in also includes hover/press/focus feedback. Nonessential motion and ripples are disabled with prefers-reduced-motion. Effects never delay service actions. The approved static Sign in design now has a motion revision awaiting user testing; no next-page implementation has started.

## Password recovery review
Open http://127.0.0.1:5173/forgot-password or use Forgot your password? on Sign in. Submit any syntactically valid fictional email; every address receives the same generic result. In synthetic mode the request is recorded, **no email is sent**, and reset completion is not implemented yet. Confirmation survives refresh for 15 minutes. Resend is available after 60 seconds; changing the address retains the cooldown. Use browser offline mode to test recovery after failure. The service journal and confirmation use versioned sessionStorage and contain no reset tokens or passwords. Reload clears an unsubmitted email draft; language switching and recoverable failures preserve it.

The proposed live POST /auth/forgot-password contract requires backend implementation, non-enumerating response/timing, rate limits, idempotency, token delivery and email-provider integration. Live mode never falls back to synthetic recovery. Read local docs/INTEGRATION_HANDOVER.md for C-AUTH-05. Reset completion (/reset-password) is the next separate page review.
