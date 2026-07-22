import { useState } from "react";
import { normalizeImageUrl } from "@/utils/imageUrl";

/**
 * Avatar dùng chung: ưu tiên ảnh thật, tự động lùi về chữ cái đầu khi thiếu ảnh
 * hoặc ảnh lỗi. Thay cho việc gọi ui-avatars.com — bỏ phụ thuộc CDN bên ngoài
 * và luôn ăn đúng màu theo design token.
 */

const toneClasses = [
  "bg-primary text-on-primary",
  "bg-secondary text-on-secondary",
  "bg-tertiary text-on-tertiary",
] as const;

/** Lấy tối đa 2 chữ cái đầu, ưu tiên tên riêng cuối theo cách gọi tiếng Việt. */
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Cùng một tên luôn cho ra cùng một màu, tránh nhấp nháy giữa các lần render. */
const getTone = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return toneClasses[hash % toneClasses.length];
};

type InitialsAvatarProps = {
  name: string;
  src?: string | null;
  className?: string;
  /** Cỡ chữ của phần chữ cái đầu; ảnh thật không bị ảnh hưởng. */
  textClassName?: string;
  rounded?: string;
};

export const InitialsAvatar = ({
  name,
  src,
  className = "h-12 w-12",
  textClassName = "text-sm",
  rounded = "rounded-full",
}: InitialsAvatarProps) => {
  const [failed, setFailed] = useState(false);
  const safeSrc = normalizeImageUrl(src);

  if (safeSrc && !failed) {
    return (
      <img
        src={safeSrc}
        alt={name}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className={`${className} ${rounded} bg-surface-container object-cover`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`${className} ${rounded} ${getTone(name)} ${textClassName} grid shrink-0 place-items-center font-semibold`}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
    </span>
  );
};
