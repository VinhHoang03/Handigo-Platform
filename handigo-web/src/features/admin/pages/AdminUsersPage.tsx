import { useState } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { adminApi } from "../api/admin.api";
import { UserDetailModal } from "../components/users/UserDetailModal";
import { UserFilters } from "../components/users/UserFilters";
import { UserTable } from "../components/users/UserTable";
import { useAdminList } from "../hooks/useAdminList";
import type { AdminQuery, AdminUser } from "../types/admin.types";

export default function AdminUsersPage() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 });
  const { result, loading, error, load } = useAdminList("users", query);
  const users = (result?.items || []) as AdminUser[];
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const update = async () => {
    if (!target) return;
    try {
      setBusy(true);
      await adminApi.updateUserStatus(
        target._id,
        target.status === "active" ? "locked" : "active",
      );
      setTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <header>
        <h1 className="text-headline-lg font-bold">Quản lý người dùng</h1>
        <p className="text-on-surface-variant">
          Tìm kiếm, xem chi tiết và quản lý trạng thái tài khoản.
        </p>
      </header>
      <UserFilters query={query} onChange={setQuery} />
      <AsyncState
        loading={loading}
        error={error}
        empty={!users.length}
        emptyMessage="Không có người dùng phù hợp."
        onRetry={load}
      >
        <UserTable
          users={users}
          onView={setDetail}
          onToggleStatus={setTarget}
        />
      </AsyncState>
      <Pagination
        page={query.page || 1}
        totalPages={result?.pagination.totalPages || 1}
        onChange={(page) => setQuery({ ...query, page })}
      />
      <UserDetailModal user={detail} onClose={() => setDetail(null)} />
      <ConfirmDialog
        open={Boolean(target)}
        title={
          target?.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"
        }
        message="Bạn có chắc chắn muốn khóa tài khoản này không?

Người dùng sẽ không thể đăng nhập hoặc sử dụng các chức năng của hệ thống cho đến khi tài khoản được mở khóa lại."
        busy={busy}
        onCancel={() => setTarget(null)}
        onConfirm={update}
      />
    </DashboardShell>
  );
}
