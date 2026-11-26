import { AiKnowledgeDocument } from "../../models/aiKnowledge.model";
import { withAgentTimeout } from "../agent/timeout";
import { builtinKnowledgeSources } from "./ingestion/builtin-sources";
import { prepareKnowledgeSource } from "./ingestion/chunker";
import { loadKnowledgeConfig } from "./knowledge.config";

const normalizeQuestion = (value: string) => value.normalize("NFC").toLocaleLowerCase("vi-VN")
  .trim().replace(/\s+/gu, " ").replace(/[.?!]+$/u, "").trimEnd();

// Chỉ khớp cả câu. Mỗi câu trả lời phải xuất hiện trong nguồn đã đối chiếu.
const entries = [
  {
    sourceKey: "handigo/customer/payment",
    answer: "Các phương thức gồm ví Handigo, chuyển khoản qua PayOS và tiền mặt tùy điều kiện của đơn.",
    questions: ["Handigo hỗ trợ thanh toán bằng cách nào?", "Handigo có những phương thức thanh toán nào?",
      "Có những cách thanh toán nào trên Handigo?", "Handigo hỗ trợ những phương thức thanh toán nào?"],
  },
  {
    sourceKey: "handigo/customer/booking",
    answer: "Xem các đơn tại Đơn của tôi.",
    questions: ["Xem đơn đã đặt ở đâu?", "Xem lịch sử đặt dịch vụ ở đâu?", "Xem đơn đã đặt trên Handigo ở đâu?"],
  },
  {
    sourceKey: "handigo/customer/support",
    answer: "Thông tin liên hệ công khai xem tại trang Hỗ trợ /ho-tro",
    questions: ["Liên hệ Handigo ở đâu?", "Xem thông tin liên hệ Handigo ở đâu?", "Tìm thông tin liên hệ hỗ trợ ở đâu?"],
  },
];

const sources = new Map(builtinKnowledgeSources().map((source) => [source.sourceKey, source]));
const questions = new Map(entries.flatMap((entry) => entry.questions.map((question) => [normalizeQuestion(question), entry] as const)));

export async function readBookingFaq(question: string, signal: AbortSignal): Promise<string | undefined> {
  const entry = questions.get(normalizeQuestion(question));
  if (!entry || signal.aborted) return undefined;
  const source = sources.get(entry.sourceKey);
  if (!source?.content.includes(entry.answer)) return undefined;
  if (process.env.AI_KNOWLEDGE_ENABLED !== "true") return entry.answer;

  try {
    const config = loadKnowledgeConfig();
    const { documentId, versionId, source: prepared } = prepareKnowledgeSource(source, config);
    const now = Date.now();
    if (Date.parse(prepared.effectiveFrom) > now || prepared.effectiveUntil && Date.parse(prepared.effectiveUntil) <= now) return undefined;

    // Kiểm tra bản công bố hiện tại mỗi lần trả lời, kể cả khi có nhiều tiến trình backend.
    const active = await withAgentTimeout(AiKnowledgeDocument.exists({
      _id: documentId, scope: "CUSTOMER_PUBLIC", status: "active",
      [`publications.${config.generation}`]: versionId,
    }).maxTimeMS(1000).exec(), signal, 1200);
    return active && !signal.aborted ? entry.answer : undefined;
  } catch {
    return undefined;
  }
}
