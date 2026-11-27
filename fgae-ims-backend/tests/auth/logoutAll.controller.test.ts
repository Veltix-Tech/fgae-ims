
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logoutAllUserSessions: vi.fn(),
}));

vi.mock("../../src/modules/auth/auth.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/modules/auth/auth.service.js")>();

  return {
    ...actual,
    logoutAllUserSessions: mocks.logoutAllUserSessions,
  };
});

import { logoutAll } from "../../src/modules/auth/auth.controller.js";

const createResponse = () => {
  const res: any = {
    clearCookie: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

describe("logoutAll controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logoutAllUserSessions.mockResolvedValue({ count: 2 });
  });

  it("logs out all sessions for the authenticated user", async () => {
    const req: any = {
      auth: { userId: "user-1" },
    };

    const res = createResponse();
    const next = vi.fn();

    await logoutAll(req, res, next);

    expect(mocks.logoutAllUserSessions).toHaveBeenCalledWith("user-1");

    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  path: "/auth",
});

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      message: "Logged out from all devices successfully",
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a request without an authenticated user", async () => {
    const req: any = {};

    const res = createResponse();
    const next = vi.fn();

    await logoutAll(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Authentication required",
      }),
    );

    expect(mocks.logoutAllUserSessions).not.toHaveBeenCalled();
  });

  it("passes service errors to the error handler", async () => {
    const error = new Error("Database failure");

    mocks.logoutAllUserSessions.mockRejectedValue(error);

    const req: any = {
      auth: { userId: "user-1" },
    };

    const res = createResponse();
    const next = vi.fn();

    await logoutAll(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
