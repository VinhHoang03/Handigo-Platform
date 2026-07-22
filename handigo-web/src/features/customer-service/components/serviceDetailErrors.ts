/** Rút thông báo lỗi từ response API, ưu tiên lỗi validate đầu tiên nếu có. */
export const getErrorMessage = (
  error: unknown,
  fallback = "Không thể tải chi tiết dịch vụ.",
) => {
  const err = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Array<{ message?: string }>;
      };
    };
  };
  const validationMessage = err.response?.data?.errors?.find(
    (issue) => issue.message?.trim(),
  )?.message;
  return validationMessage || err.response?.data?.message || fallback;
};
