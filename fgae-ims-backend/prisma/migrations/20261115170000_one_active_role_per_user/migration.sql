CREATE UNIQUE INDEX "user_roles_one_active_role_per_user"
ON "user_roles" ("userId")
WHERE "revokedAt" IS NULL;
