/**
 * Chuẩn hoá URL ảnh trước khi đưa vào <img>.
 *
 * Ngoài việc nâng link Cloudinary lên https, hàm còn loại các giá trị "rác":
 * dữ liệu thực tế có bản ghi lưu avatar dưới dạng chuỗi "null"/"undefined"
 * (stringify nhầm ở phía ghi dữ liệu). Các chuỗi này là truthy nên nếu không
 * lọc sẽ sinh <img src="null"> — một request 404 tới URL tương đối vô nghĩa.
 *
 * Trả về chuỗi rỗng khi không có ảnh hợp lệ.
 */
const INVALID_VALUES = new Set(['null', 'undefined', 'NaN']);

export const normalizeImageUrl = (value?: string | null) => {
  const url = value?.trim();
  if (!url || INVALID_VALUES.has(url)) return '';
  if (/^\/\/res\.cloudinary\.com/i.test(url)) return `https:${url}`;
  if (/^res\.cloudinary\.com/i.test(url)) return `https://${url}`;
  return url.replace(/^http:\/\/res\.cloudinary\.com/i, 'https://res.cloudinary.com');
};
