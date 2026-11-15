# Decisions needed

1. Custom login (as in the spec) or Supabase Auth?
2. users.status default: INVITED (dictionary) or ACTIVE (Prisma)?
3. Add a volunteer_applications table? The API has applications, but the schema has no table for them.
4. How do Finance Approver, Disbursement Officer, HR Officer, Project Manager and Member map to roles?
5. Is "project location" its own unit type, or a health facility?
6. Where should database files live in this repo (fgae-ims-database/ or another folder)?
7. Allowance statuses: confirm the 7-stage lifecycle (DRAFT to PAID/FAILED).
8. Approval vs. disbursement: separate users or permissions? How is budget availability checked?
9. Applications: new row per attempt, or reuse the old one for a rejected applicant?
10. GPS: the guide says attendance has no GPS columns, but the Blueprint does. Keep latitude and longitude?
11. Do we add a Person table (as the guide says) and link User.personId, or do users stay standalone? The volunteer models need a person.
12. Where do Health Facilities go? A table under Branch, or a type on Branch?
13. Should a user’s role be tied to an office, or stay independent as it is now?
14. Are approval and disbursement separate permissions?
Does AuditLog need before and after values and partitioning?
15. Who creates the first SUPER_ADMIN and Organization?
## Answered
- Application flow: SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
- Model names: PascalCase singular (no @@map)
- Keep Skill, Interest, Notification, SystemSetting

## Still open (ask the leader)
- User.status default: INVITED or ACTIVE?
- Keep User.name? Should passwordHash be required?
- Is the registration fee paid before or after approval?