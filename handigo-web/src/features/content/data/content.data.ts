import type { NewsContentBlock } from "../api/news.api";

export interface NewsArticle {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  image: string;
  content?: NewsContentBlock[];
}

export const newsArticles: NewsArticle[] = [
  {
    id: "bao-duong-dieu-hoa-tai-nha",
    category: "Mẹo sửa chữa",
    title: "Bí quyết bảo dưỡng điều hòa tại nhà hiệu quả và tiết kiệm điện",
    excerpt: "Những bước đơn giản giúp điều hòa hoạt động bền bỉ, làm lạnh tốt và giảm chi phí điện năng mỗi tháng.",
    date: "15/07/2026",
    readTime: "5 phút đọc",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuApTWKCLRA9GfoY3JJgnDQw4T4PThmhb4Jwm4k8EQ9xSWlxmy7k6VMNGlVM0HemUpcZeyUzt5PWCGG822byqENES4l8NSeA8qn3xy5bEtmTUeSzhfLfRilVzAXmtYKq_i8iM3yclOlds4hueR3PH1Y1HyyDbf62y7FzvZ11i_s6Nygyu1xIoQfMuNQP6GzfGmdsixjj36eQJl7UUedqEZrn4FEVmxE4N21fMfYuiLPS4KQgXO1Es2Klv87-9cFRTvJboXGMF8Zme7JP",
    content: [
      {
        type: "paragraph",
        text: "Việc bảo dưỡng điều hòa định kỳ không chỉ kéo dài tuổi thọ thiết bị mà còn giúp tiết kiệm đáng kể chi phí điện năng hằng tháng.",
      },
      {
        type: "heading",
        text: "Tại sao cần vệ sinh điều hòa thường xuyên?",
      },
      {
        type: "paragraph",
        text: "Màng lọc bên trong dàn lạnh sẽ bám bụi sau một thời gian sử dụng. Điều này cản trở luồng gió và tạo điều kiện cho vi khuẩn, nấm mốc phát triển.",
      },
      {
        type: "heading",
        text: "Các bước bảo dưỡng đơn giản tại nhà",
      },
      {
        type: "list",
        items: [
          "Ngắt hoàn toàn nguồn điện trước khi vệ sinh.",
          "Tháo lưới lọc bụi, rửa sạch và để khô tự nhiên.",
          "Loại bỏ lá cây và vật cản xung quanh dàn nóng.",
        ],
      },
      {
        type: "quote",
        text: "Không tự tháo linh kiện điện hoặc xử lý gas lạnh nếu không có dụng cụ chuyên dụng.",
      },
    ],
  },
  {
    id: "kiem-tra-he-thong-dien-mua-mua",
    category: "Mẹo sửa chữa",
    title: "5 cách kiểm tra hệ thống điện trước khi vào mùa mưa",
    excerpt: "Đảm bảo an toàn cho gia đình bằng những bước kiểm tra hệ thống điện cơ bản nhưng rất quan trọng.",
    date: "08/07/2026",
    readTime: "4 phút đọc",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA4YRwvqWIgklYySJBYBhj_o5OkKU8dVoL-9ErRQrkBV07RUs2Z1rPBzCy6H6tB8IB2Jty55dakrsYOPR9DTq733tWBp2Xx_pJGS7mvP00q_r1gO4rdFVZWPIL-HpxFsjBU-SeWR7XzN3h1Wnj3G6rZLHc4uzaC7ptWkFIYevWc7CJwq9lUMOYmyBZyUaXg4SdK9EReXgrQJnemJ3aG78xIxM_T6SGYiG14rdiUvk9n44ebRBR2BuNq-_Me9810fPZv_s0LNuCXAYBT",
  },
  {
    id: "nang-cap-bao-mat-tai-khoan",
    category: "Thông báo hệ thống",
    title: "Đăng nhập bằng Google và Facebook",
    excerpt: "Bạn có thể vào Handigo bằng tài khoản Google hoặc Facebook sẵn có, không cần nhớ thêm một mật khẩu nữa.",
    date: "20/06/2026",
    readTime: "4 phút đọc",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCVmg8mHTTOoF2XlHC7gir_ejjWmM6SUx1r_E7jUm13lyHkOPN-KcKAcboky4xDW69fpCFjbsQEpxaGYoB-oXKZvPjAr8mtqJSMMf0QltSwpPHmWNhSxv_36t3VcIls4Dv4Z-hvLV0Lc0VwBRbE3FqXb1gxeYorb8nvQDwL7Zfjm2v8AKfcFy4HX4cGoTMdYOfePnGaqlOmD5pZe7SrhTbMYVdRYWbTiQSZgfOkMZ8fQeIWzw9dqPN1aTZTTJjXsJ2FjtsHsC3yGzP7",
  },
  {
    id: "bo-dung-cu-gia-dinh",
    category: "Mẹo sửa chữa",
    title: "Bộ dụng cụ cần thiết mọi gia đình nên có",
    excerpt: "Hướng dẫn trang bị các dụng cụ sửa chữa cơ bản để chủ động xử lý những vấn đề nhỏ trong nhà.",
    date: "28/05/2026",
    readTime: "5 phút đọc",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDe683X5LRJ_LQ85u3q-rBCC9tvgVy5GvNzPrkq4CH4iBPLBQV1bT0xJRtxMkvAbNoBdC1_m0bUmtRjK3iuw9Ey_YdiMz_vG_YRKOqSFTd7nJziZKOg1hsMvJxI_mxoKZSZrWsSn6rDQlTb2tL5fkt-JwUVKozN1_5WNscqyByEmVVRW-Hrwv2j00I938pgQPV8Im2C9ZQhsKNCrUo-rM_8Ls6xzIffEJ5wDfoJ89vEh9rnBHm4UHg2xJ_43VOPa-viL5AIW-WjagV7",
  },
];

/**
 * Chỉ liệt kê danh mục thật sự có bài. "Khuyến mãi" và "Tin tức cộng đồng" đã gỡ
 * cùng hai bài viết bịa nội dung; danh mục mới sẽ tự xuất hiện khi có bài từ API.
 */
export const newsCategories = ["Tất cả", "Thông báo hệ thống", "Mẹo sửa chữa"];
