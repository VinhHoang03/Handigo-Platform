import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DataTable, type DataTableColumn } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/Toast";
import { voucherApi } from "../../api/voucher.api";
import type { AdminRewardOffer } from "../../types/voucher.types";
import { getErrorMessage, money } from "./promotion-format";

type OfferForm = {
  id: string; name: string; points: string; discountValue: string;
  minOrderAmount: string; maxDiscountAmount: string;
  discountType: AdminRewardOffer["discountType"];
  applicableOrderType: AdminRewardOffer["applicableOrderType"];
  isActive: boolean;
};
const emptyForm: OfferForm = {
  id: "", name: "", points: "300", discountValue: "", minOrderAmount: "0", maxDiscountAmount: "",
  discountType: "AMOUNT", applicableOrderType: "fixed_price", isActive: true,
};
const inputClass = "w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";

export function RewardOffersPanel() {
  const { addToast } = useToast();
  const [offers, setOffers] = useState<AdminRewardOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setOffers(await voucherApi.rewardOffers()); }
    catch (failure) { setError(getErrorMessage(failure)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const edit = (offer: AdminRewardOffer) => {
    setForm({ ...offer, points: String(offer.points), discountValue: String(offer.discountValue),
      minOrderAmount: String(offer.minOrderAmount), maxDiscountAmount: offer.maxDiscountAmount == null ? "" : String(offer.maxDiscountAmount) });
    setMode("edit");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (mode === "create" && offers.some((offer) => offer.id === form.id)) {
      addToast("Mã gói đã tồn tại. Vui lòng chọn mã khác.", "error"); return;
    }
    setBusy(true);
    try {
      const { maxDiscountAmount, ...values } = form;
      await voucherApi.saveRewardOffer({ ...values,
        points: Number(form.points), discountValue: Number(form.discountValue), minOrderAmount: Number(form.minOrderAmount),
        ...(maxDiscountAmount.trim() ? { maxDiscountAmount: Number(maxDiscountAmount) } : {}),
      });
      setMode(null); addToast("Đã lưu gói đổi điểm. Cấu hình mới áp dụng cho các lần đổi tiếp theo.", "success");
      await load();
    } catch (failure) { addToast(getErrorMessage(failure), "error"); }
    finally { setBusy(false); }
  };
  const toggle = async (offer: AdminRewardOffer) => {
    if (busy) return;
    setBusy(true);
    try {
      await voucherApi.saveRewardOffer({ ...offer, isActive: !offer.isActive });
      addToast("Đã cập nhật trạng thái gói đổi điểm.", "success"); await load();
    } catch (failure) { addToast(getErrorMessage(failure), "error"); }
    finally { setBusy(false); }
  };
  const columns: DataTableColumn<AdminRewardOffer>[] = [
    { key: "name", header: "Gói đổi điểm", render: (offer) => <div><p className="font-semibold">{offer.name}</p><p className="mt-1 text-xs text-on-surface-variant">{offer.id}</p></div> },
    { key: "points", header: "Điểm đổi", render: (offer) => <strong className="text-primary">{offer.points.toLocaleString("vi-VN")} điểm</strong> },
    { key: "discount", header: "Ưu đãi", render: (offer) => <div><p>{offer.discountType === "PERCENT" ? `${offer.discountValue}%` : money.format(offer.discountValue)}</p>{offer.maxDiscountAmount != null && <p className="mt-1 text-xs text-on-surface-variant">Tối đa {money.format(offer.maxDiscountAmount)}</p>}</div> },
    { key: "scope", header: "Áp dụng", render: (offer) => <div><p>{offer.applicableOrderType === "variable_price" ? "Phí cọc đơn báo giá" : "Đơn giá cố định"}</p><p className="mt-1 text-xs text-on-surface-variant">Đơn từ {money.format(offer.minOrderAmount)}</p></div> },
    { key: "status", header: "Trạng thái", render: (offer) => offer.isActive ? "Đang mở đổi" : "Ngừng đổi" },
    { key: "actions", header: "Thao tác", render: (offer) => <div className="flex items-center gap-2"><button type="button" disabled={busy} onClick={() => edit(offer)} aria-label={`Sửa gói ${offer.name}`} className={`${buttonClass} text-primary hover:bg-primary/10`}><Pencil aria-hidden="true" size={18} /></button><button type="button" disabled={busy} onClick={() => void toggle(offer)} className={`${buttonClass} bg-surface-container-low`}>{offer.isActive ? "Tạm dừng" : "Mở đổi"}</button></div> },
  ];
  return <section className="space-y-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5" aria-labelledby="reward-offers-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="reward-offers-heading" className="text-lg font-bold">Gói đổi điểm thưởng</h2><p className="mt-1 text-sm text-on-surface-variant">Mã có hiệu lực 30 ngày từ khi đổi. Chỉnh sửa gói không thay đổi mã đã cấp cho khách.</p></div>
      <button type="button" disabled={busy || loading || Boolean(error)} onClick={() => { setForm(emptyForm); setMode("create"); }} className={`${buttonClass} bg-primary text-on-primary`}><Plus aria-hidden="true" size={18} />Thêm gói</button>
    </div>
    <AsyncState loading={loading} error={error} onRetry={load} skeleton={<TableSkeleton columns={6} rowCount={5} />}>
      <DataTable columns={columns} rows={offers} rowKey={(offer) => offer.id} minWidthClassName="min-w-[800px]" emptyState={<p className="p-5 text-center text-on-surface-variant">Chưa có gói đổi điểm.</p>} />
    </AsyncState>
    <Modal open={mode !== null} onClose={() => { if (!busy) setMode(null); }} title={mode === "edit" ? "Sửa gói đổi điểm" : "Thêm gói đổi điểm"} size="md" closeOnEsc={!busy} closeOnOverlayClick={!busy}>
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Mã gói<input required disabled={mode === "edit"} pattern="[A-Z0-9_-]{1,40}" maxLength={40} value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value.toUpperCase() })} className={`mt-1 ${inputClass}`} /></label>
          <label className="block text-sm font-semibold">Tên gói<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`mt-1 ${inputClass}`} /></label>
          <label className="block text-sm font-semibold">Loại đơn<select value={form.applicableOrderType} onChange={(event) => setForm({ ...form, applicableOrderType: event.target.value as OfferForm["applicableOrderType"] })} className={`mt-1 ${inputClass}`}><option value="fixed_price">Đơn giá cố định</option><option value="variable_price">Phí cọc đơn báo giá</option></select></label>
          <label className="block text-sm font-semibold">Loại giảm<select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value as OfferForm["discountType"] })} className={`mt-1 ${inputClass}`}><option value="AMOUNT">Số tiền</option><option value="PERCENT">Phần trăm</option></select></label>
          {([
            ["points", "Điểm cần đổi", 1, 1_000_000],
            ["discountValue", form.discountType === "PERCENT" ? "Mức giảm (%)" : "Mức giảm (đ)", 1, form.discountType === "PERCENT" ? 100 : 100_000_000],
            ["minOrderAmount", "Giá trị đơn tối thiểu (đ)", 0, 100_000_000],
            ["maxDiscountAmount", "Giảm tối đa (đ, để trống nếu không giới hạn)", 1, 100_000_000],
          ] as const).map(([key, label, min, max]) => {
            const cappedDeposit = key === "maxDiscountAmount" && form.applicableOrderType === "variable_price" && form.discountType === "PERCENT" && Number(form.discountValue) === 100;
            return <label key={key} className="block text-sm font-semibold">{label}<input type="number" required={key !== "maxDiscountAmount" || cappedDeposit} min={min} max={cappedDeposit ? 30000 : max} step={1} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={`mt-1 ${inputClass}`} /></label>;
          })}
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="accent-primary" />Cho phép khách đổi gói này</label>
        </fieldset>
        <p className="text-sm text-on-surface-variant">Gói giảm 100% phí cọc phải có mức giảm tối đa không quá 30.000đ.</p>
        <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setMode(null)} className={`${buttonClass} bg-surface-container-low`}>Hủy</button><button type="submit" disabled={busy} className={`${buttonClass} bg-primary text-on-primary`}>{busy ? "Đang lưu…" : "Lưu gói"}</button></div>
      </form>
    </Modal>
  </section>;
}
