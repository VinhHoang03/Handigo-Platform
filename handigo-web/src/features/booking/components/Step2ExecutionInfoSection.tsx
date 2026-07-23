import { AddressBookManager } from '@/features/profile/components/AddressBookManager';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { UserAddress } from '@/features/profile/types/profile.types';
import { MIN_DESCRIPTION_LENGTH } from './step2Helpers';
import { ImagePlus, Loader2, X } from "lucide-react";

interface Step2ExecutionInfoSectionProps {
  addressId?: string;
  isFromServiceDetail: boolean;
  addressError?: string;
  onSelectAddress: (address: UserAddress | null) => void;
  problemDescription: string;
  problemDescriptionError?: string;
  onChangeProblemDescription: (value: string) => void;
  customerAttachments: string[];
  isUploadingImages: boolean;
  uploadError: string | null;
  onUploadImages: (files: FileList | null) => void;
  onRemoveAttachment: (url: string) => void;
}

/** "Thông tin thực hiện": địa chỉ + mô tả tình trạng + ảnh hiện trạng. */
export const Step2ExecutionInfoSection = ({
  addressId, isFromServiceDetail, addressError, onSelectAddress,
  problemDescription, problemDescriptionError, onChangeProblemDescription,
  customerAttachments, isUploadingImages, uploadError, onUploadImages, onRemoveAttachment,
}: Step2ExecutionInfoSectionProps) => {
  const user = useAuthStore((state) => state.user);

  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-sm">
      <div className="mb-sm flex items-center justify-between gap-md">
        <h2 className="font-headline-sm text-headline-sm text-primary">Thông tin thực hiện</h2>
      </div>

      <div className="space-y-md">
        <div>
          <AddressBookManager
            compact
            selectable
            singleAddressMode={isFromServiceDetail}
            selectedAddressId={addressId}
            defaultRecipient={{
              name: user?.fullName || '',
              phone: user?.phone || '',
            }}
            onSelectAddress={onSelectAddress}
          />
          {addressError && (
            <p className="mt-xs text-xs font-medium text-error">{addressError}</p>
          )}
        </div>

        <div>
          <label htmlFor="problem-description" className="block font-bold mb-xs text-on-surface-variant text-xs uppercase tracking-wider">
            Mô tả tình trạng
          </label>
          <textarea
            id="problem-description"
            name="problemDescription"
            autoComplete="off"
            className="w-full p-sm rounded-2xl border border-outline-variant focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 outline-none min-h-[150px] text-body-md bg-surface-container-lowest"
            placeholder="Ghi chú chi tiết về tình trạng hoặc yêu cầu cụ thể…"
            value={problemDescription || ''}
            onChange={(event) => onChangeProblemDescription(event.target.value)}
          />
          {problemDescriptionError && (
            <p className="mt-xs text-xs font-medium text-error">{problemDescriptionError}</p>
          )}
          <p className="mt-xs text-[10px] text-on-surface-variant italic">
            Mô tả tối thiểu {MIN_DESCRIPTION_LENGTH} ký tự để provider nắm rõ tình trạng.
          </p>
        </div>
      </div>
      <div className="mt-md pt-md border-t border-outline-variant/30">
        <label className="block font-bold mb-xs text-on-surface-variant text-xs uppercase tracking-wider">
          Ảnh hiện trạng
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-sm">
          <label className={`aspect-[4/3] rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors group bg-surface-container-lowest ${isUploadingImages ? 'pointer-events-none opacity-60' : ''}`}>
            {isUploadingImages ? (
              <Loader2 aria-hidden="true" size={24} className="animate-spin text-primary" />
            ) : (
              <ImagePlus aria-hidden="true" size={24} className="text-primary transition-transform group-hover:scale-110" />
            )}
            <span className="mt-1 text-xs font-bold text-primary">
              {isUploadingImages ? 'Đang tải…' : 'Tải ảnh'}
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={isUploadingImages || customerAttachments.length >= 4}
              onChange={(event) => {
                onUploadImages(event.target.files);
                event.target.value = '';
              }}
            />
          </label>

          {customerAttachments.map((url) => (
            <div key={url} className="aspect-[4/3] rounded-2xl overflow-hidden relative group shadow-sm border border-outline-variant/30">
              <img src={url} className="w-full h-full object-cover" alt="Ảnh hiện trạng" />
              <button
                type="button"
                aria-label="Xóa ảnh hiện trạng"
                onClick={() => onRemoveAttachment(url)}
                className="absolute top-1 right-1 bg-black/55 text-on-primary rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X aria-hidden="true" size={12} />
              </button>
            </div>
          ))}
        </div>
        {uploadError && <p className="text-xs text-error mt-xs">{uploadError}</p>}
        <p className="text-[10px] text-on-surface-variant mt-xs italic">
          Tải lên tối đa 4 ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5MB. Ảnh nên thể hiện rõ thiết bị, máy móc hư hỏng hoặc khu vực cần sửa.
        </p>
      </div>
    </section>
  );
};
