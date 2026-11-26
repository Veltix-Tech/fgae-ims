
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: mocks.createTransport,
  default: {
    createTransport: mocks.createTransport,
  },
}));

import { sendPasswordResetEmail } from "../../src/modules/auth/email.service.js";

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "test@example.com");
    vi.stubEnv("SMTP_PASS", "test-password");
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("MAIL_FROM", "FGAE-IMS <test@example.com>");
    vi.stubEnv("APP_BASE_URL", "https://fgae.example.com/");

    mocks.sendMail.mockResolvedValue({
      messageId: "test-message",
    });

    mocks.createTransport.mockReturnValue({
      sendMail: mocks.sendMail,
    });
  });

  it("sends a password reset email with the correct link", async () => {
    const expiresAt = new Date("2026-11-16T16:00:00.000Z");

    const result = await sendPasswordResetEmail({
      email: "user@example.com",
      token: "test-reset-token",
      expiresAt,
    });

    expect(result).toEqual({ sent: true });
    expect(mocks.createTransport).toHaveBeenCalled();

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Reset your FGAE-IMS password",
        from: "FGAE-IMS <test@example.com>",
        text: expect.stringContaining(
          "https://fgae.example.com/reset-password?token=test-reset-token",
        ),
        html: expect.stringContaining(
          "https://fgae.example.com/reset-password?token=test-reset-token",
        ),
      }),
    );
  });

  it("encodes the reset token in the URL", async () => {
    await sendPasswordResetEmail({
      email: "user@example.com",
      token: "token with spaces",
      expiresAt: new Date(),
    });

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("token%20with%20spaces"),
      }),
    );
  });

  it("rejects when APP_BASE_URL is missing", async () => {
    vi.stubEnv("APP_BASE_URL", "");

    await expect(
      sendPasswordResetEmail({
        email: "user@example.com",
        token: "test-token",
        expiresAt: new Date(),
      }),
    ).rejects.toThrow("Application URL is not configured");
  });
});
