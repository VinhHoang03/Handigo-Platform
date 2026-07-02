import { Response } from "express";
import { ZodError } from "zod";
import { AppError } from "./appError";

type ErrorWithStatusCode = {
  statusCode?: number;
};

type ErrorWithMessage = {
  message?: string;
};

type ErrorWithCode = {
  code?: unknown;
};

export interface ControllerErrorOptions {
  includeCode?: boolean;
  fallbackMessage?: string;
  invalidDataMessage?: string;
}

const hasStatusCode = (error: unknown): error is ErrorWithStatusCode =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in error &&
  typeof error.statusCode === "number";

const hasCode = (error: unknown): error is ErrorWithCode =>
  typeof error === "object" && error !== null && "code" in error;

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ErrorWithMessage).message === "string" &&
    (error as ErrorWithMessage).message?.trim()
  ) {
    return (error as ErrorWithMessage).message as string;
  }

  return fallbackMessage;
};

const getErrorStatusCode = (error: unknown) => {
  if (error instanceof AppError) {
    return error.statusCode;
  }

  if (hasStatusCode(error)) {
    return error.statusCode as number;
  }

  return 500;
};

export const sendControllerError = (
  res: Response,
  error: unknown,
  options: ControllerErrorOptions = {},
) => {
  const {
    includeCode = false,
    fallbackMessage = "Có lỗi xảy ra",
    invalidDataMessage = "Dữ liệu không hợp lệ",
  } = options;

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: invalidDataMessage,
      errors: error.issues,
    });
  }

  const body: {
    success: false;
    message: string;
    code?: unknown;
  } = {
    success: false,
    message: getErrorMessage(error, fallbackMessage),
  };

  if (includeCode && hasCode(error)) {
    body.code = error.code;
  }

  return res.status(getErrorStatusCode(error)).json(body);
};
