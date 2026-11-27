const parseOrigin = (value: string): string => {
  const candidate = value.trim();

  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid frontend origin: ${candidate}`);
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== candidate
  ) {
    throw new Error(
      `Frontend origins must contain only scheme and host: ${candidate}`,
    );
  }

  return parsed.origin;
};

export const parseAllowedOrigins = (value: string | undefined): string[] => {
  if (!value?.trim()) return [];

  return [
    ...new Set(
      value
        .split(",")
        .map(parseOrigin),
    ),
  ];
};

export const allowedOrigins = parseAllowedOrigins(
  process.env.CORS_ORIGINS,
);

if (
  process.env.NODE_ENV === "production" &&
  allowedOrigins.length === 0
) {
  throw new Error(
    "CORS_ORIGINS must be configured in production",
  );
}

export const isAllowedOrigin = (origin: string): boolean => {
  return allowedOrigins.includes(origin);
};