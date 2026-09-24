import { AppError } from "./appError";

// Chỉ ném trước khi ghi tác vụ chính; agent được phép lập lại bản xác nhận.
export class ActionPreconditionError extends AppError {
  constructor(message = "Thông tin hoặc chi phí đã thay đổi. Vui lòng kiểm tra và xác nhận lại.") { super(message, 409); }
}
