
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: mocks.createTransport,
}));

import { sendAccountActivationEmail } from "../../src/modules/auth/email.service.js";

describe("Email service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("SMTP_USER", "test-user");
    vi.stubEnv("SMTP_PASS", "test-password");
    vi.stubEnv("MAIL_FROM", "FGAE-IMS <no-reply@example.com>");
    vi.stubEnv("APP_BASE_URL", "https://fgae.example.com");

    mocks.sendMail.mockResolvedValue({
      messageId: "test-message-id",
    });

    mocks.createTransport.mockReturnValue({
      sendMail: mocks.sendMail,
    });
  });

  it("sends an account activation email", async () => {
    const expiresAt = new Date("2026-11-17T10:00:00.000Z");

    const result = await sendAccountActivationEmail({
      email: "staff@example.com",
      token: "secure-token",
      expiresAt,
    });

    expect(result).toEqual({ sent: true });

    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
          user: "test-user",
          pass: "test-password",
        },
      }),
    );

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "staff@example.com",
        subject: "Activate your FGAE-IMS account",
        from: "FGAE-IMS <no-reply@example.com>",
        text: expect.stringContaining("secure-token"),
        html: expect.stringContaining("secure-token"),
      }),
    );
  });

  it("uses the configured application URL", async () => {
    await sendAccountActivationEmail({
      email: "staff@example.com",
      token: "my-token",
      expiresAt: new Date(),
    });

    const email = mocks.sendMail.mock.calls[0][0];

    expect(email.html).toContain(
      "https://fgae.example.com/activate-account?token=my-token",
    );
  });

  it("rejects when SMTP configuration is missing", async () => {
    vi.stubEnv("SMTP_HOST", "");

    await expect(
      sendAccountActivationEmail({
        email: "staff@example.com",
        token: "token",
        expiresAt: new Date(),
      }),
    ).rejects.toThrow("Email service is not configured");

    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("rejects when the application URL is missing", async () => {
    vi.stubEnv("APP_BASE_URL", "");

    await expect(
      sendAccountActivationEmail({
        email: "staff@example.com",
        token: "token",
        expiresAt: new Date(),
      }),
    ).rejects.toThrow("Application URL is not configured");
  });

  it("rejects when the SMTP port is invalid", async () => {
    vi.stubEnv("SMTP_PORT", "invalid");

    await expect(
      sendAccountActivationEmail({
        email: "staff@example.com",
        token: "token",
        expiresAt: new Date(),
      }),
    ).rejects.toThrow("Invalid SMTP port configuration");
  });
});
