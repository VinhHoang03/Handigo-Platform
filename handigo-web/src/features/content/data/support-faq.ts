/**
 * Nội dung câu hỏi thường gặp cho trang Hỗ trợ.
 *
 * Trước đây trang có ô tìm kiếm "Tìm kiếm câu hỏi thường gặp..." nhưng chỉ có ba
 * câu để tìm, lại giấu sau thao tác gõ — người dùng không biết là có gì để tìm.
 * Bộ này viết theo đúng bốn nhóm của `supportCategories` để các thẻ danh mục có
 * nơi trỏ tới.
 *
 * Mọi câu trả lời mô tả hành vi có thật của hệ thống. Không nêu quy tắc vận hành
 * nội bộ (ngưỡng duyệt rút tiền, logic phân công thợ, quy tắc chống gian lận).
 */

export type SupportFaqGroup =
  | "Tài khoản"
  | "Thanh toán"
  | "Dịch vụ"
  | "Lỗi kỹ thuật";

export interface SupportFaqItem {
  group: SupportFaqGroup;
  question: string;
  answer: string;
}

export const supportFaqs: SupportFaqItem[] = [
  {
    group: "Tài khoản",
    question: "Tôi đăng ký tài khoản Handigo bằng cách nào?",
    answer:
      "Bấm Đăng ký ở góc trên bên phải, khai báo email hoặc số điện thoại rồi đặt mật khẩu. Bạn cũng có thể đăng nhập bằng tài khoản Google hoặc Facebook nếu không muốn nhớ thêm mật khẩu.",
  },
  {
    group: "Tài khoản",
    question: "Quên mật khẩu thì lấy lại thế nào?",
    answer:
      "Ở màn hình đăng nhập, chọn Quên mật khẩu và nhập email đã đăng ký. Chúng tôi gửi liên kết đặt lại mật khẩu tới hộp thư đó. Liên kết chỉ dùng được một lần và sẽ hết hạn, nên hãy mở ngay khi nhận được.",
  },
  {
    group: "Tài khoản",
    question: "Tôi muốn trở thành thợ trên Handigo thì làm gì?",
    answer:
      "Đăng ký tài khoản rồi gửi hồ sơ ứng tuyển nhà cung cấp: thông tin cá nhân, giấy tờ tuỳ thân và các dịch vụ bạn nhận làm. Đội ngũ Handigo xét duyệt từng hồ sơ, và bạn xem được trạng thái duyệt ngay trong tài khoản.",
  },
  {
    group: "Tài khoản",
    question: "Đổi số điện thoại hoặc địa chỉ nhận dịch vụ ở đâu?",
    answer:
      "Mở trang Hồ sơ để sửa thông tin liên hệ. Địa chỉ được quản lý riêng trong Sổ địa chỉ, nơi bạn lưu nhiều địa chỉ và chọn một địa chỉ mặc định cho các đơn sau.",
  },
  {
    group: "Thanh toán",
    question: "Handigo nhận những hình thức thanh toán nào?",
    answer:
      "Bạn thanh toán bằng số dư ví Handigo, chuyển khoản ngân hàng qua mã QR, hoặc trả tiền mặt trực tiếp cho thợ tuỳ dịch vụ. Hình thức khả dụng hiển thị ngay ở bước xác nhận đơn.",
  },
  {
    group: "Thanh toán",
    question: "Huỷ đơn thì được hoàn lại bao nhiêu?",
    answer:
      "Đơn chưa có thợ nhận thì hoàn toàn bộ. Với đơn đã đặt lịch: huỷ trước giờ hẹn từ 24 giờ trở lên hoàn 100%, từ 6 đến dưới 24 giờ hoàn 80%, từ 2 đến dưới 6 giờ hoàn 50%, dưới 2 giờ hoàn 20%. Đơn thường và đơn gấp đã có thợ nhận hoàn 70%. Quá giờ hẹn thì không huỷ được, bạn cần gửi yêu cầu hỗ trợ.",
  },
  {
    group: "Thanh toán",
    question: "Tiền hoàn về đâu và mất bao lâu?",
    answer:
      "Tiền hoàn được cộng vào ví Handigo của bạn. Từ ví, bạn dùng cho đơn tiếp theo hoặc yêu cầu rút về tài khoản ngân hàng đã liên kết.",
  },
  {
    group: "Thanh toán",
    question: "Vì sao tôi phải trả trước một phần khi đặt đơn?",
    answer:
      "Một số dịch vụ yêu cầu đặt cọc để giữ lịch cho thợ. Khoản cọc được trừ thẳng vào tổng tiền khi hoàn tất công việc, không phải phụ phí.",
  },
  {
    group: "Dịch vụ",
    question: "Đặt một dịch vụ diễn ra thế nào?",
    answer:
      "Chọn dịch vụ, mô tả công việc kèm ảnh nếu có, chọn địa chỉ và thời gian. Thợ phù hợp xem yêu cầu và gửi báo giá. Bạn đồng ý rồi thợ mới bắt đầu, và bạn theo dõi trạng thái đơn suốt quá trình.",
  },
  {
    group: "Dịch vụ",
    question: "Tôi đổi lịch hẹn được không?",
    answer:
      "Mở chi tiết đơn và chọn thay đổi lịch, áp dụng khi thợ chưa bắt đầu công việc. Nếu đơn đã bắt đầu, hãy nhắn trực tiếp cho thợ trong đơn để thống nhất.",
  },
  {
    group: "Dịch vụ",
    question: "Làm sao liên hệ với thợ đang nhận đơn của tôi?",
    answer:
      "Sau khi đơn được nhận, khung trò chuyện mở ngay trong chi tiết đơn. Toàn bộ tin nhắn lưu lại trong đơn nên khi cần đối chiếu về sau vẫn tra được.",
  },
  {
    group: "Dịch vụ",
    question: "Công việc làm không đạt thì tôi khiếu nại ở đâu?",
    answer:
      "Gửi yêu cầu hỗ trợ ngay trong đơn, mô tả vấn đề và đính kèm ảnh. Yêu cầu có mã theo dõi, bạn xem được tiến độ xử lý và trao đổi với bộ phận hỗ trợ trong ứng dụng.",
  },
  {
    group: "Dịch vụ",
    question: "Đánh giá của tôi có ảnh hưởng gì không?",
    answer:
      "Điểm và nhận xét hiển thị công khai trên hồ sơ thợ, giúp khách sau chọn được người phù hợp. Thợ có thể phản hồi lại nhận xét của bạn.",
  },
  {
    group: "Lỗi kỹ thuật",
    question: "Trang bị lỗi hoặc tải mãi không xong thì làm sao?",
    answer:
      "Thử tải lại trang và kiểm tra kết nối mạng trước. Nếu vẫn lỗi, đăng xuất rồi đăng nhập lại để làm mới phiên. Còn lỗi nữa thì gửi yêu cầu hỗ trợ kèm ảnh chụp màn hình để chúng tôi tra đúng chỗ.",
  },
  {
    group: "Lỗi kỹ thuật",
    question: "Tôi không nhận được email xác nhận hay đặt lại mật khẩu?",
    answer:
      "Kiểm tra hộp thư rác và mục quảng cáo trước. Nếu vẫn không thấy sau vài phút, thử gửi lại yêu cầu, hoặc liên hệ tổng đài để chúng tôi kiểm tra địa chỉ email trên tài khoản.",
  },
  {
    group: "Lỗi kỹ thuật",
    question: "Tôi không nhận được thông báo về đơn của mình?",
    answer:
      "Thông báo hiển thị trong chuông ở thanh điều hướng. Nếu trình duyệt đang chặn thông báo cho trang, hãy mở phần cài đặt quyền của trình duyệt và cho phép lại.",
  },
];
