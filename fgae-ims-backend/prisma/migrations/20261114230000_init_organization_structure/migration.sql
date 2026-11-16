-- CreateEnum
CREATE TYPE "OrganizationalStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "website" VARCHAR(255),
    "address" TEXT,
    "status" "OrganizationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "officeAddress" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "status" "OrganizationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "status" "OrganizationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "areas_organizationId_status_idx" ON "areas"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "areas_organizationId_code_key" ON "areas"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "areas_organizationId_name_key" ON "areas"("organizationId", "name");

-- CreateIndex
CREATE INDEX "branches_areaId_status_idx" ON "branches"("areaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "branches_areaId_code_key" ON "branches"("areaId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "branches_areaId_name_key" ON "branches"("areaId", "name");

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

