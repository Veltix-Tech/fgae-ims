
type Environment = Record<string, string | undefined>;

const isValidPort = (value: string): boolean => {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const validateEnvironment = (
  env: Environment = process.env,
): void => {
  const errors: string[] = [];

  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  if (!["development", "test", "production"].includes(nodeEnv)) {
    errors.push("NODE_ENV must be development, test, or production.");
  }

  // Server
  if (env.PORT && !isValidPort(env.PORT)) {
    errors.push("PORT must be an integer between 1 and 65535.");
  }

  // Database
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!env[key]?.trim()) {
      errors.push(`${key} is required.`);
    }
  }

  // JWT
  const jwtSecret = env.JWT_ACCESS_SECRET?.trim();

  if (!jwtSecret) {
    errors.push("JWT_ACCESS_SECRET is required.");
  } else {
    if (jwtSecret.length < 32) {
      errors.push("JWT_ACCESS_SECRET must contain at least 32 characters.");
    }

    if (
      isProduction &&
      /replace|change.?me|example|placeholder|secret123/i.test(jwtSecret)
    ) {
      errors.push("JWT_ACCESS_SECRET must not contain a placeholder value.");
    }
  }

  // CORS
  if (isProduction && !env.CORS_ORIGINS?.trim()) {
    errors.push("CORS_ORIGINS is required in production.");
  }

  // Cookie settings
  const sameSite = env.COOKIE_SAME_SITE || "lax";

  if (!["strict", "lax", "none"].includes(sameSite)) {
    errors.push("COOKIE_SAME_SITE must be strict, lax, or none.");
  }

  if (
    env.COOKIE_SECURE !== undefined &&
    !["true", "false"].includes(env.COOKIE_SECURE.toLowerCase())
  ) {
    errors.push("COOKIE_SECURE must be true or false.");
  }

  if (
    sameSite === "none" &&
    !isProduction &&
    env.COOKIE_SECURE !== "true"
  ) {
    errors.push("COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.");
  }

  // Trusted proxy
  if (env.TRUST_PROXY?.trim()) {
    const hops = Number(env.TRUST_PROXY);

    if (!Number.isInteger(hops) || hops < 1 || hops > 5) {
      errors.push("TRUST_PROXY must be an integer between 1 and 5.");
    }
  }

  // Email configuration
  const emailVariables = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_PORT",
    "MAIL_FROM",
    "APP_BASE_URL",
  ];

  if (isProduction) {
    for (const key of emailVariables) {
      if (!env[key]?.trim()) {
        errors.push(`${key} is required in production.`);
      }
    }
  }

  if (env.SMTP_PORT && !isValidPort(env.SMTP_PORT)) {
    errors.push("SMTP_PORT must be an integer between 1 and 65535.");
  }

  if (
    env.SMTP_SECURE !== undefined &&
    !["true", "false"].includes(env.SMTP_SECURE.toLowerCase())
  ) {
    errors.push("SMTP_SECURE must be true or false.");
  }

  if (env.APP_BASE_URL?.trim() && !isValidUrl(env.APP_BASE_URL)) {
    errors.push("APP_BASE_URL must be a valid HTTP or HTTPS URL.");
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n- ${errors.join("\n- ")}`,
    );
  }
};
