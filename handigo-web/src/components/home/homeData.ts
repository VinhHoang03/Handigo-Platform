export const categories = [
  { icon: 'bolt', title: 'Sửa điện', desc: 'Lắp đặt, khắc phục sự cố điện', color: 'primary' },
  { icon: 'water_drop', title: 'Sửa nước', desc: 'Sửa rò rỉ, thông tắc đường ống', color: 'secondary' },
  { icon: 'ac_unit', title: 'Máy lạnh', desc: 'Vệ sinh, nạp gas, sửa máy lạnh', color: 'tertiary' },
  { icon: 'cleaning_services', title: 'Vệ sinh', desc: 'Vệ sinh nhà cửa, thảm, sofa', color: 'primary' },
  { icon: 'kitchen', title: 'Gia dụng', desc: 'Sửa tủ lạnh, máy giặt, lò vi sóng', color: 'secondary' },
  { icon: 'router', title: 'Internet/Wifi', desc: 'Cài đặt, tối ưu hóa mạng wifi', color: 'tertiary' },
  { icon: 'videocam', title: 'Camera', desc: 'Lắp đặt, sửa chữa camera an ninh', color: 'primary' },
  { icon: 'format_paint', title: 'Sơn sửa nhà', desc: 'Sơn nước, bả tường, trang trí', color: 'secondary' },
];

const providerImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYIAvzP5vKq0dj-aTyphUu9WU6u18hwNOF4UNrDsBlDdN4BHsGTMRcDNc6VEakzuAeM3SA3rCMGwdWKbSeGZ2wl__H07QQ1Smutoqb8lfSj4wQoUShpuR77GhIpODN2ShF1PQQVn01GBpbVWseaRoCSpGYIwD8iyDHHZFB0z4MEbc40sk6xtxnBEY2jh55VMWAC6IrFMNiCduW-GXTsJSvcoKFrfBMqXl6F36r7pbIFg6cPzjExYrtoMV9BeRvp0m6aAO0Hf8brGE';

export const providers = [
  { name: 'Nguyễn Văn An', category: 'Sửa điện', rating: '4.9', dist: '1.2km', tags: ['Lắp mạch', 'Sửa điều hòa'], img: providerImage, catColor: 'secondary-container' },
  { name: 'Trần Thị Minh', category: 'Sửa nước', rating: '5.0', dist: '0.8km', tags: ['Dò rò rỉ', 'Thông cống'], img: providerImage, catColor: 'primary-container' },
  { name: 'Lê Hoàng Nam', category: 'Vệ sinh', rating: '4.8', dist: '3.5km', tags: ['Giặt sofa', 'Vệ sinh sâu'], img: providerImage, catColor: 'secondary-container' },
  { name: 'Phạm Quốc Bảo', category: 'Gia dụng', rating: '4.9', dist: '2.1km', tags: ['Sửa tủ lạnh', 'Tivi'], img: providerImage, catColor: 'primary-container' },
];

export const features = [
  { icon: 'map', title: 'Theo dõi thời gian thực', desc: 'Theo dõi thợ di chuyển đến nhà bạn trên bản đồ theo thời gian thực.', color: 'primary' },
  { icon: 'verified_user', title: 'Đối tác đã xác minh', desc: '100% thợ được kiểm tra lý lịch và kỹ năng chuyên môn khắt khe.', color: 'secondary', fill: true },
  { icon: 'payments', title: 'Thanh toán an toàn', desc: 'Thanh toán an toàn qua ứng dụng, minh bạch giá cả, không phụ phí.', color: 'tertiary' },
  { icon: 'support_agent', title: 'Hỗ trợ 24/7', desc: 'Đội ngũ hỗ trợ luôn sẵn sàng giải quyết mọi vấn đề của bạn.', color: 'primary' },
];

export const stats = [
  { val: '10,000+', label: 'Khách hàng tin dùng' },
  { val: '2,000+', label: 'Thợ chuyên nghiệp' },
  { val: '50,000+', label: 'Việc đã hoàn thành' },
];

export const testimonials = [
  { quote: 'Dịch vụ tuyệt vời! Thợ đến đúng giờ, làm việc rất chuyên nghiệp và sạch sẽ.', name: 'Chị Lan Anh', loc: 'Quận 7, TP.HCM', img: providerImage, hasQuoteIcon: true },
  { quote: 'Ứng dụng rất dễ dùng, tìm thợ điện nhanh bất ngờ. Giá cả minh bạch nên rất yên tâm.', name: 'Anh Minh Đức', loc: 'Quận Cầu Giấy, Hà Nội', img: providerImage },
  { quote: 'Đội ngũ thợ rất lịch sự và tận tâm. Rất đáng 5 sao!', name: 'Chị Thu Thủy', loc: 'Quận Hải Châu, Đà Nẵng', img: providerImage },
];
