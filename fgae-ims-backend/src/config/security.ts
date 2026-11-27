const parseTrustProxy = (
  value: string | undefined,
): number | false => {
  if (!value || value.trim() === "") return false;

  const hops = Number(value);

  if (
    !Number.isInteger(hops) ||
    hops < 1 ||
    hops > 5
  ) {
    throw new Error(
      "TRUST_PROXY must be an integer between 1 and 5",
    );
  }

  return hops;
};

export const trustProxy = parseTrustProxy(
  process.env.TRUST_PROXY,
);