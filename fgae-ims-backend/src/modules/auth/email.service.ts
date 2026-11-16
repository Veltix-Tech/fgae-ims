
import "dotenv/config";
import * as nodemailer from "nodemailer";
import { AppError } from "../../utils/AppError.js";

type ActivationEmailInput = {
  email: string;
  token: string;
  expiresAt: Date;
};

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || !process.env.MAIL_FROM) {
    throw new AppError(
      "Email service is not configured",
      503,
    );
  }

  const port = Number(process.env.SMTP_PORT || 587);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AppError("Invalid SMTP port configuration", 500);
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass,
    },
  });
};

export const sendAccountActivationEmail = async ({
  email,
  token,
  expiresAt,
}: ActivationEmailInput) => {
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!appBaseUrl) {
    throw new AppError(
      "Application URL is not configured",
      503,
    );
  }

  const activationUrl =
    `${appBaseUrl.replace(/\/+$/, "")}` +
    `/activate-account?token=${encodeURIComponent(token)}`;

  const transporter = getTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Activate your FGAE-IMS account",
    text: [
      "Welcome to FGAE-IMS.",
      "",
      "Your staff account has been created.",
      "Use the link below to set your password and activate your account:",
      activationUrl,
      "",
      `This invitation expires at ${expiresAt.toISOString()}.`,
      "If you did not expect this invitation, you can ignore this email.",
    ].join("\n"),
    html: `
      <h2>Welcome to FGAE-IMS</h2>
      <p>Your staff account has been created.</p>
      <p>Use the button below to set your password and activate your account.</p>
      <p>
        <a href="${activationUrl}"
           style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
          Activate Account
        </a>
      </p>
      <p>This invitation expires at ${expiresAt.toISOString()}.</p>
      <p>If you did not expect this invitation, you can ignore this email.</p>
    `,
  });

  return { sent: true };
};
