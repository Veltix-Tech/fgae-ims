# FGAE IMS frontend

React, strict TypeScript and Vite frontend for the Family Guidance Association of Ethiopia.

## Current review scope
**AUTH-01, Sign in (`/sign-in`)** is approved. **AUTH-02, Password recovery (`/forgot-password`)** is approved. **AUTH-03, Reset password (`/reset-password`)** is approved. **AUTH-04, First-login password change (`/first-login`)** is approved. **AUTH-05, Volunteer self-registration (`/register`)** is implemented for review. English and Amharic include form validation, service errors, account-state outcomes and an accessible expandable language selector. Language changes preserve typed values and persist across refresh. Self-hosted Noto Sans and Noto Sans Ethiopic fonts use the SIL Open Font License. Phosphor is the icon family. `public/brand/mark.svg` is a replaceable placeholder, not the organization's official logo.

Successful authentication stays on Sign in with an inline confirmation. Application status and dashboards await their own page approvals. Temporary-credential accounts can continue from Sign in to first-login password setup. Their navigation journeys are pending; there are no fake destination screens. URLs other than Sign in, Password recovery, Reset password, First-login password change and Volunteer registration resolve to Sign in without exposing protected content. No deployment has been performed.

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
Set `PLAYWRIGHT_CHANNEL=chromium` to use Playwright's installed Chromium, or `PLAYWRIGHT_EXECUTABLE_PATH` to use a specific local Chromium executable. On a busy machine, append `--workers=1 --timeout=180000` to the browser test command and set `PLAYWRIGHT_EXPECT_TIMEOUT=15000` when page readiness exceeds the default five-second assertion budget.

## Synthetic review accounts
Development only; do not enter real credentials in the synthetic review app. Every account below initially uses `Demo-only-2026!`; a completed synthetic reset replaces it for that account:

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

Synthetic sessions use versioned sessionStorage, expire after 15 minutes, survive refresh and are cleared by Sign out. Plaintext passwords are never stored; synthetic reset credentials use local salted verifiers. Invalid schema resets the synthetic session. Clearing site session storage resets this page's synthetic state. Offline behavior uses the browser's real connection status; loading and HTTP failures are tested through service doubles/network interception outside the workplace interface. No development switch is rendered in the application. Live bundles exclude fixtures and demo credentials.

## Architecture and integration
`src/features/auth` owns the current page; `src/app` the public layout; `src/components` shared primitives; `src/i18n` typed dictionaries; `src/services/contracts` stable models; `src/services/http` transport; `src/services/adapters` live DTO mapping; `src/mocks` synthetic service; `src/permissions` role/scope pairs. Components consume services rather than fixtures. Empty feature directories are plans only.

Role grants retain individual scopes. SYSTEM_ADMIN maps to Super Admin at the API boundary. Unknown roles have no grants. Pending applicants and first-login identities cannot acquire operational access. These checks are frontend behavior; backend authorization remains required.

Documented endpoint paths implemented by the live adapter: POST /auth/login, POST /auth/refresh, GET /auth/me. The DTOs remain proposed. POST /auth/logout is also proposed. Access tokens stay in memory; cookie credentials are included, refreshes are serialized and identity requests retry once after renewal. No running authentication backend has been verified; the repository backend currently exposes only a health scaffold. Cookie/CORS policy, DTO agreement, logout invalidation and real authentication require backend work.

Local `docs/` holds requirements, the ordered 87-page implementation plan, progress and integration handover, and remains ignored. Page approval, cross-page integration, backend readiness and fluent Amharic terminology review are separate milestones. Volunteer registration awaits explicit user approval; no later page is authorized by this implementation alone.

## Shared motion
`src/components/Button.tsx` provides immediate pointer/touch and centered keyboard ripple feedback. Use it for buttons on every future page. `src/styles/motion.css` provides reusable entrance/stagger/state transitions using centralized duration/easing tokens; current Sign in also includes hover/press/focus feedback. Nonessential motion and ripples are disabled with prefers-reduced-motion. Effects never delay service actions. The shared motion revision is approved and applies to each page as it is implemented.

## Password recovery review
Open http://127.0.0.1:5173/forgot-password or use Forgot your password? on Sign in. Submit any syntactically valid fictional email; every address receives the same generic result. In synthetic mode the request is recorded, **no email is sent**, and a synthetic delivery token is created for eligible fictional accounts. Confirmation survives refresh for 15 minutes. Resend is available after 60 seconds; changing the address retains the cooldown. Use browser offline mode to test recovery after failure. The service journal and confirmation use versioned sessionStorage and contain no reset tokens or passwords. Reload clears an unsubmitted email draft; language switching and recoverable failures preserve it.

The proposed live POST /auth/forgot-password contract requires backend implementation, non-enumerating response/timing, rate limits, idempotency, token delivery and email-provider integration. Live mode never falls back to synthetic recovery. Read local docs/INTEGRATION_HANDOVER.md for C-AUTH-05. Reset completion (/reset-password) is approved.


## Reset password review
Try http://127.0.0.1:5173/reset-password#token=demo-reset-volunteer for the fictional `volunteer@example.test` account. Use a different password of 12-128 characters, then sign in with it. That password persists locally across refresh; `Demo-only-2026!` stops working for the reset account. The link is single-use. Expired/used examples: `#token=demo-reset-expired` and `#token=demo-reset-used`. Opening `/reset-password` without a token shows instructions to reopen the email link. Tokens are consumed from the URL into memory; refreshing the form also requires reopening the original link.

For a new synthetic recovery request, developer tools can inspect `fgae.synthetic.credentials.v1` in localStorage and use its latest `links` token in `/reset-password#token=...`. No email is delivered and no developer controls appear in workplace UI. These are fictional development tokens only. To reset this synthetic credential state deliberately, remove that localStorage item and the corresponding synthetic session; this restores default demo credentials and review token fixtures. Do not use this against real user data.

Live validation and completion are proposed POST /auth/reset-password/validate and POST /auth/reset-password. Backend agreement, secure token handling, password policy enforcement and session revocation are required. Local docs/INTEGRATION_HANDOVER.md defines C-AUTH-06/07. Twelve-character minimum, fifteen-minute synthetic reset expiry and P03 handling after reset are proposed policies. Fluent Amharic terminology review remains pending. First-login password change is the current page review.

## First-login password change review
Open http://localhost:5173/sign-in and use `first.login@example.test` / `Demo-only-2026!`. Select **Set your password**, enter that temporary password, choose a different 12-128 character password and confirm it. After saving, sign in again with the new password. The temporary password no longer works and this account no longer requires setup. Keep the same hostname (`localhost` or `127.0.0.1`) throughout: browser storage is origin-specific.

The form at `/first-login` requires an authenticated temporary-credential session. Anonymous/expired sessions and accounts without a required change cannot use it. Wrong credentials, policy/network failures and language switches preserve entries in memory; refresh clears password drafts. Signing out with entries asks before discarding them. No new roles, scopes or account approval are granted by changing a password. Synthetic credentials persist through the existing local credential store; to repeat setup use a fresh fictional `first.{role-address}@example.test` account, e.g. `first.hr@example.test`, or deliberately reset the demo store as described above. Never enter real credentials in this preview.

The proposed authenticated POST `/auth/first-login/password` uses the shared bearer/cookie client, idempotency and one renewal retry. The backend must enforce P03 and perform atomic password replacement/session revocation; real integration has not been verified. Local docs/INTEGRATION_HANDOVER.md records C-AUTH-08, including replay after an uncertain completion. The page requires a new sign-in after success. Volunteer self-registration is the current page review.

## Volunteer self-registration review
Open http://localhost:5173/register or use **Register as a volunteer** on the signed-out Sign in form. Complete four steps: details, account, documents and review. Use fictional personal data, a new fictional email and a password of 12-128 characters. The demo requests one PDF/JPEG/PNG identity document up to 5 MiB; use a harmless test file. Required fields/documents and the two demo branches are proposed service configuration, not confirmed organizational policy.

Save draft explicitly to keep your details, current step and uploaded files in this browser. Passwords are excluded; re-enter them after reopening. Unsaved navigation asks before discarding changes. Concurrent draft edits show a conflict with a deliberate reload option. File upload supports progress, cancel, retry, preview, replacement and removal. Saved drafts and file blobs use the dedicated `fgae.synthetic.registration.v1` IndexedDB database. Removing a file from the form detaches its reference; separately uploaded blobs remain in the synthetic database until deliberately cleared. This allows pending application documents to remain available for the next page. Do not store real identity documents in this demo.

Submit creates a pending synthetic account/application and retains a confirmation receipt across refresh in the same tab. Sign in with the email and password you chose; the account remains pending with no operational role grants. Duplicate emails are rejected, identical retries are deduplicated and registration never approves an application. No email delivery is implemented. Registration does not automatically switch an existing signed-in account; sign out before testing a new applicant. Keep the same hostname throughout.

Live application submission uses the documented POST `/volunteers/applications`; configuration, draft and document endpoints/DTOs are proposed and need backend agreement. Real upload scanning/storage/ownership, secure password handling, cookie/CSRF protections, anti-abuse, account creation and review workflows require backend implementation. See local docs/INTEGRATION_HANDOVER.md for C-AUTH-09 through C-AUTH-12. The next page after approval is **My application status**; it has not been implemented.
