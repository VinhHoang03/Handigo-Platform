# Code Standards - handigo-web

Tài liệu này ghi các quy ước **đang được thi hành trong mã nguồn**, khác với
`handigo-web/DESIGN.md` (ý tưởng thiết kế ban đầu, một số phần đã lệch thực tế).
Khi hai tài liệu mâu thuẫn, tài liệu này đúng.

## Nguồn token duy nhất

Tailwind v4 (CSS-first). **Mọi** token nằm trong khối `@theme` của
`src/index.css`. Không có `tailwind.config.js` - v4 không đọc file đó.

Hệ quả quan trọng: **Tailwind chỉ sinh utility cho token đã khai báo.** Viết
`text-title-lg` khi chưa có `--text-title-lg` thì class đó không sinh CSS, phần
tử im lặng rơi về giá trị kế thừa. Build vẫn xanh, ESLint vẫn sạch. Trước khi
dùng một class token mới, kiểm nó có trong `index.css` chưa.

## Thang chữ

| Class | Cỡ / dòng | Dùng cho |
|---|---|---|
| `text-headline-xl` | 48/56 | Tiêu đề trang marketing |
| `text-headline-lg` | 32/40 | `h1` của trang |
| `text-headline-md` | 24/32 | `h2` mục lớn, số liệu nổi bật |
| `text-headline-sm` | 20/28 | `h3` trong thẻ |
| `text-title-lg` | 22/28 | Tiêu đề panel, tiêu đề bảng |
| `text-title-md` | 16/24 | Tiêu đề nhóm trong form |
| `text-body-lg` | 18/28 | Đoạn văn dẫn |
| `text-body-md` | 16/24 | Chữ thường (mặc định của `body`) |
| `text-label-md` | 14/20 | Nhãn nút, nhãn input |
| `text-label-sm` | 12/16 | Chú thích, nhãn phụ |

Heading dùng token, **không** dùng `text-lg` / `text-2xl` thô.

## Bo góc

Không có bậc "đúng" duy nhất; chọn theo **kích cỡ phần tử**:

| Bậc | Dùng cho |
|---|---|
| `rounded-full` | Pill, avatar, chip trạng thái, nút tròn |
| `rounded-3xl` / `rounded-2xl` | Panel, thẻ lớn, modal |
| `rounded-xl` | Nút, input, ô chọn |
| `rounded-lg` | Phần tử nằm trong thẻ |
| `rounded-md` | Chip nhỏ, thumbnail nhỏ, khối code |

Không ép một bậc duy nhất cho toàn trang: `rounded-xl` trên chip cao 20px trông
sai cỡ. Giá trị tuỳ ý (`rounded-[2px]`) chỉ dùng cho hình khối đặc biệt như mũi
tên tooltip.

## Màu trạng thái

Bảng màu mặc định của Tailwind (`emerald`, `amber`, `slate`, ...) **không được
dùng** - chúng nằm ngoài hệ token nên "đã hoàn thành" ở trang này không cùng màu
với "đã hoàn thành" ở trang khác.

- `src/utils/statusTone.ts` - 6 tông ngữ nghĩa (`success` `warning` `error`
  `info` `neutral` `brand`) × 4 biến thể (`toneChipClasses`, `toneOutlineClasses`,
  `toneTextClasses`, `toneBorderClasses`).
- `src/utils/orderStatus.ts` - nhãn tiếng Việt + tông cho trạng thái đơn dịch vụ.
  Dùng `getOrderStatusMeta(status)`; **không** tự viết lại bảng dịch trạng thái.

## Biểu đồ

Mọi biểu đồ đi qua `src/components/common/chart/`. **Không import `recharts`
trực tiếp trong page hay feature component** - lý do ở `phase-03` của plan
`260723-1632-admin-refactor-charts`: giữ thư viện nằm trong chunk lazy-load của
admin/provider, và giữ màu series buộc vào token M3.

## Bảng dữ liệu

Dùng `src/components/common/dashboard/DataTable.tsx`. Không viết `<table>` thô.
Nếu `DataTable` thiếu tính năng thì mở rộng nó, không quay lại bảng thủ công.

## Kích thước file

Tối đa 200 dòng mỗi file `.tsx`. **Dòng dài không phải cách lách** - dồn JSX vào
một dòng 3.000 ký tự đạt con số nhưng phá đúng mục đích của luật. Tách component
con thật.

## Chiều cao viewport

Dùng `min-h-dvh`, không dùng `min-h-screen` / `h-screen`. `100vh` trên iOS Safari
cao hơn vùng nhìn thấy nên sinh khoảng cuộn thừa khi thanh địa chỉ thu lại.
