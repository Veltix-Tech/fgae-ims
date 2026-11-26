
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("../../src/modules/auth/currentUser.service.js", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

import { getMe } from "../../src/modules/auth/auth.controller.js";

describe("Get current user controller", () => {
  const user = {
    id: "user-123",
    email: "staff@example.com",
    access: {
      role: "BRANCH_MANAGER",
      permissions: ["USER_CREATE"],
      areaIds: ["area-123"],
      branchIds: ["branch-123"],
    },
  };

  const createMocks = () => {
    const req = {
      auth: {
        userId: "user-123",
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const next = vi.fn();

    return { req, res, next };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
  });

  it("returns the authenticated user's information", async () => {
    const { req, res, next } = createMocks();

    await getMe(req, res, next);

    expect(mocks.getCurrentUser).toHaveBeenCalledWith("user-123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ user });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards errors from the current-user service", async () => {
    const { req, res, next } = createMocks();
    const error = new Error("Database unavailable");

    mocks.getCurrentUser.mockRejectedValue(error);

    await getMe(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a request without an authenticated user ID", async () => {
    const { req, res, next } = createMocks();
    req.auth = undefined;

    await getMe(req, res, next);

    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Authentication required",
      }),
    );
  });
});
