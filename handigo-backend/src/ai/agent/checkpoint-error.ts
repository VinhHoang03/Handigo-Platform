import { AppError } from "../../utils/appError";

// Lỗi persistence phải thoát khỏi helper nghiệp vụ, không được chuyển thành kết quả có receipt.
export class AgentCheckpointError extends AppError {
  constructor(error: unknown) {
    super("Chưa lưu được tiến độ trợ lý. Vui lòng thử lại đúng yêu cầu đang xử lý.", error instanceof AppError ? error.statusCode : 500);
  }
}
