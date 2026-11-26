/** Ẩn thông tin trình bày nội bộ, giữ dữ liệu gốc để chọn đúng đối tượng. */
export function agentDisplayText(value: string, hideSources = false) {
  const content = hideSources
    ? value.replace(/^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*)?(?:Nguồn(?: tham khảo)?|Tài liệu tham khảo)(?:\*\*)?[ \t]*[:：](?:\*\*)?[^\r\n]*(?:\r?\n(?![ \t]*(?:\r?\n|$))[^\r\n]*)*/gim, "").trim()
    : value;
  return content
    .replace(/(đơn)[ \t]+[a-f\d]{24}[ \t]+\(([^\r\n()]+)\)/gi, "$1 $2")
    .replace(/[ \t]*\([ \t]*(?:ID[ \t]*:[ \t]*)?[a-f\d]{24}[ \t]*\)/gi, "")
    .replace(/(dịch vụ|đơn hàng|đơn|chuyên gia|thợ|địa chỉ)[ \t]+(?:ID[ \t]*:?[ \t]*)?\b[a-f\d]{24}\b/gi, "$1 này")
    .replace(/\b(?:ID|serviceId|orderId|providerId|addressId)[ \t]*[:=][ \t]*[a-f\d]{24}\b/gi, "mục này")
    .replace(/\b[a-f\d]{24}\b/gi, "mục này");
}
