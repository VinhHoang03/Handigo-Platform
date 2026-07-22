/**
 * Primitive skeleton dùng chung.
 *
 * Nguyên tắc: skeleton phải bám theo hình dạng của nội dung thật sắp thay thế nó,
 * nếu không thì lúc dữ liệu về layout sẽ nhảy. Vì vậy chỉ cung cấp khối cơ bản,
 * còn hình dạng cụ thể do từng nơi tự ghép.
 */

type SkeletonProps = {
  className?: string;
  /** Dùng `rounded-full` cho avatar, `rounded-xl` cho ảnh/thẻ. */
  rounded?: string;
};

export const Skeleton = ({
  className = 'h-4 w-full',
  rounded = 'rounded',
}: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={`animate-pulse bg-surface-container-high ${rounded} ${className}`}
  />
);

/** Vài dòng chữ giả; dòng cuối ngắn hơn cho giống đoạn văn thật. */
export const SkeletonText = ({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton
        key={index}
        className={`h-3 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

/**
 * Bọc skeleton trong vùng có `aria-busy` để trình đọc màn hình biết đang tải,
 * thay vì đọc ra một mớ khối rỗng vô nghĩa.
 */
export const SkeletonRegion = ({
  children,
  label = 'Đang tải nội dung',
}: {
  children: React.ReactNode;
  label?: string;
}) => (
  <div role="status" aria-busy="true" aria-label={label}>
    {children}
  </div>
);
