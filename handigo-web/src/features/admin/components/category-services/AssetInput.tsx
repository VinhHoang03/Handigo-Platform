import { useState } from 'react';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { getErrorMessage } from '@/utils/apiError';
import { categoryServiceApi } from '../../api/categoryService.api';
import { isImageUrl } from './category-service.helpers';
import { Image, Upload } from "lucide-react";

interface AssetInputProps {
  label: string;
  value: string;
  name?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mode: 'icon' | 'image';
}

/** Ô nhập icon danh mục hoặc ảnh dịch vụ, có thể dán URL hoặc tải file lên. */
export function AssetInput({ label, value, name, onChange, placeholder, mode }: AssetInputProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const uploaded = await categoryServiceApi.uploadImage(file);
      onChange(uploaded.url);
      setMessage('Đã tải ảnh lên.');
    } catch (err) {
      setMessage(getErrorMessage(err, 'Có lỗi xảy ra.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          <Upload aria-hidden="true" size={18} />
          {uploading ? 'Đang tải...' : 'Chọn ảnh'}
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
      </div>
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low text-primary">
          {mode === 'icon' ? (
            <CategoryIcon icon={value} name={name} className="h-8 w-8" imageClassName="h-9 w-9 object-contain" />
          ) : value && isImageUrl(value) ? (
            <img src={value} alt="Service" className="h-full w-full object-cover" />
          ) : (
            <Image aria-hidden="true" size={30} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className={`text-xs ${message.includes('lỗi') || message.includes('Could') ? 'text-error' : 'text-on-surface-variant'}`}>
              {message || 'Có thể nhập URL ảnh hoặc chọn file từ máy.'}
            </p>
            {value && (
              <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-error">
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
