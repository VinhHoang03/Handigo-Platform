import type { ClientSession } from "mongoose";

// Chỉ truyền nội bộ từ tác vụ AI; không lấy tùy chọn này từ request của client.
export interface AutomatedReviewContext {
  beforeWrite(session: ClientSession): Promise<void>;
  assessmentId: string;
  complaintAction?: "intake" | "request_evidence";
  afterWrite?(session: ClientSession): Promise<void>;
}

export interface AssistedComplaintReview {
  beforeWrite(session: ClientSession): Promise<void>;
  afterWrite?(session: ClientSession): Promise<void>;
}
