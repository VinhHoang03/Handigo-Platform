import { Plus, RefreshCw } from "lucide-react";

interface CaseManagementHeaderProps {
  loading: boolean;
  activeLabel: string;
  onRefresh: () => void;
  onCreate: () => void;
}

export function CaseManagementHeader({ loading, activeLabel, onRefresh, onCreate }: CaseManagementHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-primary">Trung tâm hỗ trợ</p>
        <h1 className="mt-1 text-headline-lg font-bold">Khiếu nại, hỗ trợ và báo cáo</h1>
        <p className="mt-2 max-w-3xl text-on-surface-variant">Theo dõi toàn bộ yêu cầu đã gửi và phản hồi trực tiếp khi quản trị viên cần thêm thông tin.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
        <button type="button" onClick={onCreate} className="btn-primary">
          <Plus size={18} /> {activeLabel === "Hỗ trợ" ? "Tạo yêu cầu" : `Tạo ${activeLabel.toLowerCase()}`}
        </button>
      </div>
    </header>
  );
}
