import { useState, type ImgHTMLAttributes } from 'react';
import { normalizeImageUrl } from '@/utils/imageUrl';

interface ReliableImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
}

export function ReliableImage({ src, alt = '', className = '', ...props }: ReliableImageProps) {
  const normalizedSrc = normalizeImageUrl(src);
  const [failedSrc, setFailedSrc] = useState('');
  const failed = !normalizedSrc || failedSrc === normalizedSrc;

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-container-high text-on-surface-variant ${className}`} role="img" aria-label={alt}>
        <span className="material-symbols-outlined text-3xl opacity-50">image_not_supported</span>
      </div>
    );
  }

  return <img {...props} src={normalizedSrc} alt={alt} className={className} onError={() => setFailedSrc(normalizedSrc)} />;
}
