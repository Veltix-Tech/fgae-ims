
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

vi.mock("../../src/modules/auth/changePassword.service.js", () => ({
  changePassword: mocks.changePassword,
}));

import {
  changePassword as changePasswordController,
} from "../../src/modules/auth/changePassword.controller.js";

const createResponse = () => {
  const res: any = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

describe("changePassword controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("changes the authenticated user's password", async () => {
    const result = {
      message: "Password changed successfully. Please log in again.",
    };

    mocks.changePassword.mockResolvedValue(result);

    const req: any = {
      auth: { userId: "user-1" },
      body: {
        currentPassword: "Old-password-123",
        newPassword: "New-password-456",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    await changePasswordController(req, res, next);

    expect(mocks.changePassword).toHaveBeenCalledWith(
      "user-1",
      "Old-password-123",
      "New-password-456",
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a request without an authenticated user", async () => {
    const req: any = {
      body: {
        currentPassword: "Old-password-123",
        newPassword: "New-password-456",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    await changePasswordController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Authentication required",
      }),
    );

    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("passes service errors to the error handler", async () => {
    const error = new Error("Current password is incorrect");

    mocks.changePassword.mockRejectedValue(error);

    const req: any = {
      auth: { userId: "user-1" },
      body: {
        currentPassword: "wrong",
        newPassword: "New-password-456",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    await changePasswordController(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
