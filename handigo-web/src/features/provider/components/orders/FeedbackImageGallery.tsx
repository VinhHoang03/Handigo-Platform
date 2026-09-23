import { ReliableImage } from '@/components/common/ReliableImage';

export function FeedbackImageGallery({ images, onPreview }: { images: string[]; onPreview: (url: string) => void }) {
  if (!images.length) return null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {images.map((image, index) => (
        <button
          key={`${image}-${index}`}
          type="button"
          onClick={() => onPreview(image)}
          className="group aspect-square overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low focus:outline-none focus:ring-4 focus:ring-primary/20"
          aria-label={`Xem ảnh ${index + 1}`}
        >
          <ReliableImage
            src={image}
            alt={`Ảnh đánh giá ${index + 1}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </button>
      ))}
    </div>
  );
}
