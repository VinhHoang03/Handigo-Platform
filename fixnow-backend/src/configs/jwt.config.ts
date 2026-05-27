export const jwtConfig = {
  secret: process.env.JWT_SECRET || "supersecret",
  expiresIn: process.env.JWT_EXPIRES_IN || "1d"
};