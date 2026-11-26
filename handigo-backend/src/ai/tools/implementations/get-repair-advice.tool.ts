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
    const queries = [...new Set(advice.cases.length ? advice.cases.flatMap((item) => item.serviceQueries) : advice.serviceQueries)];
    const services = new Map<string, { id: string; name: string; serviceType: string }>();
    let lookupFailed = false;
    // Tra danh mục độc lập với bài viết; thiếu nguồn kỹ thuật vẫn có thể gợi ý dịch vụ thật.
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
    const sourceStep = articles.length
      ? "Tư vấn theo đúng thứ tự từ articles vừa đọc: nêu nguyên nhân có thể khớp thiết bị/triệu chứng, sau đó đưa bước kiểm tra/khắc phục ban đầu an toàn và điều cần tránh, rồi mới giới thiệu dịch vụ. Không bỏ phần nguyên nhân mà bài hỗ trợ, không khẳng định chẩn đoán từ mô tả hoặc ảnh. Nếu bài chưa đủ căn cứ thì nói rõ phần chưa xác định; không bịa nguyên nhân hay cách sửa. Không liệt kê nguồn hoặc đường dẫn tham khảo trong câu trả lời."
      : `${newsLookup === "unavailable" ? "Chưa đọc được mục Mẹo sửa chữa" : "Chưa có bài phù hợp được công bố"}; nói rõ chưa có nguồn để hướng dẫn kỹ thuật chi tiết, không dùng nguyên nhân hoặc cách sửa từ dữ liệu cũ hay trí nhớ. Vẫn có thể đề xuất dịch vụ thật để thợ kiểm tra.`;
    const serviceStep = services.size
      ? "Giới thiệu ngắn dịch vụ phù hợp từ services bằng tên thật, giải thích dịch vụ giúp kiểm tra hoặc xử lý phần nào của triệu chứng; không dùng từ khóa thay tên dịch vụ. Hỏi khách có muốn tìm thợ phù hợp với dịch vụ này không; nếu khách đã yêu cầu tìm thợ hoặc đặt dịch vụ thì tiếp tục nhu cầu đó, không hỏi lại. Chỉ giới thiệu tên thợ và khả năng nhận việc sau khi tra cứu theo đúng dịch vụ, địa chỉ và thời gian; không hàm ý đã có thợ hoặc đã đặt đơn."
      : lookupFailed ? "Chưa đọc được danh mục dịch vụ; nói rõ và cho khách thử lại, không khẳng định hệ thống không có dịch vụ hoặc đã có thợ."
        : queries.length ? "Chưa tìm thấy dịch vụ phù hợp trong danh mục; nói rõ kết quả, không bịa dịch vụ hay thợ hoặc dùng dịch vụ vệ sinh thay sửa chữa."
          : "Chưa xác định được nhóm sự cố để tra danh mục. Nếu thiết bị/khu vực đã rõ, chuyển nhóm booking và dùng search_services với từ khóa ngắn từ mô tả thực tế; nếu chưa rõ thì hỏi thêm, không tự gán dịch vụ.";
    return { ...currentAdvice, services: [...services.values()].slice(0, 3),
      serviceLookup: lookupFailed ? "unavailable" : services.size ? "found" : queries.length ? "no_match" : "not_requested",
      nextStep: `${sourceStep} Chỉ hỏi tối đa hai thông tin chưa có. ${serviceStep} Khi khách chỉ hỏi tư vấn, dùng cách nói kiểm tra ban đầu, không nói trước khi thợ đến hoặc trong lúc chờ thợ. Chỉ chuẩn bị bản nháp để tìm thợ khi khách đồng ý; giữ mô tả thực tế của khách, không tự tạo đơn hoặc thanh toán.` };
  },
  reply: (result) => {
    const urgent = z.object({ status: z.literal("urgent"), message: z.string(),
      references: z.array(z.object({ title: z.string(), url: z.string().url() })) }).safeParse(result);
    if (!urgent.success) return undefined;
    return { state: "WAITING_USER_INPUT", message: urgent.data.message };
  },
};
