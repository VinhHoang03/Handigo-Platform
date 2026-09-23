/** Rút gọn message lỗi để hiển thị cho người dùng, ưu tiên message từ API. */
export const getNotificationErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error
    ? error.message
    : "Có lỗi xảy ra, vui lòng thử lại.";
};
