
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPasswordResetRequest: vi.fn(),
  resetPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../../src/modules/auth/passwordReset.service.js", () => ({
  createPasswordResetRequest: mocks.createPasswordResetRequest,
  resetPassword: mocks.resetPassword,
}));

vi.mock("../../src/modules/auth/email.service.js", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

import {
  requestPasswordReset,
  confirmPasswordReset,
} from "../../src/modules/auth/passwordReset.controller.js";

const createResponse = () => {
  const res: any = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

describe("password reset controllers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requestPasswordReset", () => {
    it("sends an email for an eligible account", async () => {
      const resetRequest = {
        email: "user@example.com",
        token: "raw-reset-token",
        expiresAt: new Date(),
      };

      mocks.createPasswordResetRequest.mockResolvedValue(resetRequest);
      mocks.sendPasswordResetEmail.mockResolvedValue({ sent: true });

      const req: any = {
        body: { email: "user@example.com" },
      };
      const res = createResponse();
      const next = vi.fn();

      await requestPasswordReset(req, res, next);

      expect(mocks.createPasswordResetRequest).toHaveBeenCalledWith(
        "user@example.com",
      );

      expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
        resetRequest,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "If an eligible account exists for that email, a password reset link has been sent.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns the same response when no eligible account exists", async () => {
      mocks.createPasswordResetRequest.mockResolvedValue(null);

      const req: any = {
        body: { email: "unknown@example.com" },
      };
      const res = createResponse();
      const next = vi.fn();

      await requestPasswordReset(req, res, next);

      expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "If an eligible account exists for that email, a password reset link has been sent.",
      });
    });

    it("passes email errors to the error handler", async () => {
      const error = new Error("SMTP failure");

      mocks.createPasswordResetRequest.mockResolvedValue({
        email: "user@example.com",
        token: "test-token",
        expiresAt: new Date(),
      });
      mocks.sendPasswordResetEmail.mockRejectedValue(error);

      const req: any = {
        body: { email: "user@example.com" },
      };
      const res = createResponse();
      const next = vi.fn();

      await requestPasswordReset(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("confirmPasswordReset", () => {
    it("resets the password successfully", async () => {
      const result = {
        message: "Password reset successfully",
      };

      mocks.resetPassword.mockResolvedValue(result);

      const req: any = {
        body: {
          token: "valid-reset-token",
          newPassword: "A-strong-new-password-123",
        },
      };
      const res = createResponse();
      const next = vi.fn();

      await confirmPasswordReset(req, res, next);

      expect(mocks.resetPassword).toHaveBeenCalledWith(
        "valid-reset-token",
        "A-strong-new-password-123",
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes invalid token errors to the error handler", async () => {
      const error = new Error("Invalid or expired password reset token");

      mocks.resetPassword.mockRejectedValue(error);

      const req: any = {
        body: {
          token: "invalid-token",
          newPassword: "A-strong-new-password-123",
        },
      };
      const res = createResponse();
      const next = vi.fn();

      await confirmPasswordReset(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
