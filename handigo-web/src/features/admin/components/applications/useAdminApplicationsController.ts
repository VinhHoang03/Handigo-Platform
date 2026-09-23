import { useEffect, useState } from "react";
import { useToast } from "@/components/common/Toast";
import type { Category } from "@/features/provider-application/types/providerApplication.types";
import { adminApi } from "../../api/admin.api";
import { useAdminList } from "../../hooks/useAdminList";
import type { AdminApplication, AdminQuery } from "../../types/admin.types";

/**
 * Toàn bộ state + hành động của trang duyệt hồ sơ thợ. Tách khỏi
 * `AdminProviderApplicationsPage` để trang chính chỉ còn lo bố cục.
 */
export function useAdminApplicationsController() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 });
  const { result, loading, error, load } = useAdminList("applications", query);
  const items = (result?.items || []) as AdminApplication[];
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    adminApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const closeModal = () => setSelected(null);

  const handleSelectApplication = (item: AdminApplication) => {
    if (!item.userId) {
      addToast("Không thể mở hồ sơ: Tài khoản người dùng không còn tồn tại", "error");
      return;
    }
    if (!item._id) {
      addToast("Không thể mở hồ sơ: Dữ liệu hồ sơ không hợp lệ", "error");
      return;
    }
    setSelected(item);
  };

  const review = async (status: "approved" | "rejected", rejectionReason?: string, notes?: string) => {
    if (!selected) return;
    if (status === "rejected" && (!rejectionReason || !notes)) return;
    try {
      setBusy(true);
      await adminApi.review(selected._id, status, rejectionReason, notes);
      closeModal();
      addToast(status === "approved" ? "Đã phê duyệt hồ sơ thành công" : "Đã từ chối hồ sơ", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi khi duyệt hồ sơ. Vui lòng thử lại.";
      addToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return {
    query,
    setQuery,
    items,
    loading,
    error,
    load,
    categories,
    selected,
    busy,
    closeModal,
    handleSelectApplication,
    onApprove: () => void review("approved"),
    onReject: (reason: string, notes: string) => void review("rejected", reason, notes),
    totalPages: result?.pagination.totalPages || 1,
  };
}
