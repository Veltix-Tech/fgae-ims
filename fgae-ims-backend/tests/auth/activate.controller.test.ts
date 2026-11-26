
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activateAccount: vi.fn(),
}));

vi.mock("../../src/modules/auth/activation.service.js", () => ({
  activateAccount: mocks.activateAccount,
}));

import { activate } from "../../src/modules/auth/auth.controller.js";

describe("Activate account controller", () => {
  const createMocks = () => {
    const req = {
      body: {
        activationToken: "valid-activation-token",
        password: "StrongPassword123!",
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
    mocks.activateAccount.mockResolvedValue(undefined);
  });

  it("activates an account and returns 200", async () => {
    const { req, res, next } = createMocks();

    await activate(req, res, next);

    expect(mocks.activateAccount).toHaveBeenCalledWith(
      "valid-activation-token",
      "StrongPassword123!"
    );

    expect(res.json).toHaveBeenCalledWith({
       message: "Account activated successfully.",
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards activation service errors to the error handler", async () => {
    const { req, res, next } = createMocks();
    const error = new Error("Activation token has expired");

    mocks.activateAccount.mockRejectedValue(error);

    await activate(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
