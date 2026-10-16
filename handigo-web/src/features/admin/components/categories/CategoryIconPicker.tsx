import { useId, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_COLORS,
  CATEGORY_ICON_GROUPS,
  DEFAULT_CATEGORY_ICON_COLOR,
  resolveCategoryIcon,
  searchCategoryIcons,
} from '@/components/common/category-icons';

interface CategoryIconPickerProps {
  icon: string;
  color: string;
  name: string;
  disabled: boolean;
  unavailableColors: Record<string, string>;
  onChange: (icon: string, color: string) => void;
}

export function CategoryIconPicker({ icon, color, name, disabled, unavailableColors, onChange }: CategoryIconPickerProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const searchId = useId();
  const groupId = useId();
  const selected = resolveCategoryIcon(icon, name);
  const previewColor = color || DEFAULT_CATEGORY_ICON_COLOR;
  const options = searchCategoryIcons(query, group);
  const colorConflict = unavailableColors[color.toLowerCase()];

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 disabled:opacity-60">
      <legend className="mb-2 text-sm font-semibold">Biểu tượng danh mục</legend>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border"
          style={{ backgroundColor: `${previewColor}0d`, borderColor: `${previewColor}30` }}
        >
          <CategoryIcon icon={selected.id} color={previewColor} className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-bold">{name.trim() || 'Tên danh mục'}</p>
          <p className="text-sm text-on-surface-variant">{selected.label}</p>
          <p className="mt-1 text-xs text-on-surface-variant">Nét icon và nền nhạt cùng tông màu.</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Màu biểu tượng</p>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_ICON_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={Boolean(unavailableColors[option.value])}
              title={unavailableColors[option.value] ? `Đã dùng cho danh mục ${unavailableColors[option.value]}` : option.label}
              aria-label={`Màu ${option.label.toLowerCase()}`}
              aria-pressed={color.toLowerCase() === option.value}
              onClick={() => onChange(selected.id, option.value)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-outline-variant/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-25"
              style={{ backgroundColor: `${option.value}15`, color: option.value }}
            >
              {color.toLowerCase() === option.value ? <Check size={20} aria-hidden="true" /> : <span className="h-4 w-4 rounded-full" style={{ backgroundColor: option.value }} />}
            </button>
          ))}
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-outline-variant/50 px-3 text-xs font-semibold">
            <input
              type="color"
              value={previewColor}
              onInput={(event) => onChange(selected.id, event.currentTarget.value)}
              className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Chọn màu tùy chỉnh"
            />
            Tùy chỉnh
          </label>
        </div>
        <p className="text-xs text-on-surface-variant">Mỗi danh mục dùng một mã màu riêng. Màu đã dùng sẽ bị khóa.</p>
        {colorConflict && <p role="alert" className="text-sm text-error">Mã màu {color} đã được dùng cho danh mục “{colorConflict}”. Vui lòng chọn màu khác.</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label htmlFor={searchId} className="mb-1 block text-xs font-semibold">Tìm biểu tượng</label>
          <div className="relative">
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-on-surface-variant" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Máy lạnh, nội thất, chuyển nhà..."
              className="h-11 w-full rounded-xl border border-outline-variant bg-surface pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <label htmlFor={groupId} className="mb-1 block text-xs font-semibold">Nhóm dịch vụ</label>
          <select id={groupId} value={group} onChange={(event) => setGroup(event.target.value)} className="h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Tất cả nhóm</option>
            {CATEGORY_ICON_GROUPS.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </div>
      </div>
      <p role="status" className="text-xs text-on-surface-variant">
        {options.length} / {CATEGORY_ICONS.length} biểu tượng · Tìm có dấu hoặc không dấu
      </p>
      <div className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-outline-variant/50 p-2">
        {options.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {options.map((option) => {
              const active = option.id === selected.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`Chọn biểu tượng ${option.label.toLowerCase()}`}
                  aria-pressed={active}
                  title={option.label}
                  onClick={() => onChange(option.id, color)}
                  className={`relative flex min-h-24 flex-col items-center gap-2 rounded-xl border p-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary ${active ? 'border-primary bg-primary/5' : 'border-transparent hover:border-outline-variant hover:bg-surface-container-low'}`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl border" style={{ backgroundColor: `${previewColor}0d`, borderColor: `${previewColor}30` }}>
                    <CategoryIcon icon={option.id} color={previewColor} className="h-6 w-6" />
                  </span>
                  <span className="text-[11px] font-medium leading-snug">{option.label}</span>
                  {active && <Check size={14} aria-hidden="true" className="absolute right-1 top-1 text-primary" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 p-6 text-center text-sm text-on-surface-variant">
            <p>Không tìm thấy biểu tượng phù hợp.</p>
            <button type="button" onClick={() => { setQuery(''); setGroup(''); }} className="inline-flex items-center gap-1 font-semibold text-primary">
              <X size={16} aria-hidden="true" /> Xóa bộ lọc
            </button>
          </div>
        )}
      </div>
    </fieldset>
  );
}
