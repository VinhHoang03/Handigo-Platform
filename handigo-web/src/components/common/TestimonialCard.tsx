import { MaterialIcon } from './MaterialIcon';
import { InitialsAvatar } from './InitialsAvatar';

interface TestimonialCardProps {
  quote?: string;
  name: string;
  loc: string;
  img?: string | null;
  rating?: number;
  service?: string;
  performedAt?: string;
  providerReply?: string;
  hideAuthor?: boolean;
}

/**
 * Thẻ đánh giá dùng chung — vốn thuộc trang chủ (`components/home`) nhưng cũng
 * được trang thợ tái sử dụng để hiển thị đánh giá khách hàng. Đặt ở `common/`
 * để tách ràng buộc ngược giữa hai khu vực.
 */
export const TestimonialCard = ({ quote, name, loc, img, rating = 5, service, performedAt, providerReply, hideAuthor }: TestimonialCardProps) => (
  <figure className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-7">
    <div className="flex gap-0.5 text-tertiary" role="img" aria-label={`${rating} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((star) => (
        <MaterialIcon key={star} className={`text-base ${star < rating ? 'text-tertiary' : 'text-outline-variant'}`} filled={star < rating}>star</MaterialIcon>
      ))}
    </div>

    {quote && <blockquote className="mt-4 text-pretty font-body-md text-body-md text-on-surface">{quote}</blockquote>}

    <figcaption className="mt-6 flex items-center gap-3">
      {!hideAuthor && <InitialsAvatar name={name} src={img} className="h-11 w-11" textClassName="text-xs" />}
      <span className="min-w-0">
        {!hideAuthor && <span className="block truncate text-label-md font-semibold text-on-surface">{name}</span>}
        <span className="block truncate text-label-sm text-on-surface-variant">{loc}</span>
        {(service || performedAt) && <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{[service, performedAt].filter(Boolean).join(' · ')}</span>}
      </span>
    </figcaption>

    {providerReply && (
      <div className="mt-5 rounded-xl border-l-2 border-primary bg-primary/5 p-4">
        <p className="text-label-sm font-semibold text-primary">Phản hồi của thợ</p>
        <p className="mt-1 text-sm text-on-surface">{providerReply}</p>
      </div>
    )}
  </figure>
);
