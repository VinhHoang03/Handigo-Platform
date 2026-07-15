const REQUIRED_PRODUCTION_ENV = [
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "CLOUDINARY_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "PAYOS_CLIENT_ID",
  "PAYOS_API_KEY",
  "PAYOS_CHECKSUM_KEY",
  "PAYOS_RETURN_URL",
  "PAYOS_CANCEL_URL",
  "PAYOS_WALLET_DEPOSIT_RETURN_URL",
  "PAYOS_WALLET_DEPOSIT_CANCEL_URL",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
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

  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT phải là số nguyên từ 1 đến 65535.");
  }
};
