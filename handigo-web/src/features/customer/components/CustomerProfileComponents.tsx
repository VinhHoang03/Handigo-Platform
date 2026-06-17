import type { ReactNode } from 'react';
import type { Address } from '../types/customer.types';

interface ProfileSectionHeaderProps {
  icon: string;
  title: string;
  action?: ReactNode;
}

export const ProfileSectionHeader = ({ icon, title, action }: ProfileSectionHeaderProps) => (
  <div className="mb-5 flex items-center justify-between gap-3">
    <h3 className="flex items-center gap-2 font-headline-md text-headline-md">
      <span className="material-symbols-outlined text-primary">{icon}</span> {title}
    </h3>
    {action}
  </div>
);

interface AddressCardProps {
  address: Address;
  onEdit?: (address: Address) => void;
  onDelete?: (address: Address) => void;
  isActionDisabled?: boolean;
}

export const AddressCard = ({ address, onEdit, onDelete, isActionDisabled }: AddressCardProps) => {
  const title = address.note?.trim() || [address.ward, address.province].filter(Boolean).join(', ') || 'Địa chỉ';

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-3 transition hover:border-primary/30">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="material-symbols-outlined">location_on</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-label-md text-label-md font-bold">{title}</h4>
            {address.isDefault && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                Mặc định
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-label-sm text-on-surface-variant">
            {address.fullAddress}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface hover:text-primary disabled:opacity-40"
          disabled={isActionDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.(address);
          }}
          aria-label="Sửa địa chỉ"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface hover:text-error disabled:opacity-40"
          disabled={isActionDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(address);
          }}
          aria-label="Xóa địa chỉ"
        >
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    </div>
  );
};

export const ToggleOption = ({
  label,
  desc,
  icon,
  checked,
  color = 'bg-surface-container',
}: {
  label: string;
  desc: string;
  icon: string;
  checked?: boolean;
  color?: string;
}) => (
  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="font-label-md text-label-md font-bold">{label}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{desc}</p>
      </div>
    </div>
    <label className="relative inline-flex cursor-pointer items-center self-start sm:self-auto">
      <input type="checkbox" checked={checked} className="peer sr-only" onChange={() => {}} />
      <span className="h-6 w-11 rounded-full bg-outline-variant transition peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/15" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-gray-300 bg-white transition peer-checked:translate-x-full peer-checked:border-white" />
    </label>
  </div>
);
