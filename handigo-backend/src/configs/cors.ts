const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "https://localhost:5173",
  "http://localhost:8081",
  "http://localhost:19006",
];

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, "");

export const getAllowedOrigins = () => {
  const configuredOrigins = [
    process.env.FRONTEND_URL || "",
    ...(process.env.FRONTEND_URLS || "").split(","),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  return Array.from(
    new Set([
      ...(process.env.NODE_ENV === "production" ? [] : LOCAL_ORIGINS),
      ...configuredOrigins,
    ]),
  );
};

export const isAllowedOrigin = (origin?: string) => {
  if (!origin) return true;
  return getAllowedOrigins().includes(normalizeOrigin(origin));
};
