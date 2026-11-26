
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  vi,
} from "vitest";

const prismaMock = vi.hoisted(() => ({
  userSession: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: prismaMock,
}));

import {
  authenticateUser,
  refreshLoginSession,
  type LoginUser,
} from "../../src/modules/auth/auth.service.js";

import { hashPassword } from "../../src/utils/password.js";

describe("Authentication service", () => {
  let activeUser: LoginUser;

  const correctPassword = "TestPassword123!";

  const createSession = (overrides = {}) => ({
    id: "session-123",
    userId: "user-123",
    refreshTokenHash: "hashed-refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
    lastUsedAt: null,
    user: {
      id: "user-123",
      email: "user@example.com",
      status: "ACTIVE",
    },
    ...overrides,
  });

  const mockTransaction = () => {
    prismaMock.$transaction.mockImplementation(
      async (callback: any) =>
        callback({
          userSession: {
            updateMany: prismaMock.userSession.updateMany,
            create: prismaMock.userSession.create,
          },
        }),
    );
  };

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
    vi.clearAllMocks();

    process.env.JWT_ACCESS_SECRET =
      "test-secret-for-fgae-ims-automated-tests-123456";
  });

  describe("Login", () => {
    it("should authenticate a user with correct credentials", async () => {
      const result = await authenticateUser(
        activeUser,
        correctPassword,
      );

      expect(result.user.id).toBe("user-123");
      expect(result.user.email).toBe("user@example.com");
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toHaveLength(64);
    });

    it("should reject a user that does not exist", async () => {
      await expect(
        authenticateUser(null, correctPassword),
      ).rejects.toThrow("Invalid email or password");
    });

    it("should reject an inactive account", async () => {
      const inactiveUser: LoginUser = {
        ...activeUser,
        status: "SUSPENDED",
      };

      await expect(
        authenticateUser(inactiveUser, correctPassword),
      ).rejects.toThrow("Invalid email or password");
    });

    it("should reject an incorrect password", async () => {
      await expect(
        authenticateUser(activeUser, "WrongPassword123!"),
      ).rejects.toThrow("Invalid email or password");
    });
  });

  describe("Refresh token rotation", () => {
    it("should rotate a valid refresh token", async () => {
      const session = createSession();

      prismaMock.userSession.findUnique.mockResolvedValue(session);
      prismaMock.userSession.updateMany.mockResolvedValue({
        count: 1,
      });

      // The replacement session ID is used in the new access token.
      prismaMock.userSession.create.mockResolvedValue({
        id: "new-session-456",
      });

      mockTransaction();

      const result = await refreshLoginSession(
        "current-refresh-token",
        {
          ipAddress: "127.0.0.1",
          userAgent: "Test browser",
        },
      );

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toHaveLength(64);
      expect(result.refreshToken).not.toBe("current-refresh-token");

      expect(result.user).toEqual({
        id: "user-123",
        email: "user@example.com",
      });

      expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "session-123",
            revokedAt: null,
          }),
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
            lastUsedAt: expect.any(Date),
          }),
        }),
      );

      expect(prismaMock.userSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-123",
            refreshTokenHash: expect.any(String),
            ipAddress: "127.0.0.1",
            userAgent: "Test browser",
          }),
        }),
      );
    });

    it("should reject a refresh token that does not exist", async () => {
      prismaMock.userSession.findUnique.mockResolvedValue(null);

      await expect(
        refreshLoginSession("unknown-token"),
      ).rejects.toThrow("Invalid refresh token");

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("should reject an expired refresh token", async () => {
      prismaMock.userSession.findUnique.mockResolvedValue(
        createSession({
          expiresAt: new Date(Date.now() - 60 * 1000),
        }),
      );

      await expect(
        refreshLoginSession("expired-token"),
      ).rejects.toThrow("Invalid refresh token");

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("should reject a refresh token belonging to an inactive user", async () => {
      prismaMock.userSession.findUnique.mockResolvedValue(
        createSession({
          user: {
            id: "user-123",
            email: "user@example.com",
            status: "SUSPENDED",
          },
        }),
      );

      await expect(
        refreshLoginSession("inactive-user-token"),
      ).rejects.toThrow("Invalid refresh token");

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("should revoke all active sessions when a rotated token is reused", async () => {
      const revokedAt = new Date();
      const lastUsedAt = new Date();

      prismaMock.userSession.findUnique.mockResolvedValue(
        createSession({
          revokedAt,
          lastUsedAt,
        }),
      );

      prismaMock.userSession.updateMany.mockResolvedValue({
        count: 2,
      });

      await expect(
        refreshLoginSession("reused-token"),
      ).rejects.toThrow("Invalid refresh token");

      expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("should not revoke other sessions when an ordinary logged-out token is reused", async () => {
      prismaMock.userSession.findUnique.mockResolvedValue(
        createSession({
          revokedAt: new Date(),
          lastUsedAt: null,
        }),
      );

      await expect(
        refreshLoginSession("logged-out-token"),
      ).rejects.toThrow("Invalid refresh token");

      expect(prismaMock.userSession.updateMany).not.toHaveBeenCalled();
    });

    it("should detect reuse when another request rotates the token first", async () => {
      const rotatedSession = createSession({
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      });

      prismaMock.userSession.findUnique
        .mockResolvedValueOnce(createSession())
        .mockResolvedValueOnce(rotatedSession);

      prismaMock.userSession.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      mockTransaction();

      await expect(
        refreshLoginSession("concurrently-used-token"),
      ).rejects.toThrow("Invalid refresh token");

      expect(prismaMock.userSession.findUnique).toHaveBeenCalledTimes(2);

      expect(prismaMock.userSession.updateMany).toHaveBeenLastCalledWith({
        where: {
          userId: "user-123",
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });

      expect(prismaMock.userSession.create).not.toHaveBeenCalled();
    });
  });
});
