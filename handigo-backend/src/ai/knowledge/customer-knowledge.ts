import { REFUND_POLICY_VERSION } from "../../services/refundPolicy.service";

export const knowledgeTopics = ["overview", "booking", "payment", "cancellation", "complaint", "support", "account"] as const;
type Topic = typeof knowledgeTopics[number];
interface Article { topic: Topic; title: string; keywords: string; content: string; source: string; path: string }

// Nội dung customer đã đối chiếu với các module nguồn; cập nhật cùng nghiệp vụ khi chính sách thay đổi.
export const customerKnowledge: Article[] = [
  { topic: "overview", title: "Handigo và các chức năng dành cho khách hàng",
    keywords: "handigo là gì giới thiệu hệ thống chức năng trợ lý làm được gì thông tin cơ bản",
    content: "Handigo kết nối khách hàng với nhà cung cấp dịch vụ tại nhà. Khách có thể tìm dịch vụ, chọn tùy chọn, địa chỉ, đặt ngay hoặc đặt lịch, thanh toán, quản lý đơn và gửi hỗ trợ hoặc khiếu nại. Trợ lý hỗ trợ đặt/hủy đơn, kiểm tra thanh toán, tạo và tra cứu hỗ trợ, phản hồi hỗ trợ, tạo và tra cứu khiếu nại, giải đáp hướng dẫn. Thao tác ghi cần xác nhận bằng nút. Trợ lý chưa nhận tệp đính kèm; hãy dùng màn hình Hỗ trợ của tôi. Danh sách và số lượng dịch vụ phải lấy từ get_service_catalog, không suy ra từ bài hướng dẫn.",
    source: "Chức năng customer và danh sách tool Handigo", path: "/gioi-thieu" },
  { topic: "booking", title: "Đặt dịch vụ và quản lý đơn",
    keywords: "đặt dịch vụ đặt lịch đặt ngay booking địa chỉ giá báo giá dịch vụ sửa chữa chuyên gia thợ",
    content: "Chọn dịch vụ, tùy chọn và số lượng nếu có, địa chỉ đã lưu, thời gian và phương thức thanh toán. Giá và lịch khả dụng cần được kiểm tra bằng tool trước khi xác nhận. Tạo đơn thành công chưa có nghĩa đã thanh toán hoặc đã có chuyên gia nhận. Đơn hẹn cần chuyên gia xác nhận trước khi đủ điều kiện thanh toán. Với dịch vụ khảo sát, giá sửa chữa được báo sau khảo sát. Xem các đơn tại Đơn của tôi. Không có tool đổi lịch hoặc dự báo giờ chuyên gia đến; không cam kết đã thực hiện các chức năng này.",
    source: "Luồng đặt dịch vụ và thanh toán Handigo", path: "/customer/bookings" },
  { topic: "payment", title: "Phương thức thanh toán và tiền cọc",
    keywords: "thanh toán ví payos tiền mặt chuyển khoản ngân hàng qr cọc nạp tiền đã trả",
    content: "Các phương thức gồm ví Handigo, chuyển khoản qua PayOS và tiền mặt tùy điều kiện của đơn. Tạo đơn và thanh toán là hai lần xác nhận riêng. Dịch vụ khảo sát chỉ thu cọc qua PayOS hoặc ví; chi phí báo giá sau khảo sát thanh toán trực tiếp với nhà cung cấp. Khi ví không đủ, vào mục Ví để nạp hoặc chọn phương thức khả dụng khác trên cùng đơn. Khi khách báo đã trả tiền, phải dùng get_payment_status để kiểm tra; không xem lời nói hoặc ảnh chụp là xác nhận thanh toán. Không tự hứa thời gian tiền hoàn về.",
    source: "Quy trình thanh toán đơn dịch vụ Handigo", path: "/customer/wallet" },
  { topic: "cancellation", title: "Điều kiện hủy đơn và hoàn tiền",
    keywords: "chính sách hủy huỷ đơn hoàn tiền phí hủy hoàn cọc phần trăm",
    content: "Khách chỉ có thể hủy đơn ở trạng thái mới tạo hoặc đã nhận, còn phải thỏa điều kiện thời gian. Đơn mới tạo hoặc chưa có nhà cung cấp nhận được hoàn 100% số tiền đã thanh toán khi đủ điều kiện hủy. Đơn thường/gấp đã có người nhận: hoàn 70%. Đơn hẹn đã được nhận: trước giờ hẹn ít nhất 24 giờ hoàn 100%; từ 6 đến dưới 24 giờ hoàn 80%; từ 2 đến dưới 6 giờ hoàn 50%; trên 0 đến dưới 2 giờ hoàn 20%; đã đến giờ không được hủy theo luồng này. Đơn hẹn đã nhận nhưng thiếu giờ bắt đầu áp dụng mức 70%. Đơn đang thực hiện, hoàn thành hoặc đã hủy không được hủy lại. Hỏi số tiền của một đơn cụ thể phải dùng get_cancellation_preview, không tự tính và không gọi cancel_booking chỉ để xem phí. Chính sách hủy đơn không phải quyết định hoàn tiền khiếu nại.",
    source: `Chính sách hoàn tiền ${REFUND_POLICY_VERSION}`, path: "/customer/bookings" },
  { topic: "complaint", title: "Khiếu nại chất lượng dịch vụ",
    keywords: "chính sách khiếu nại chất lượng kém hỏng bồi thường tranh chấp bằng chứng 3 ngày",
    content: "Khách được khiếu nại đơn của mình đã hoàn thành, có nhà cung cấp thực hiện, trong vòng 3 ngày kể từ khi hoàn thành. Mỗi khách chỉ được tạo một khiếu nại cho một đơn; hủy khiếu nại không cho phép tạo lại. Cần chọn đúng đơn, tiêu đề và mô tả vấn đề; có thể bổ sung bằng chứng trong Hỗ trợ của tôi. Trợ lý tạo khiếu nại bằng văn bản sau xác nhận; chưa gửi ảnh/tệp qua chat. Có thể xem trạng thái, yêu cầu bổ sung bằng chứng và kết quả xử lý. Khiếu nại đã xử lý, từ chối hoặc hủy không thể hủy hay bổ sung bằng chứng. Việc gửi khiếu nại không đồng nghĩa được chấp nhận hoặc được hoàn tiền. Nếu chưa đủ điều kiện, giải thích và chỉ gửi yêu cầu hỗ trợ khi khách muốn.",
    source: "Quy trình khiếu nại dịch vụ Handigo", path: "/customer/support" },
  { topic: "support", title: "Gửi và theo dõi yêu cầu hỗ trợ",
    keywords: "hỗ trợ liên hệ hotline email tổng đài ticket lỗi kỹ thuật bảo mật phản hồi yêu cầu",
    content: "Khách có thể gửi yêu cầu về tài khoản, thanh toán, đơn dịch vụ, kỹ thuật, bảo mật, khiếu nại quyết định hoặc vấn đề khác. Cần tiêu đề 5–200 ký tự và mô tả 10–3000 ký tự. Có thể gửi yêu cầu không gắn đơn; nếu gắn đơn thì đơn phải thuộc khách. Độ ưu tiên mặc định là trung bình. Khách xem trạng thái và phản hồi, gửi phản hồi bổ sung hoặc hủy yêu cầu chưa kết thúc. Yêu cầu đã xử lý, đóng hoặc hủy không nhận phản hồi mới và không thể hủy. Tệp đính kèm được gửi tại màn hình Hỗ trợ của tôi. Chưa có thời hạn xử lý cam kết trong nguồn này; không hứa thời gian trả lời. Thông tin liên hệ công khai xem tại trang Hỗ trợ /ho-tro; không tự đưa số điện thoại hoặc email chưa được xác minh.",
    source: "Quy trình yêu cầu hỗ trợ Handigo", path: "/customer/support" },
  { topic: "account", title: "Tài khoản, hồ sơ và địa chỉ",
    keywords: "tài khoản hồ sơ địa chỉ mật khẩu quên mật khẩu otp đăng nhập đăng ký thông tin cá nhân",
    content: "Khách xem và cập nhật thông tin tại Hồ sơ, quản lý địa chỉ trong Sổ địa chỉ của hồ sơ. Quên mật khẩu: chọn Quên mật khẩu trên màn hình đăng nhập, nhập email đã đăng ký và thực hiện xác minh OTP gửi về email để đặt mật khẩu mới. Nếu không nhận được email, kiểm tra hộp thư rác và gửi yêu cầu hỗ trợ khi cần. Không cung cấp mật khẩu, OTP hoặc thông tin bí mật trong hội thoại. Trợ lý chỉ hướng dẫn, chưa thay đổi hồ sơ hoặc mật khẩu thay khách.",
    source: "Luồng tài khoản và hồ sơ khách hàng Handigo", path: "/customer/profile" },
];

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

export function searchCustomerKnowledge(query: string, topic?: Topic) {
  const words = [...new Set(normalize(query).split(/[^a-z0-9]+/).filter((word) => word.length > 2))];
  const matches = customerKnowledge.map((article) => ({ article,
    score: words.filter((word) => normalize(`${article.title} ${article.keywords}`).split(/[^a-z0-9]+/).includes(word)).length,
  })).filter(({ article, score }) => topic ? article.topic === topic : score > 0)
    .sort((a, b) => b.score - a.score).slice(0, 3).map(({ article: { keywords: _keywords, ...article } }) => article);
  return { articles: matches, availableTopics: customerKnowledge.map(({ topic, title }) => ({ topic, title })),
    note: "Chỉ trả lời phần được nguồn hỗ trợ. Đây là hướng dẫn sử dụng và chính sách nghiệp vụ đã tích hợp, không phải bộ điều khoản pháp lý đầy đủ. Không có thông tin thì nói chưa có nguồn và hướng dẫn gửi hỗ trợ; không suy ra bảo hành, bồi thường, thời hạn xử lý hay phạm vi phục vụ." };
}
