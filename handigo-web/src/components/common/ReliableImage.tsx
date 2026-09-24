import { useState, type ImgHTMLAttributes } from 'react';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { ImageOff } from "lucide-react";

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
        <ImageOff aria-hidden="true" size={30} className="opacity-50" />
      </div>
    );
  }

  return <img {...props} src={normalizedSrc} alt={alt} className={className} onError={() => setFailedSrc(normalizedSrc)} />;
}
