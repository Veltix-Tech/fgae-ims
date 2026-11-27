import { rateLimit } from "express-rate-limit";

const createAuthLimiter = (
  limit: number,
  windowMs: number,
  message: string,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,

    handler: (_req, res) => {
      res.status(429).json({
        status: "error",
        message,
      });
    },
  });

// Login: maximum 10 attempts per 15 minutes per IP.
export const loginLimiter = createAuthLimiter(
  10,
  15 * 60 * 1000,
  "Too many login attempts. Please try again later.",
);

// Refresh: maximum 30 requests per 15 minutes per IP.
export const refreshLimiter = createAuthLimiter(
  30,
  15 * 60 * 1000,
  "Too many session refresh requests. Please try again later.",
);

// Password reset request: maximum 5 per hour per IP.
export const passwordResetRequestLimiter = createAuthLimiter(
  5,
  60 * 60 * 1000,
  "Too many password reset requests. Please try again later.",
);

// Password reset confirmation: maximum 10 per 15 minutes per IP.
export const passwordResetConfirmLimiter = createAuthLimiter(
  10,
  15 * 60 * 1000,
  "Too many password reset attempts. Please try again later.",
);

// Activation email resend: maximum 5 per hour per IP.
export const resendActivationLimiter = createAuthLimiter(
  5,
  60 * 60 * 1000,
  "Too many activation requests. Please try again later.",
);

// Account activation: maximum 10 per 15 minutes per IP.
export const activationLimiter = createAuthLimiter(
  10,
  15 * 60 * 1000,
  "Too many account activation attempts. Please try again later.",
);

export const logoutLimiter = createAuthLimiter(
  30,
  15 * 60 * 1000,
  "Too many logout requests. Please try again later.",
);

export const logoutAllLimiter = createAuthLimiter(
  10,
  15 * 60 * 1000,
  "Too many logout-all requests. Please try again later.",
);