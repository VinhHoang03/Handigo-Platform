import { Plus, X } from 'lucide-react';
import { FloatingInput } from '@/components/common/FloatingField';

interface Props {
  area: string;
  areas: string[];
  onAreaChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
}

export function WorkingAreasStep({ area, areas, onAreaChange, onAdd, onRemove }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Khu vực hoạt động</h2>
        <p className="mt-1 text-on-surface-variant">
          Nhập quận, huyện hoặc khu vực bạn nhận việc.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <FloatingInput
          id="provider-working-area"
          label="Ví dụ: Quận 1"
          value={area}
          onValueChange={onAreaChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <button type="button" onClick={onAdd} className="btn-primary sm:min-w-32">
          <Plus size={18} /> Thêm
        </button>
      </div>

      {areas.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {areas.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => onRemove(item)}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
            >
              {item} <X size={15} />
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-low p-4 text-sm text-on-surface-variant">
          Chưa có khu vực nào. Thêm ít nhất một khu vực để tiếp tục.
        </p>
      )}
    </section>
  );
}
