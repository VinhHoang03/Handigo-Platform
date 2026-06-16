import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type RequestSource = "body" | "params" | "query";

export const validate =
  (schema: ZodSchema<any>, source: RequestSource = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === "query") {
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          configurable: true,
        });
      } else {
        req[source] = parsed;
      }

      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues || error.errors,
      });
    }
  };
