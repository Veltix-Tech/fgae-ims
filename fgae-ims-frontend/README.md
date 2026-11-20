# FGAE IMS frontend

React, strict TypeScript and Vite frontend for the Family Guidance Association of Ethiopia.

## Current review scope
**AUTH-01, Sign in (`/sign-in`)** is approved. **AUTH-02, Password recovery (`/forgot-password`)** is approved. **AUTH-03, Reset password (`/reset-password`)** is approved. **AUTH-04, First-login password change (`/first-login`)** is approved. **AUTH-05, Volunteer self-registration (`/register`)** is approved. **APP-01, My application (`/my-application`)** is approved. **APP-02, Correct returned application (`/my-application/edit`)** is approved. **ACCOUNT-01, Account settings (`/account`)** and **HOME-01, Super Admin overview (`/workspaces/super-admin`)** are approved. **HOME-02, HR overview (`/workspaces/hr`)** is approved. **HOME-03/04/05, Area Manager, Branch Manager and Volunteer Manager overviews** are approved at `/workspaces/area-manager`, `/workspaces/branch-manager` and `/workspaces/volunteer-manager`. Reviews now cover three pages per batch, preserving all per-page requirements. English and Amharic include form validation, service errors, account-state outcomes and an accessible expandable language selector. Language changes preserve typed values and persist across refresh. Self-hosted Noto Sans and Noto Sans Ethiopic fonts use the SIL Open Font License. Phosphor is the icon family. `public/brand/mark.svg` is a replaceable placeholder, not the organization's official logo.

Successful authentication stays on Sign in with an inline confirmation. Applicants and self-scoped volunteers can continue to My application. Authorized users can open the Super Admin, HR, Area Manager, Branch Manager, Volunteer Manager, Field Supervisor, Finance Officer or Volunteer overview. Project Manager and Member dashboards remain planned. Temporary-credential accounts can continue from Sign in to first-login password setup. Their navigation journeys are pending; there are no fake destination screens. URLs other than Sign in, Password recovery, Reset password, First-login password change, Volunteer registration, My application, Correct returned application, Account settings, Super Admin, HR, manager and participant overviews resolve to Sign in without exposing protected content. No deployment has been performed.

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
| Returned applicant | returned@example.test |
| Temporary credential | first.login@example.test |
| Volunteer and Member | multi.role@example.test |
| Inactive | inactive@example.test |

Synthetic sessions use versioned sessionStorage, expire after 15 minutes, survive refresh and are cleared by Sign out. Plaintext passwords are never stored; synthetic reset credentials use local salted verifiers. Invalid schema resets the synthetic session. Clearing site session storage resets this page's synthetic state. Offline behavior uses the browser's real connection status; loading and HTTP failures are tested through service doubles/network interception outside the workplace interface. No development switch is rendered in the application. Live bundles exclude fixtures and demo credentials.

## Architecture and integration
`src/features/auth` owns the current page; `src/app` the public layout; `src/components` shared primitives; `src/i18n` typed dictionaries; `src/services/contracts` stable models; `src/services/http` transport; `src/services/adapters` live DTO mapping; `src/mocks` synthetic service; `src/permissions` role/scope pairs. Components consume services rather than fixtures. Empty feature directories are plans only.

Role grants retain individual scopes. SYSTEM_ADMIN maps to Super Admin at the API boundary. Unknown roles have no grants. Pending applicants and first-login identities cannot acquire operational access. These checks are frontend behavior; backend authorization remains required.

Documented endpoint paths implemented by the live adapter: POST /auth/login, POST /auth/refresh, GET /auth/me. The DTOs remain proposed. POST /auth/logout is also proposed. Access tokens stay in memory; cookie credentials are included, refreshes are serialized and identity requests retry once after renewal. No running authentication backend has been verified; the repository backend currently exposes only a health scaffold. Cookie/CORS policy, DTO agreement, logout invalidation and real authentication require backend work.

Local `docs/` holds requirements, the ordered 87-page implementation plan, progress and integration handover, and remains ignored. Page approval, cross-page integration, backend readiness and fluent Amharic terminology review are separate milestones. Account settings is approved and pushed. The Super Admin overview is approved. The HR overview is the current review page; remaining role dashboards remain planned.

## Shared motion
`src/components/Button.tsx` provides immediate pointer/touch and centered keyboard ripple feedback. Use it for buttons on every future page. `src/styles/motion.css` provides reusable entrance/stagger/state transitions using centralized duration/easing tokens; current Sign in also includes hover/press/focus feedback. Nonessential motion and ripples are disabled with prefers-reduced-motion. Effects never delay service actions. The shared motion revision is approved and applies to each page as it is implemented.

## Password recovery review
Open http://127.0.0.1:5173/forgot-password or use Forgot your password? on Sign in. Submit any syntactically valid fictional email; every address receives the same generic result. In synthetic mode the request is recorded, **no email is sent**, and a synthetic delivery token is created for eligible fictional accounts. Confirmation survives refresh for 15 minutes. Resend is available after 60 seconds; changing the address retains the cooldown. Use browser offline mode to test recovery after failure. The service journal and confirmation use versioned sessionStorage and contain no reset tokens or passwords. Reload clears an unsubmitted email draft; language switching and recoverable failures preserve it.

The proposed live POST /auth/forgot-password contract requires backend implementation, non-enumerating response/timing, rate limits, idempotency, token delivery and email-provider integration. Live mode never falls back to synthetic recovery. Read local docs/INTEGRATION_HANDOVER.md for C-AUTH-05. Reset completion (/reset-password) is approved.


## Reset password review
Try http://127.0.0.1:5173/reset-password#token=demo-reset-volunteer for the fictional `volunteer@example.test` account. Use a different password of 12-128 characters, then sign in with it. That password persists locally across refresh; `Demo-only-2026!` stops working for the reset account. The link is single-use. Expired/used examples: `#token=demo-reset-expired` and `#token=demo-reset-used`. Opening `/reset-password` without a token shows instructions to reopen the email link. Tokens are consumed from the URL into memory; refreshing the form also requires reopening the original link.

For a new synthetic recovery request, developer tools can inspect `fgae.synthetic.credentials.v1` in localStorage and use its latest `links` token in `/reset-password#token=...`. No email is delivered and no developer controls appear in workplace UI. These are fictional development tokens only. To reset this synthetic credential state deliberately, remove that localStorage item and the corresponding synthetic session; this restores default demo credentials and review token fixtures. Do not use this against real user data.

Live validation and completion are proposed POST /auth/reset-password/validate and POST /auth/reset-password. Backend agreement, secure token handling, password policy enforcement and session revocation are required. Local docs/INTEGRATION_HANDOVER.md defines C-AUTH-06/07. Twelve-character minimum, fifteen-minute synthetic reset expiry and P03 handling after reset are proposed policies. Fluent Amharic terminology review remains pending. First-login password change is approved.

## First-login password change review
Open http://localhost:5173/sign-in and use `first.login@example.test` / `Demo-only-2026!`. Select **Set your password**, enter that temporary password, choose a different 12-128 character password and confirm it. After saving, sign in again with the new password. The temporary password no longer works and this account no longer requires setup. Keep the same hostname (`localhost` or `127.0.0.1`) throughout: browser storage is origin-specific.

The form at `/first-login` requires an authenticated temporary-credential session. Anonymous/expired sessions and accounts without a required change cannot use it. Wrong credentials, policy/network failures and language switches preserve entries in memory; refresh clears password drafts. Signing out with entries asks before discarding them. No new roles, scopes or account approval are granted by changing a password. Synthetic credentials persist through the existing local credential store; to repeat setup use a fresh fictional `first.{role-address}@example.test` account, e.g. `first.hr@example.test`, or deliberately reset the demo store as described above. Never enter real credentials in this preview.

The proposed authenticated POST `/auth/first-login/password` uses the shared bearer/cookie client, idempotency and one renewal retry. The backend must enforce P03 and perform atomic password replacement/session revocation; real integration has not been verified. Local docs/INTEGRATION_HANDOVER.md records C-AUTH-08, including replay after an uncertain completion. The page requires a new sign-in after success. Volunteer self-registration is approved.

## Volunteer self-registration review
Open http://localhost:5173/register or use **Register as a volunteer** on the signed-out Sign in form. Complete four steps: details, account, documents and review. Use fictional personal data, a new fictional email and a password of 12-128 characters. The demo requests one PDF/JPEG/PNG identity document up to 5 MiB; use a harmless test file. Required fields/documents and the two demo branches are proposed service configuration, not confirmed organizational policy.

Save draft explicitly to keep your details, current step and uploaded files in this browser. Passwords are excluded; re-enter them after reopening. Unsaved navigation asks before discarding changes. Concurrent draft edits show a conflict with a deliberate reload option. File upload supports progress, cancel, retry, preview, replacement and removal. Saved drafts and file blobs use the dedicated `fgae.synthetic.registration.v1` IndexedDB database. Removing a file from the form detaches its reference; separately uploaded blobs remain in the synthetic database until deliberately cleared. This allows pending application documents to remain available for the next page. Do not store real identity documents in this demo.

Submit creates a pending synthetic account/application and retains a confirmation receipt across refresh in the same tab. Sign in with the email and password you chose; the account remains pending with no operational role grants. Duplicate emails are rejected, identical retries are deduplicated and registration never approves an application. No email delivery is implemented. Registration does not automatically switch an existing signed-in account; sign out before testing a new applicant. Keep the same hostname throughout.

Live application submission uses the documented POST `/volunteers/applications`; configuration, draft and document endpoints/DTOs are proposed and need backend agreement. Real upload scanning/storage/ownership, secure password handling, cookie/CSRF protections, anti-abuse, account creation and review workflows require backend implementation. See local docs/INTEGRATION_HANDOVER.md for C-AUTH-09 through C-AUTH-12. Applicants can now sign in and choose **View my application** to see their own submission.


## My application review
Open http://localhost:5173/sign-in, use your fictional registration email/password, and choose **View my application**. Alternatively use `pending@example.test` / `Demo-only-2026!` for a small pending fixture or `volunteer@example.test` for an approved fixture (unless you changed its password in the reset preview). The page at `/my-application` requires a current session and allows only applicants or volunteers with their own self scope. Other roles use their future review/workspace pages, not this applicant route.

The page shows current status, submitted details in expandable sections, attached document names/types/sizes, and newest-first decision history. Refresh checks the service again; foreground focus and a 60-second foreground timer also verify the session and current data. Failed checks hide sensitive content and provide retry. Cross-tab authentication changes invalidate the displayed snapshot. Sign out removes the view. English/Amharic formatting uses Gregorian dates and Addis Ababa time; changing language does not modify the record. Shared motion/ripple respects reduced-motion preferences.

New synthetic registrations remain pending and show their actual submitted details/document references. Seeded pending/volunteer history is explicitly fictional; missing optional details are shown as not provided. No reviewer action, role grant, approval or account activation occurs on this read-only page. Returned/rejected states and feedback are exercised through intercepted live responses in browser tests; no development status switch appears in the product. Returned pending applicants can now choose Make requested changes to open the correction form. Document downloads/previews are not offered on this page; the metadata list is not a broken link.

Proposed C-APP-01: authenticated GET `/volunteers/applications/me` returns `{success:true,data:{application:null|OwnApplication}}`. The backend must derive the owner from the authenticated session, enforce access even if frontend checks are bypassed, filter history to applicant-visible feedback, and return authoritative status without granting access based on the displayed decision. Live requests use the shared bearer/cookie client, one renewal retry and no-store. Unknown/malformed statuses, another owner's record and inconsistent histories fail closed. No actual application backend has been verified. Read local `docs/INTEGRATION_HANDOVER.md` for the complete proposed contract.


## Correct returned application review
Use http://localhost:5173/sign-in with `returned@example.test` / `Demo-only-2026!`, choose **View my application**, then **Make requested changes**. Sign out first if another account is already signed in. This dedicated fictional account starts with a returned application requesting phone/branch confirmation and an identity document. Existing signup accounts stay pending; no reviewer screen or decision shortcut is added.

At `/my-application/edit`, read the reviewer feedback, edit the requested fields and upload a harmless PDF/JPEG/PNG up to 5 MiB. Only requested fields/document types are editable; email/account access is unchanged. Upload supports preview, replace/remove, cancellation and retry. Save draft explicitly to restore corrections and attachments later. Deleting a correction draft restores last submitted values without withdrawing the application. Leaving with unsaved work asks before discarding it. Draft conflicts retain your entries and require an explicit reload of the latest saved version.

Review shows old/new values and document changes. Confirm accuracy and resubmit: the application returns to pending, the correction draft is cleared, and earlier decisions and previous submitted values are retained. No approval, role assignment or operational access occurs. Refresh the status page to see the updated values and full history. Reloading the completed edit URL shows that no corrections are open; the durable status/history is the source of truth, not a cached success message.

Synthetic correction records/drafts/history/receipts use `fgae.synthetic.corrections.v1` in localStorage, keyed by owner. Corrected document blobs use owner/application-bound keys in the existing synthetic IndexedDB. Clearing that specific localStorage key deliberately restores the returned demo fixture for another test; it does not reset passwords. Detached blobs remain until the synthetic database is deliberately cleared. Keep one hostname throughout and never enter real identity documents. The proposed correction policy and fixture branch/document requirements need organizational confirmation.

Live C-APP-02 through C-APP-05 use authenticated `/volunteers/applications/me/corrections` endpoints for context, drafts, documents and resubmission. Session ownership, allowed changes, version conflicts, attachment scanning/storage, durable idempotency and atomic status/history/draft updates require backend implementation. The frontend uses the shared bearer/cookie client, one renewal retry, safe error mapping, cancellation and no demo fallback. Real backend integration and fluent Amharic terminology approval remain pending. Account settings is now available from the signed-in confirmation.


## Registration layout revision
The registration welcome panel now follows its content height instead of stretching with the entire form. Reduced top/header spacing brings the first field roughly 90 pixels higher on desktop while retaining comfortable spacing and natural scrolling. The change is scoped to registration; mobile panels remain full width. Desktop English and mobile Amharic registration/submit/status checks pass.

## Account settings review
Sign in at http://localhost:5173/sign-in using a fictional active-role or pending applicant account, then choose **Account settings**. The `/account` page offers permitted display-name/contact edits, read-only sign-in email, profile JPEG/PNG upload/change/removal (2 MiB proposal), account language preference and a password section. Temporary-credential accounts must complete first-login setup first. Unknown-role active identities cannot use this page.

Profile/photo/language edits take effect through **Save changes**. **Discard changes** confirms before restoring the saved profile/photo/preference and clearing password entries. Unsaved navigation/sign-out is guarded; recoverable failures retain entries. Photo replacement preserves the previous selection until upload succeeds. Uploaded photos remain unattached until a profile save, and detached blobs require retention cleanup. Concurrent version changes preserve local edits and offer explicit reload. The language selector in the header changes the interface without overwriting form values; the account language field saves a per-account preference and previews that selection. Browser interface selection persists separately and is not forcibly overridden on save.

Open **Change password**, enter the current password, then a different 12-128 character password and matching confirmation. Save/discard profile changes first. Success invalidates prior sessions and requires sign-in with the new password. Wrong current password, mismatch, network and server errors retain password entries only in memory; reload clears them. Identical uncertain retries reuse their idempotency key. No password, confirmation or token is included in saved profile data. Pending accounts retain their state and empty grants.

The synthetic credential store now holds owner-keyed profiles with optimistic versions and password-change idempotency digests. Profile names appear on subsequent session restore/sign-in; saved signup/application submissions are historical records and are not rewritten by account-profile edits. Profile photo blobs use owner-tagged account-photo keys in the existing synthetic IndexedDB. Do not use real personal data or photos in the demo. Both the 2 MiB photo limit and personal-field ownership policy are proposed until confirmed by FGAE.

Live `/account/me`, `/account/me/photos`, authorized photo-content and `/account/me/password` DTOs/endpoints are proposed C-ACCOUNT-01..03. Backend ownership, permitted-field enforcement, name/contact synchronization with HR records, image decoding/scanning/storage/retention, verified login-email changes, secure hashing and atomic session revocation/idempotency require backend implementation. No live backend integration is claimed. Full J09 frontend behavior is tested; human Amharic review remains pending. Next review unit after approval: **Super Admin overview**.


## Super Admin overview review
Open http://localhost:5173/sign-in, use `super.admin@example.test` / `Demo-only-2026!` (or its changed password), then select **Open organization overview**. `/workspaces/super-admin` shows organization-wide application totals, pending/returned follow-up and the six latest application updates. Account settings, refresh and sign-out work; no links to unbuilt review, finance or organization pages are shown. No decisions or account activation happen on this page.

Counts derive from the same saved synthetic registration/correction records as applicant status, deduplicated by person. Multi-role accounts do not double-count applications. New submissions and correction resubmissions appear after refresh. Pending/returned/approved/rejected application statuses remain separate from account activation. Empty responses show zeros and an empty state; service errors hide records instead of reporting false zeros. Refresh, foreground focus and a visible-page 60-second timer revalidate access. Cross-tab auth changes clear records. Dates use Gregorian/Africa/Addis_Ababa formatting.

Live mode proposes GET /workspaces/super-admin/overview, authenticated with cookie/bearer, no-store and one renewal retry. It requires an active global Super Admin, validates response owner/scope/counts/recent metadata, and never falls back to synthetic data. Real backend aggregation and authorization remain pending. Current overview scope covers application records only; future module summaries are added as their services are implemented.


## HR overview review
Sign in at http://localhost:5173/sign-in as `hr@example.test` / `Demo-only-2026!` (or its changed password), then choose **Open HR overview**. `/workspaces/hr` shows personnel totals, employment states, covered branches, contact/job follow-up counts and up to six recently updated personnel records. The default HR account sees three fictional records in Demo branch A; Super Admin sees all five across both branches. No personnel edit, approval, access-granting or unbuilt-page links appear.

Personnel fixtures are explicitly separate from authentication role grants and volunteer applications. Branch/area HR grants are evaluated individually; unrelated role scopes never widen HR visibility. Snapshot validation rejects another requester, out-of-scope branches/records, invalid counts/statuses and incomplete recent results. Backend must independently enforce these permissions. Account access and employment status are shown separately. Contact and job follow-up categories can overlap.

Synthetic permitted account names/contact fields project into linked personnel summaries; filling HR's own missing phone through Account settings clears that contact flag after refresh, without changing employment/location/job data. Personnel timestamps describe personnel-record updates, not account edits. Real personnel records, HR field ownership rules, configurable required fields and account-status synchronization need backend agreement. Live endpoint GET /workspaces/hr/overview is proposed; live mode never falls back to fixtures.

## Manager overview review batch

Use `area.manager@example.test`, `branch.manager@example.test` or `volunteer.manager@example.test` with `Demo-only-2026!` in mock mode. Each overview filters records by the matching role and organizational scope before calculating totals. Application summaries are exclusive to Volunteer Manager and unrestricted Super Admin access. Related mock allocations, assignments and attendance drive coordination totals; existing application submissions and corrections update the application summary. Shared animations, ripple buttons, reduced motion, English/Amharic, responsive layouts and session/error handling apply to all three pages.

These pages provide read-only overviews. Allocation editing, volunteer assignment, application decisions and membership management remain separate planned workflows. Membership summaries await their domain service. Live mode requires the proposed authenticated `GET /workspaces/{manager-kind}/overview` endpoints; no backend integration has been claimed.

## Field, finance and volunteer review batch

HOME-06/07/08 are implemented for review at `/workspaces/field-supervisor`, `/workspaces/finance-officer` and `/workspaces/volunteer`. Mock accounts are `field.supervisor@example.test`, `finance.officer@example.test` and `volunteer@example.test`, initially using `Demo-only-2026!` unless changed in an earlier local password flow.

Supervisors see only assignments and evidence records belonging to their supervision grants. Volunteers see only their own work, attendance, allowances and collections, with a working link to My application. Finance summaries use matching organizational grants and independent approval/disbursement capabilities; P06 excludes self-created requests from approval and self-approved requests from disbursement. Global Super Admin has unrestricted overview access. Attendance and verification states remain distinct. Totals include all scoped snapshot records; recent lists show up to six. Confirmed collections and paid allowances are separate ETB totals, using integer minor units. Pending, failed and processing transactions never count as successful funds.

The existing shared operations records feed assignment/attendance summaries. Fictional finance fixtures are isolated from live builds. These are read-only overviews: attendance submission/decisions, allowance verification/approval, payout initiation and membership remain separate planned workflows. Proposed live GET `/workspaces/{kind}/overview` contracts require complete scoped snapshots and server authorization; backend integration is pending. Both languages, responsive layouts, shared ripple/animations, reduced motion, focus handling, refresh, sign-out and error states are included.

## Project, membership and user directory review batch

HOME-09, HOME-10 and USER-01 are ready for review at `/workspaces/project-manager`, `/workspaces/member` and `/users`. Sign in with `project.manager@example.test`, `member@example.test` or `super.admin@example.test`, using `Demo-only-2026!` unless changed locally. All ten role overviews are now implemented; this latest batch awaits user review.

Project Manager shows assigned projects, linked activities, distinct volunteers, submitted versus verified evidence, available budgets and recent allowance states. Member shows own membership status, review history, configured dues, expiry/renewal availability and payment updates. Successful payments never imply membership approval. Missing configuration remains explicitly unavailable. The mock membership category and dues are fictional examples, not organizational policy.

Users and Access is restricted to global Super Admin. It supports combined name/email/scope search, status and role filters, eight-row pagination, paired roles/scopes, temporary-password indicators, empty results and refresh. Registered accounts and saved profile changes appear in the mock directory. Account creation, access details and grant/status editing (USER-02/03/04) remain the next planned batch; earlier local plan approval labels did not correspond to implemented code and have been corrected.

English/Amharic, responsive layouts, shared animations/ripple, reduced motion, accessibility, session clearing and retry states apply throughout. Live mode proposes authenticated GET `/workspaces/project-manager/overview`, `/workspaces/member/overview` and `/users/overview`; complete snapshots and server-side authorization are required. Backend integration and fluent Amharic review remain pending. The previous HOME-06/07/08 batch was approved and pushed as `7550b74`.
