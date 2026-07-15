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

const getErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  statusCode: number,
) => {
  if (statusCode >= 500) {
    return fallbackMessage;
  }

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
  let statusCode = 500;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
  } else if (hasStatusCode(error)) {
    statusCode = error.statusCode as number;
  }

  return statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
};

export const sendControllerError = (
  res: Response,
  error: unknown,
  options: ControllerErrorOptions = {},
) => {
  const {
    includeCode = false,
    fallbackMessage = "Lỗi máy chủ nội bộ",
    invalidDataMessage = "Dữ liệu không hợp lệ",
  } = options;

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: invalidDataMessage,
      errors: error.issues,
    });
  }

  const statusCode = getErrorStatusCode(error);

  const body: {
    success: false;
    message: string;
    code?: unknown;
  } = {
    success: false,
    message: getErrorMessage(error, fallbackMessage, statusCode),
  };

  if (includeCode && statusCode < 500 && hasCode(error)) {
    body.code = error.code;
  }

  return res.status(statusCode).json(body);
};
