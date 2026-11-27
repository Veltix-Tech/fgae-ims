
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resendActivationInvitation: vi.fn(),
}));

vi.mock("../../src/modules/auth/resendActivation.service.js", () => ({
  resendActivationInvitation: mocks.resendActivationInvitation,
}));

import {
  resendActivation,
} from "../../src/modules/auth/auth.controller.js";

describe("Resend activation controller", () => {
  const createMocks = () => {
    const req = {
      body: {
        email: "staff@example.com",
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
    mocks.resendActivationInvitation.mockResolvedValue(undefined);
  });

  it("returns the same generic response after requesting a resend", async () => {
    const { req, res, next } = createMocks();

    await resendActivation(req, res, next);

    expect(mocks.resendActivationInvitation).toHaveBeenCalledWith(
      "staff@example.com",
    );

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({
      message:
        "If an eligible account exists, an activation invitation will be sent.",
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("forwards unexpected service errors", async () => {
    const { req, res, next } = createMocks();
    const error = new Error("Database unavailable");

    mocks.resendActivationInvitation.mockRejectedValue(error);

    await resendActivation(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
