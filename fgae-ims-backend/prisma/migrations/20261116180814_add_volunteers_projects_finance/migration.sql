/*
  Warnings:

  - A unique constraint covering the columns `[personId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SubmissionChannel" AS ENUM ('PUBLIC', 'STAFF_ASSISTED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('AWAITING_PAYMENT', 'REGISTERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAYMENT', 'REGISTRATION', 'ACCOUNT_INVITATION');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BudgetAllocationStatus" AS ENUM ('PENDING', 'APPROVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AllowanceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "DisbursementMethod" AS ENUM ('TELEBIRR_BULK', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "personId" UUID;

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "grandFatherName" VARCHAR(100),
    "gender" "Gender" NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_applications" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "availability" JSONB,
    "submissionChannel" "SubmissionChannel" NOT NULL,
    "submittedByUserId" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" UUID NOT NULL,
    "preferredBranchId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "volunteer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ETB',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionReference" TEXT,
    "paymentReference" VARCHAR(100) NOT NULL,
    "applicantPhone" VARCHAR(30),
    "failureReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),
    "verifiedAt" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteers" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "volunteerNumber" VARCHAR(50) NOT NULL,
    "registeredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_number_counters" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "volunteer_number_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_skills" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "proficiencyLevel" "ProficiencyLevel",

    CONSTRAINT "application_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_skills" (
    "id" UUID NOT NULL,
    "volunteerId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "proficiencyLevel" "ProficiencyLevel" NOT NULL,

    CONSTRAINT "volunteer_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_interests" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "interestId" UUID NOT NULL,

    CONSTRAINT "application_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_interests" (
    "id" UUID NOT NULL,
    "volunteerId" UUID NOT NULL,
    "interestId" UUID NOT NULL,

    CONSTRAINT "volunteer_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "settingKey" VARCHAR(150) NOT NULL,
    "settingValue" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedByUserId" UUID,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "createdById" UUID,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_budget_allocations" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "approvedById" UUID,
    "budgetCode" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ETB',
    "purpose" TEXT,
    "status" "BudgetAllocationStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_budget_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_facilities" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" TEXT,
    "status" "OrganizationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "health_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileStorageId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_assignments" (
    "id" UUID NOT NULL,
    "volunteerId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "healthFacilityId" UUID,
    "supervisorId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "volunteer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_attendance" (
    "id" UUID NOT NULL,
    "activityDate" DATE NOT NULL,
    "assignmentId" UUID NOT NULL,
    "verifiedById" UUID,
    "checkIn" TIME(6),
    "checkOut" TIME(6),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_attendance_pkey" PRIMARY KEY ("id","activityDate")
);

-- CreateTable
CREATE TABLE "allowance_requests" (
    "id" UUID NOT NULL,
    "volunteerId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "budgetAllocationId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "verifiedById" UUID,
    "approvedById" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ETB',
    "reason" VARCHAR(255),
    "status" "AllowanceStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedAt" TIMESTAMPTZ(6),
    "approvedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "allowance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowance_disbursements" (
    "id" UUID NOT NULL,
    "allowanceRequestId" UUID NOT NULL,
    "executedById" UUID,
    "method" "DisbursementMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "recipientPhone" VARCHAR(30) NOT NULL,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PROCESSING',
    "providerTxnId" VARCHAR(100),
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "failureReason" TEXT,
    "executedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "allowance_disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "persons_phone_key" ON "persons"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "departments_isActive_idx" ON "departments"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_applications_personId_key" ON "volunteer_applications"("personId");

-- CreateIndex
CREATE INDEX "volunteer_applications_status_submittedAt_idx" ON "volunteer_applications"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "volunteer_applications_submittedByUserId_idx" ON "volunteer_applications"("submittedByUserId");

-- CreateIndex
CREATE INDEX "volunteer_applications_departmentId_idx" ON "volunteer_applications"("departmentId");

-- CreateIndex
CREATE INDEX "volunteer_applications_preferredBranchId_idx" ON "volunteer_applications"("preferredBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionReference_key" ON "payments"("transactionReference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentReference_key" ON "payments"("paymentReference");

-- CreateIndex
CREATE INDEX "payments_applicationId_status_idx" ON "payments"("applicationId", "status");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_personId_key" ON "volunteers"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_applicationId_key" ON "volunteers"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_volunteerNumber_key" ON "volunteers"("volunteerNumber");

-- CreateIndex
CREATE INDEX "volunteers_departmentId_idx" ON "volunteers"("departmentId");

-- CreateIndex
CREATE INDEX "notifications_personId_status_idx" ON "notifications"("personId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "application_skills_skillId_idx" ON "application_skills"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "application_skills_applicationId_skillId_key" ON "application_skills"("applicationId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_skills_volunteerId_skillId_key" ON "volunteer_skills"("volunteerId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "interests_name_key" ON "interests"("name");

-- CreateIndex
CREATE INDEX "application_interests_interestId_idx" ON "application_interests"("interestId");

-- CreateIndex
CREATE UNIQUE INDEX "application_interests_applicationId_interestId_key" ON "application_interests"("applicationId", "interestId");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_interests_volunteerId_interestId_key" ON "volunteer_interests"("volunteerId", "interestId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_settingKey_key" ON "system_settings"("settingKey");

-- CreateIndex
CREATE INDEX "system_settings_updatedByUserId_idx" ON "system_settings"("updatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "programs_name_key" ON "programs"("name");

-- CreateIndex
CREATE INDEX "projects_programId_idx" ON "projects"("programId");

-- CreateIndex
CREATE INDEX "projects_areaId_status_idx" ON "projects"("areaId", "status");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "projects_programId_name_key" ON "projects"("programId", "name");

-- CreateIndex
CREATE INDEX "project_budget_allocations_projectId_status_idx" ON "project_budget_allocations"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_budget_allocations_approvedById_idx" ON "project_budget_allocations"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "project_budget_allocations_projectId_budgetCode_key" ON "project_budget_allocations"("projectId", "budgetCode");

-- CreateIndex
CREATE INDEX "health_facilities_branchId_status_idx" ON "health_facilities"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "health_facilities_branchId_code_key" ON "health_facilities"("branchId", "code");

-- CreateIndex
CREATE INDEX "application_documents_applicationId_idx" ON "application_documents"("applicationId");

-- CreateIndex
CREATE INDEX "volunteer_assignments_volunteerId_status_idx" ON "volunteer_assignments"("volunteerId", "status");

-- CreateIndex
CREATE INDEX "volunteer_assignments_projectId_status_idx" ON "volunteer_assignments"("projectId", "status");

-- CreateIndex
CREATE INDEX "volunteer_assignments_branchId_idx" ON "volunteer_assignments"("branchId");

-- CreateIndex
CREATE INDEX "volunteer_assignments_healthFacilityId_idx" ON "volunteer_assignments"("healthFacilityId");

-- CreateIndex
CREATE INDEX "volunteer_assignments_supervisorId_idx" ON "volunteer_assignments"("supervisorId");

-- CreateIndex
CREATE INDEX "volunteer_attendance_verifiedById_idx" ON "volunteer_attendance"("verifiedById");

-- CreateIndex
CREATE INDEX "volunteer_attendance_verificationStatus_activityDate_idx" ON "volunteer_attendance"("verificationStatus", "activityDate");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_attendance_assignmentId_activityDate_key" ON "volunteer_attendance"("assignmentId", "activityDate");

-- CreateIndex
CREATE INDEX "allowance_requests_volunteerId_status_idx" ON "allowance_requests"("volunteerId", "status");

-- CreateIndex
CREATE INDEX "allowance_requests_projectId_status_idx" ON "allowance_requests"("projectId", "status");

-- CreateIndex
CREATE INDEX "allowance_requests_budgetAllocationId_idx" ON "allowance_requests"("budgetAllocationId");

-- CreateIndex
CREATE INDEX "allowance_requests_requestedById_idx" ON "allowance_requests"("requestedById");

-- CreateIndex
CREATE INDEX "allowance_requests_verifiedById_idx" ON "allowance_requests"("verifiedById");

-- CreateIndex
CREATE INDEX "allowance_requests_approvedById_idx" ON "allowance_requests"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_disbursements_providerTxnId_key" ON "allowance_disbursements"("providerTxnId");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_disbursements_idempotencyKey_key" ON "allowance_disbursements"("idempotencyKey");

-- CreateIndex
CREATE INDEX "allowance_disbursements_allowanceRequestId_idx" ON "allowance_disbursements"("allowanceRequestId");

-- CreateIndex
CREATE INDEX "allowance_disbursements_executedById_idx" ON "allowance_disbursements"("executedById");

-- CreateIndex
CREATE INDEX "allowance_disbursements_status_executedAt_idx" ON "allowance_disbursements"("status", "executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_personId_key" ON "users"("personId");

--Create Index
CREATE UNIQUE INDEX "user_roles_one_active_role_per_user"ON "user_roles" ("userId")WHERE "revokedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_applications" ADD CONSTRAINT "volunteer_applications_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_applications" ADD CONSTRAINT "volunteer_applications_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_applications" ADD CONSTRAINT "volunteer_applications_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_applications" ADD CONSTRAINT "volunteer_applications_preferredBranchId_fkey" FOREIGN KEY ("preferredBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "volunteer_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "volunteer_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_skills" ADD CONSTRAINT "application_skills_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "volunteer_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_skills" ADD CONSTRAINT "application_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_skills" ADD CONSTRAINT "volunteer_skills_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_skills" ADD CONSTRAINT "volunteer_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_interests" ADD CONSTRAINT "application_interests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "volunteer_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_interests" ADD CONSTRAINT "application_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "interests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_interests" ADD CONSTRAINT "volunteer_interests_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_interests" ADD CONSTRAINT "volunteer_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "interests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_budget_allocations" ADD CONSTRAINT "project_budget_allocations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_budget_allocations" ADD CONSTRAINT "project_budget_allocations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_facilities" ADD CONSTRAINT "health_facilities_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "volunteer_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_healthFacilityId_fkey" FOREIGN KEY ("healthFacilityId") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_assignments" ADD CONSTRAINT "volunteer_assignments_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_attendance" ADD CONSTRAINT "volunteer_attendance_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "volunteer_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_attendance" ADD CONSTRAINT "volunteer_attendance_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests" ADD CONSTRAINT "allowance_requests_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests" ADD CONSTRAINT "allowance_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests" ADD CONSTRAINT "allowance_requests_budgetAllocationId_fkey" FOREIGN KEY ("budgetAllocationId") REFERENCES "project_budget_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests" ADD CONSTRAINT "allowance_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests" ADD CONSTRAINT "allowance_requests_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_requests" ADD CONSTRAINT "allowance_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_disbursements" ADD CONSTRAINT "allowance_disbursements_allowanceRequestId_fkey" FOREIGN KEY ("allowanceRequestId") REFERENCES "allowance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_disbursements" ADD CONSTRAINT "allowance_disbursements_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
