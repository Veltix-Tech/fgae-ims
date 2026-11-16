# FGAE-IMS: Project Summary (Day 1)

## 1. The 10 tables

| Table | What it stores | Why it's its own table |
|---|---|---|
| persons |A real human’s identity: name, phone, gender, date of birth, optional email |Each human is stored once. Users, volunteers, and HR records all point to this one record, so details are never copied, and someone can exist without an account. |
| users |A login account: email, password hash, status, home office | Credentials are separate from identity. An account can be suspended or changed without touching the person, and not every person needs one.|
| sessions |One row per active login on a device: hashed refresh token, expiry, revoked time | One user can be logged in on several devices, and an admin can revoke a single session to log that device out.|
| organization_units |The offices of FGAE: head office, area offices, branches, health facilities | Offices sit inside other offices, so each row points to its parent through parent_id. One table can hold the whole tree.|
| volunteers | A person’s volunteer profile: volunteer number, home branch, program status, membership status| Being a volunteer is a role a person takes on. It has its own number, branch, and lifecycle, separate from identity|
| volunteer_assignments | One deployment of a volunteer: which project, which location (branch or health facility), which supervisor, start and end dates, status| A volunteer can work on several projects, or the same one at different times. Each deployment is its own row, so history is kept.|
| volunteer_attendance | One row per volunteer per working day: check-in and check-out times, GPS coordinates, status (present, late, etc.), and a supervisor’s verification|It grows very fast (every volunteer, every day), so it’s stored separately and split into monthly partitions for speed. |
| payment_transactions |Money coming in: registration fees and membership dues, with the payment method, amount, status, and the provider’s reference |Incoming fees have a different life cycle and different rules from outgoing payouts. |
| allowance_requests | A request to pay a volunteer a per-diem: who, which project, which budget line, how much, who asked, who approved| The request is a decision step (submitted, verified, approved). Money hasn’t moved yet.|
| allowance_disbursements |The actual money sent out to a volunteer’s phone: method, recipient phone, provider transaction ID, status | It’s a permanent financial record that is never edited or deleted. A request can change, but a payout that happened can’t.|

## 2. Three "why" questions
1,Why is persons separate from users and volunteers? One human is stored once. Account, volunteer, and HR records all point to that record, so a phone number is never duplicated, and a person can exist without an account.
2,Why are collections and disbursements separate? Money in (fees from applicants) and money out (allowances to volunteers) have different rules, different people, and different audits. Separate tables let finance answer “how much did we receive?” and “how much did we pay?” independently, and the payout ledger can be locked as permanent.
3,Why does organization_units point to itself? Offices sit inside other offices (Head Office, Area, Branch, Facility). A parent_id pointing to the same table stores the whole tree in one table, with any depth.

## 3. The 10 most common actions

| # | Action (Role does X) | Tables read | Tables written |
|---|---|---|---|
| 1 | Any user logs in | users, sessions | sessions, users (last_login_at) |
| 2 | System Admin creates a branch | organization_units | organization_units |
| 3 | System Admin creates a user account | persons | persons, users |
| 4 | Applicant submits a volunteer application | organization_units | persons, application tables (not yet defined) |
| 5 | Applicant pays the registration fee | application tables (not yet defined) | payment_transactions |
| 6 | Volunteer Manager approves an application | application tables, persons | volunteers, application status |
| 7 | Volunteer Manager assigns a volunteer to a project | volunteers, projects (not yet defined), organization_units | volunteer_assignments |
| 8 | Volunteer submits attendance | volunteer_assignments | volunteer_attendance |
| 9 | Field Supervisor verifies attendance | volunteer_attendance, volunteer_assignments | volunteer_attendance |
| 10 | Project Manager requests an allowance; Finance approves and pays | volunteer_attendance, project budgets (not yet defined) | allowance_requests, allowance_disbursements |

## 4. What I don't understand yet