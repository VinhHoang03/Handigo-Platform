type ErrorWithResponse = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export const getErrorMessage = (
  error: unknown,
  fallback = "Có lỗi xảy ra. Vui lòng thử lại.",
) => {
  if (typeof error === "object" && error) {
    const response = (error as ErrorWithResponse).response;
    const message = response?.data?.message?.trim();

    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};
