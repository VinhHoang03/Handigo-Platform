import { Response } from "express";
import { ZodError } from "zod";
import { AppError } from "./appError";
import { httpErrorMessage } from "./httpErrorMessages";

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
    // Chỉ công khai thông báo nghiệp vụ có mã rõ ràng, không đưa lỗi kỹ thuật ra client.
    if (error instanceof AppError && error.code) return error.message;
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

  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
};

export const sendControllerError = (
  res: Response,
  error: unknown,
  options: ControllerErrorOptions = {},
) => {
  const {
    includeCode = false,
    fallbackMessage,
    invalidDataMessage = "Dữ liệu không hợp lệ",
  } = options;

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: invalidDataMessage,
      code: "VALIDATION_ERROR",
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
    message: getErrorMessage(error, fallbackMessage ?? httpErrorMessage(statusCode), statusCode),
    code: error instanceof AppError && error.code ? error.code : `HTTP_${statusCode}`,
  };

  if (includeCode && statusCode < 500 && hasCode(error) && error.code !== undefined) {
    body.code = error.code;
  }

  return res.status(statusCode).json(body);
};
