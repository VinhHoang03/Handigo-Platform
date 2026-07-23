interface MaterialIconProps {
  children: string;
  className?: string;
  filled?: boolean;
}

/**
 * Icon Material Symbols.
 *
 * Luôn `aria-hidden`: Material Symbols hiển thị glyph bằng cách đặt *tên icon*
 * làm nội dung chữ của thẻ, nên nếu không ẩn thì trình đọc màn hình sẽ đọc
 * "tune", "apps", "search" như thể đó là nội dung. Nút chỉ có icon phải tự đặt
 * `aria-label` cho chính nó.
 */
export const MaterialIcon = ({ children, className = '', filled = false }: MaterialIconProps) => (
  <span
    aria-hidden="true"
    className={`material-symbols-outlined ${className}`}
    style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
  >
    {children}
  </span>
);
