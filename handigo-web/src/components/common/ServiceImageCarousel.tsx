import { useRef, useState } from 'react';
import { ReliableImage } from './ReliableImage';

interface Props { images?: string[]; coverImage?: string | null; name: string }
export function ServiceImageCarousel({ images = [], coverImage, name }: Props) {
  const slides = images.length ? images : coverImage ? [coverImage] : [];
  return <Carousel key={slides.join('|')} slides={slides} name={name} />;
}
function Carousel({ slides, name }: { slides: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const touch = useRef<number | null>(null);
  const move = (direction: number) => setIndex(current => (current + direction + slides.length) % slides.length);
  return <div role="region" aria-label={`Ảnh dịch vụ ${name}`} aria-roledescription="thư viện ảnh" className="relative overflow-hidden rounded-xl bg-surface-container">
    <div className="aspect-video w-full overflow-hidden"
      onTouchStart={event => { touch.current = event.touches[0].clientX; }}
      onTouchEnd={event => {
        if (touch.current !== null && slides.length > 1) {
          const distance = event.changedTouches[0].clientX - touch.current;
          if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1);
        }
        touch.current = null;
      }}
      onTouchCancel={() => { touch.current = null; }}>
      {slides.length ? <div className="flex h-full transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((url, i) => <div key={`${url}-${i}`} aria-hidden={i !== index} className="h-full w-full shrink-0">
          <ReliableImage src={url} alt={`${name} · ảnh ${i + 1}`} className="h-full w-full object-contain" loading={i === 0 ? 'eager' : 'lazy'} />
        </div>)}
      </div> : <ReliableImage alt="Dịch vụ chưa có ảnh" className="h-full w-full" />}
    </div>
    {slides.length > 1 && <>
      <button type="button" onClick={() => move(-1)} aria-label="Ảnh trước" className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-xl">‹</button>
      <button type="button" onClick={() => move(1)} aria-label="Ảnh tiếp theo" className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-xl">›</button>
      <p aria-live="polite" className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">{index + 1} / {slides.length}</p>
    </>}
  </div>;
}
