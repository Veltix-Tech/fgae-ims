import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
} from "vitest";

import {
  authenticateUser,
  type LoginUser,
} from "../../src/modules/auth/auth.service.js";

import { hashPassword } from "../../src/utils/password.js";

describe("Authentication service", () => {
  let activeUser: LoginUser;

  const correctPassword = "TestPassword123!";

  beforeAll(async () => {
    const passwordHash = await hashPassword(correctPassword);

    activeUser = {
      id: "user-123",
      email: "user@example.com",
      passwordHash,
      status: "ACTIVE",
    };
  });

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET =
      "test-secret-for-fgae-ims-automated-tests-123456";
  });

  it("should authenticate a user with correct credentials", async () => {
    const result = await authenticateUser(
      activeUser,
      correctPassword
    );

    expect(result.user.id).toBe("user-123");
    expect(result.user.email).toBe("user@example.com");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toHaveLength(64);
  });

  it("should reject a user that does not exist", async () => {
    await expect(
      authenticateUser(null, correctPassword)
    ).rejects.toThrow("Invalid email or password");
  });

  it("should reject an inactive account", async () => {
    const inactiveUser: LoginUser = {
      ...activeUser,
      status: "SUSPENDED",
    };

    await expect(
      authenticateUser(inactiveUser, correctPassword)
    ).rejects.toThrow("Account is not active");
  });

  it("should reject an incorrect password", async () => {
    await expect(
      authenticateUser(activeUser, "WrongPassword123!")
    ).rejects.toThrow("Invalid email or password");
  });
});