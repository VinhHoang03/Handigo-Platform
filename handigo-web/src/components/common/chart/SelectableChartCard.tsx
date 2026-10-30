import { memo, useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/utils/apiError";
import { ChartCard } from "./ChartCard";
import { ChartTypeMenu, type ChartTypeOption } from "./ChartTypeMenu";

function ChartContents<T>({ data, type, render, isEmpty }: { data: T; type: string; render: (data: T, type: string) => ReactNode; isEmpty: (data: T) => boolean }) {
  return isEmpty(data) ? <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">Chưa có dữ liệu trong kỳ đã chọn.</div> : render(data, type);
}
const MemoChartContents = memo(ChartContents) as typeof ChartContents;

/** Mỗi khung giữ kiểu hiển thị, dữ liệu làm mới và trạng thái tải riêng. */
export function SelectableChartCard<T>({ title, description, data, onReload, options, defaultType, storageKey, children, isEmpty }: {
  title: string;
  description?: string;
  data: T;
  onReload: () => Promise<T>;
  options: ChartTypeOption[];
  defaultType: string;
  storageKey: string;
  children: (data: T, type: string) => ReactNode;
  isEmpty: (data: T) => boolean;
}) {
  const preferenceKey = `handigo.admin.chart-type.${storageKey}`;
  const [type, setType] = useState(() => {
    try {
      const saved = window.localStorage.getItem(preferenceKey);
      return saved && options.some((option) => option.value === saved) ? saved : defaultType;
    } catch {
      return defaultType;
    }
  });
  const selectedType = options.some((option) => option.value === type) ? type : defaultType;
  const deferredType = useDeferredValue(selectedType);
  const switching = selectedType !== deferredType;
  const changeType = (value: string) => {
    if (!options.some((option) => option.value === value)) return;
    setType(value);
    try {
      window.localStorage.setItem(preferenceKey, value);
    } catch {
      // Vẫn cho phép đổi kiểu khi trình duyệt không cho lưu tùy chọn.
    }
  };
  const [refreshed, setRefreshed] = useState<{ source: T; value: T } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const requestRef = useRef(0);
  const currentData = refreshed?.source === data ? refreshed.value : data;

  useEffect(() => () => { requestRef.current += 1; }, []);

  const reload = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const value = await onReload();
      if (requestId === requestRef.current) setRefreshed({ source: data, value });
    } catch (requestError) {
      if (requestId === requestRef.current) setError(getErrorMessage(requestError, "Không thể làm mới biểu đồ. Vui lòng thử lại."));
    } finally {
      busyRef.current = false;
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  return (
    <ChartCard title={title} description={description}
      action={<div className="flex items-center gap-1">
        <button type="button" onClick={() => void reload()} disabled={loading}
          aria-label={`Làm mới biểu đồ: ${title}`} title="Làm mới biểu đồ"
          className="grid h-11 w-11 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">
          <RefreshCw size={18} aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
        </button>
        <ChartTypeMenu title={title} options={options} value={selectedType} onChange={changeType} />
      </div>}>
      <div aria-busy={loading || switching} className="min-w-0">
        <MemoChartContents data={currentData} type={deferredType} render={children} isEmpty={isEmpty} />
      </div>
      <span role="status" className="sr-only">{loading ? "Đang làm mới biểu đồ" : switching ? "Đang đổi kiểu biểu đồ" : ""}</span>
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </ChartCard>
  );
}
