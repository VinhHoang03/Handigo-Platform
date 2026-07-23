import { useState } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import { isImageUrl } from './service.helpers';
import { Image, Upload } from "lucide-react";

interface ImageInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  inputName?: string;
}

/** Ô nhập ảnh dịch vụ/tùy chọn — dán URL hoặc tải file lên. */
export function ImageInput({ value, onChange, label = 'Ảnh dịch vụ', inputName = 'service-image' }: ImageInputProps) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setMsg('');
    try {
      const uploaded = await categoryServiceApi.uploadImage(file);
      onChange(uploaded.url);
      setMsg('Đã tải ảnh lên.');
    } catch (err) {
      setMsg(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <Upload aria-hidden="true" size={18} />
          {uploading ? 'Đang tải…' : 'Chọn ảnh'}
          <input type="file" name={`${inputName}-file`} accept="image/*" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
      </div>
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
          {value && isImageUrl(value) ? (
            <img src={value} alt={`Xem trước ${label.toLowerCase()}`} width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            <Image aria-hidden="true" size={30} className="text-on-surface-variant" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="url"
            name={`${inputName}-url`}
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://example.com/anh-dich-vu…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <p aria-live="polite" className={`mt-1 text-xs ${msg.includes('lỗi') ? 'text-error' : 'text-on-surface-variant'}`}>
            {msg || 'Nhập URL hoặc chọn file từ máy.'}
          </p>
        </div>
      </div>
    </div>
  );
}
