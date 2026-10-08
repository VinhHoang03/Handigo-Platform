import { ReliableImage } from '@/components/common/ReliableImage';
import { useEffect, useRef, useState } from 'react';
import { categoryServiceApi } from '../../api/categoryService.api';
import { ServiceImageCropModal } from './ServiceImageCropModal';

interface Props {
  coverImage: string;
  galleryImages: string[];
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onChange: (coverImage: string, galleryImages: string[]) => void;
}

export function ServiceImagesEditor({ coverImage, galleryImages, disabled, onBusyChange, onChange }: Props) {
  const [pending, setPending] = useState<{ image: HTMLImageElement; url: string; hash: string; target: 'cover' | 'gallery' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const changeRef = useRef(onChange);
  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  const hashes = useRef(new Map<string, string>());
  const dragged = useRef<number | null>(null);
  const mounted = useRef(true);
  const pendingUrl = useRef<string | null>(null);
  const locked = disabled || loading || !!pending;

  useEffect(() => { onBusyChange(loading || !!pending); }, [loading, pending, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current); };
  }, []);

  const cancel = () => {
    if (loading) return;
    if (pending) URL.revokeObjectURL(pending.url);
    pendingUrl.current = null;
    setPending(null);
  };
  const select = async (file: File | undefined, target: 'cover' | 'gallery') => {
    if (!file || locked) return;
    setError('');
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
      setError('Vui lòng chọn ảnh nguồn không quá 20 MB'); return;
    }
    if (target === 'gallery' && galleryImages.length >= 8) return;
    setLoading(true);
    let url: string | null = null;
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const previous = hashes.current.get(hash);
      if (previous && (galleryImages.includes(previous) || coverImage === previous)) throw new Error('Ảnh này đã được thêm');
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode().catch(() => { throw new Error('Không thể đọc ảnh. Vui lòng chọn ảnh JPEG, PNG, WebP, GIF hoặc AVIF hợp lệ'); });
      if (!mounted.current) { URL.revokeObjectURL(url); return; }
      pendingUrl.current = url;
      setPending({ image, url, hash, target });
    } catch (err) {
      if (url) URL.revokeObjectURL(url);
      if (mounted.current) setError(err instanceof Error ? err.message : 'Không thể đọc ảnh');
    } finally { if (mounted.current) setLoading(false); }
  };
  const upload = async (file: File) => {
    if (!pending || loading) return;
    setLoading(true);
    try {
      const asset = await categoryServiceApi.uploadServiceImage(file);
      if (!mounted.current) return;
      if (galleryImages.includes(asset.url) || coverImage === asset.url) throw new Error('Ảnh này đã được thêm');
      hashes.current.set(pending.hash, asset.url);
      if (pending.target === 'cover') changeRef.current(asset.url, galleryImages);
      else changeRef.current(coverImage, [...galleryImages, asset.url]);
      URL.revokeObjectURL(pending.url);
      pendingUrl.current = null;
      setPending(null);
    } finally { if (mounted.current) setLoading(false); }
  };
  const reorder = (from: number, to: number) => {
    if (locked || from === to || to < 0 || to >= galleryImages.length) return;
    const images = [...galleryImages];
    const [image] = images.splice(from, 1); images.splice(to, 0, image);
    onChange(coverImage, images);
  };
  const input = (target: 'cover' | 'gallery') => <label className={`inline-block rounded-lg border px-3 py-2 text-sm ${locked ? 'opacity-50' : 'cursor-pointer'}`}>
    {target === 'cover' ? 'Chọn ảnh bìa' : 'Thêm ảnh mô tả'}
    <input type="file" disabled={locked || (target === 'gallery' && galleryImages.length >= 8)} accept="image/*" className="sr-only"
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void select(file, target); }} />
  </label>;

  return <fieldset className="space-y-4 rounded-xl border border-outline-variant p-4">
    <legend className="px-2 font-bold">Ảnh dịch vụ</legend>
    <div>
      <p className="mb-2 font-semibold">Ảnh bìa / thumbnail</p>
      {coverImage && <ReliableImage src={coverImage} alt="Ảnh bìa dịch vụ" className="mb-2 aspect-video w-full rounded-lg bg-surface-container object-contain" />}
      {input('cover')}
      {coverImage && <button type="button" disabled={locked} onClick={() => onChange('', galleryImages)} className="ml-3 text-sm text-error">Xóa ảnh bìa</button>}
    </div>
    <div>
      <p className="mb-2 font-semibold">Ảnh mô tả · {galleryImages.length} / 8</p>
      <p className="mb-3 text-sm text-on-surface-variant">Kéo thả để đổi thứ tự, hoặc dùng nút trái / phải.</p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {galleryImages.map((url, index) => <div key={url} draggable={!locked}
          onDragStart={event => { dragged.current = index; event.dataTransfer.setData('text/plain', String(index)); event.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => { dragged.current = null; }}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
          onDrop={event => { event.preventDefault(); if (dragged.current !== null) reorder(dragged.current, index); dragged.current = null; }}>
          <ReliableImage draggable={false} src={url} alt={`Ảnh mô tả ${index + 1}`} className="aspect-video w-full rounded-lg bg-surface-container object-contain" />
          <div className="mt-1 flex items-center justify-between gap-2 text-sm">
            <button type="button" disabled={locked || index === 0} className="min-h-11 min-w-11 rounded-lg border disabled:opacity-40" aria-label={`Đưa ảnh ${index + 1} sang trái`} onClick={() => reorder(index, index - 1)}>←</button>
            <span>{index + 1}</span>
            <button type="button" disabled={locked || index === galleryImages.length - 1} className="min-h-11 min-w-11 rounded-lg border disabled:opacity-40" aria-label={`Đưa ảnh ${index + 1} sang phải`} onClick={() => reorder(index, index + 1)}>→</button>
            <button type="button" disabled={locked} className="min-h-11 min-w-11 rounded-lg border text-error" onClick={() => onChange(coverImage, galleryImages.filter((_, i) => i !== index))}>Xóa</button>
          </div>
        </div>)}
      </div>
      {input('gallery')}
    </div>
    {loading && !pending && <p role="status">Đang đọc ảnh…</p>}
    {error && <p role="alert" className="text-error">{error}</p>}
    {pending && <ServiceImageCropModal image={pending.image} busy={loading} onCancel={cancel} onConfirm={upload} />}
  </fieldset>;
}
