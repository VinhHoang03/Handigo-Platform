const REQUIRED_PRODUCTION_ENV = [
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
] as const;

export const validateProductionConfig = () => {
  if (process.env.NODE_ENV !== "production") return;

  const missingVariables: string[] = REQUIRED_PRODUCTION_ENV.filter(
    (key) => !process.env[key]?.trim(),
  );
  const hasMongoUri = Boolean(
    process.env.MONGO_URI?.trim() || process.env.MONGODB_URI?.trim(),
  );
  const hasFrontendUrl = Boolean(
    process.env.FRONTEND_URL?.trim() || process.env.FRONTEND_URLS?.trim(),
  );

  if (!hasMongoUri) {
    missingVariables.push("MONGO_URI hoặc MONGODB_URI");
  }
  if (!hasFrontendUrl) {
    missingVariables.push("FRONTEND_URL hoặc FRONTEND_URLS");
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Thiếu biến môi trường production: ${missingVariables.join(", ")}.`,
    );
  }
};
