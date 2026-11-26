
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    userSession: {
      updateMany: mocks.updateMany,
    },
  },
}));

import { logoutAllUserSessions } from "../../src/modules/auth/auth.service.js";

describe("logoutAllUserSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 3 });
  });

  it("revokes all active sessions belonging to the user", async () => {
    const result = await logoutAllUserSessions("user-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    expect(result.count).toBe(3);
  });

  it("does not revoke sessions belonging to other users", async () => {
    await logoutAllUserSessions("user-1");

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
        }),
      }),
    );
  });

  it("returns zero when the user has no active sessions", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const result = await logoutAllUserSessions("user-1");

    expect(result.count).toBe(0);
  });

  it("rejects an empty user ID", async () => {
    await expect(logoutAllUserSessions("")).rejects.toThrow(
      "User ID is required",
    );

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
