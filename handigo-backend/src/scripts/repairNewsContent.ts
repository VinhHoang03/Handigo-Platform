import { repairCases, repairLimitations, repairReferences, repairReviewedAt, repairSafetyGuides, type RepairCase } from "../ai/knowledge/repair-cases";
import { REPAIR_NEWS_CATEGORY, repairTipSlug } from "../services/repairNews.service";
import { prepareNewsImport } from "./importNewsArticles";

export const normalizeRepairService = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
export function repairCaseMatchesService(item: RepairCase, serviceName: string) {
  const name = normalizeRepairService(serviceName);
  return item.serviceQueries.some((query) => normalizeRepairService(query).split(/\s+/).every((word) => name.includes(word)));
}

export function buildRepairNews(services: { name: string; coverImage?: string | null; image?: string | null }[], fallbackCover: string) {
  const publishedAt = new Date().toISOString();
  const rows = repairCases.flatMap((item) => {
    const matches = services.filter((service) => repairCaseMatchesService(item, service.name));
    if (!matches.length) return [];
    return [{ slug: repairTipSlug(item.id), origin: "new", publishedAt, title: item.title,
      excerpt: `${item.title}: nhận biết triệu chứng, những nguyên nhân có thể và cách giữ an toàn trước khi thợ đến.`,
      category: REPAIR_NEWS_CATEGORY, authorName: "Handigo", status: "published", isFeatured: false,
      coverImage: matches[0]?.coverImage || matches[0]?.image || fallbackCover,
      content: [
        { type: "paragraph", text: `Bài viết giúp bạn ghi nhận tình trạng và chuẩn bị trao đổi với thợ. ${repairLimitations} Mã lỗi và cách thao tác phụ thuộc hãng/model; không áp dụng mã của hãng này cho mọi thiết bị.` },
        { type: "heading", text: "Triệu chứng nhận biết" }, { type: "list", items: item.symptoms },
        { type: "heading", text: "Thông tin nên ghi lại" }, { type: "list", items: item.questions },
        { type: "heading", text: "Nguyên nhân có thể" }, { type: "list", items: item.possibleCauses },
        { type: "heading", text: "Xử lý an toàn trước khi thợ đến" }, { type: "list", items: item.safeActions },
        { type: "heading", text: "Những việc không nên tự làm" }, { type: "list", items: item.avoidActions },
        { type: "heading", text: "Khi nào cần thợ kiểm tra?" },
        { type: "paragraph", text: "Nếu tình trạng kéo dài, tái diễn hoặc có dấu hiệu nguy hiểm, dừng sử dụng và nhờ người có chuyên môn kiểm tra. Có khói, tia lửa hoặc nguy cơ điện giật thì ưu tiên an toàn, không bật lại để thử và không chờ lịch hẹn để xử lý nguy hiểm đang xảy ra." },
        { type: "paragraph", text: `Dịch vụ liên quan tại thời điểm biên tập: ${matches.map((service) => service.name).join(", ")}. Khả năng nhận đơn, phạm vi và chi phí cần được kiểm tra lại khi đặt. Nội dung được đối chiếu ngày ${repairReviewedAt}.` },
      ], sources: item.references.map((key) => ({ label: repairReferences[key].title, url: repairReferences[key].url })),
    }];
  });
  const safety = Object.entries(repairSafetyGuides).map(([id, guide]) => ({
    slug: repairTipSlug(`safety-${id}`), origin: "new", publishedAt, title: guide.title,
    excerpt: `Hướng dẫn giữ an toàn khi ${guide.title.toLowerCase()}, những thao tác cần tránh và thời điểm cần trợ giúp khẩn cấp.`,
    category: REPAIR_NEWS_CATEGORY, authorName: "Handigo", status: "published", isFeatured: false, coverImage: fallbackCover,
    content: [{ type: "paragraph", text: "Hướng dẫn này giúp ưu tiên an toàn khi gặp sự cố tại nhà, không thay thế lực lượng cứu nạn hoặc kỹ thuật viên." },
      { type: "heading", text: "Xử lý ngay khi có dấu hiệu nguy hiểm" }, { type: "paragraph", text: guide.message },
      { type: "heading", text: "Trước khi sử dụng lại" },
      { type: "paragraph", text: "Giữ thiết bị ngừng hoạt động cho tới khi được kiểm tra phù hợp. Không dùng việc hết mùi, đã khô hoặc bật lại được làm bằng chứng thiết bị đã an toàn." },
      { type: "paragraph", text: `Nguồn chính thức được đối chiếu ngày ${repairReviewedAt}.` }],
    sources: guide.references.map((key) => ({ label: repairReferences[key].title, url: repairReferences[key].url })),
  }));
  return prepareNewsImport([...rows, ...safety]);
}
