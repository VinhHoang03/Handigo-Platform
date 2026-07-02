import type { AuthenticatedUser } from "./middlewares/authContext";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
