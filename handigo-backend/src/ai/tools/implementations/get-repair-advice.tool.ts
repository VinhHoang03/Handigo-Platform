import { z } from "zod";
import { assessRepairDescription } from "../../knowledge/repair-advice";
import { AgentBookingService } from "../../../services/agentBooking.service";
import { withAgentTimeout } from "../../agent/timeout";
import type { AgentTool } from "../tool.interface";
import { searchRepairArticles } from "../../../services/repairNews.service";

const inputSchema = z.object({ description: z.string().trim().min(2).max(4000) }).strict();
export const getRepairAdviceTool: AgentTool<z.infer<typeof inputSchema>> = {
  name: "get_repair_advice",
  description: "Tư vấn sự cố thiết bị/dịch vụ tại nhà từ mô tả tiếng Việt, kể cả không dấu. Gửi đầy đủ thiết bị, triệu chứng và câu trả lời thực tế đã có; không tự thêm thông tin. Trả sàng lọc nguy hiểm, câu hỏi cần làm rõ, nguyên nhân có thể, xử lý an toàn, nguồn và dịch vụ thực tế nếu tìm được. Không chẩn đoán chắc chắn hoặc tạo đơn.",
  inputSchema, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: async (context, args) => {
    const advice = assessRepairDescription(args.description);
    if (advice.status === "urgent") return advice;
    let articles: Awaited<ReturnType<typeof searchRepairArticles>> = [];
    let newsLookup: "found" | "no_match" | "unavailable" = "no_match";
    try {
      articles = await withAgentTimeout(searchRepairArticles(args.description), context.signal, 4000);
      if (articles.length) newsLookup = "found";
    } catch {
      context.signal.throwIfAborted();
      newsLookup = "unavailable";
    }
    // Mô tả biên tập trong Tin tức là nguồn tư vấn hiện tại; không trả lại nguyên nhân cũ đã ẩn/xóa.
    const currentAdvice = { ...advice,
      cases: advice.cases.map(({ id, title, questions, serviceQueries }) => ({ id, title, questions, serviceQueries })),
      articles, newsLookup, knowledgeSource: "published_news",
      safetyNote: "Không tự tháo sửa hoặc thử lại thiết bị có dấu hiệu nguy hiểm; ưu tiên hướng dẫn an toàn.",
    };
    if (!articles.length) return { ...currentAdvice, services: [], serviceLookup: "not_requested",
      nextStep: newsLookup === "unavailable" ? "Chưa đọc được mục Mẹo sửa chữa; nói rõ chưa có nguồn hiện tại, không dùng nguyên nhân dự đoán từ dữ liệu cũ."
        : "Chưa có bài phù hợp được công bố; hỏi rõ triệu chứng còn thiếu, không bịa nguyên nhân hoặc dịch vụ." };
    const queries = [...new Set(advice.cases.flatMap((item) => item.serviceQueries))];
    const services = new Map<string, { id: string; name: string; serviceType: string }>();
    let lookupFailed = false;
    // Một lỗi danh mục không được làm mất hướng dẫn an toàn đã xác minh.
    for (const query of queries.slice(0, 4)) {
      context.signal.throwIfAborted();
      try {
        const matches = await withAgentTimeout(AgentBookingService.search(query), context.signal, 4000);
        for (const service of matches) services.set(service.id, { id: service.id, name: service.name, serviceType: service.serviceType });
        if (services.size >= 3) break;
      } catch {
        context.signal.throwIfAborted();
        lookupFailed = true;
        break;
      }
    }
    return { ...currentAdvice, services: [...services.values()].slice(0, 3),
      serviceLookup: lookupFailed ? "unavailable" : services.size ? "found" : "no_match",
      nextStep: "Dùng nội dung articles vừa đọc từ database để tư vấn và dẫn đường dẫn bài viết. Chỉ hỏi tối đa hai thông tin chưa có. Nêu nguyên nhân là khả năng; dùng tên/ID dịch vụ trong services, không dùng từ khóa thay cho dịch vụ có thật. Chỉ chuẩn bị đặt khi khách yêu cầu, giữ mô tả thực tế của khách." };
  },
  reply: (result) => {
    const urgent = z.object({ status: z.literal("urgent"), message: z.string(),
      references: z.array(z.object({ title: z.string(), url: z.string().url() })) }).safeParse(result);
    if (!urgent.success) return undefined;
    return { state: "WAITING_USER_INPUT", message: `${urgent.data.message}\n\nNguồn: ${urgent.data.references.map((source) => `${source.title}: ${source.url}`).join("; ")}` };
  },
};
