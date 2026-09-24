import { Modal } from "@/components/common/Modal";
import type { PendingSave } from "./config-definitions";
import { formatValue } from "./system-config-format";

export function SaveConfirmModal({
  pendingSave,
  busy,
  onCancel,
  onConfirm,
}: {
  pendingSave: PendingSave | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!pendingSave) return null;

  const { item, payload } = pendingSave;

  return (
    <Modal
      open={Boolean(pendingSave)}
      title="Xác nhận lưu cấu hình"
      onClose={onCancel}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-on-surface-variant">
          Cấu hình này sẽ áp dụng cho dữ liệu phát sinh sau khi lưu. Kiểm tra
          lại giá trị trước khi xác nhận.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <CompareBlock
            label="Giá trị hiện tại"
            value={formatValue(item.currentValue, item.type, item.unit)}
          />
          <CompareBlock
            label="Giá trị mới"
            value={formatValue(payload.value, item.type, item.unit)}
          />
        </div>

        <div className="rounded-lg bg-surface-container-low p-3 text-sm">
          <p>
            <span className="font-semibold">Cấu hình:</span> {item.label}
          </p>
          <p>
            <span className="font-semibold">Key:</span>{" "}
            <span className="font-mono">{item.key}</span>
          </p>
          <p>
            <span className="font-semibold">Hiệu lực:</span> {item.effect}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl bg-surface-container-high px-5 py-2.5"
          >
            Kiểm tra lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50"
          >
            {busy ? "Đang lưu..." : "Xác nhận lưu"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CompareBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-outline-variant/30 p-3">
      <p className="mb-2 text-sm font-semibold text-on-surface">{label}</p>
      <code className="block max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-container-low px-3 py-2 text-sm tabular-nums text-on-surface">
        {value}
      </code>
    </div>
  );
}
