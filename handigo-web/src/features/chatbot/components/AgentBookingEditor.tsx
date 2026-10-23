import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import { bookingApi } from "@/features/booking/api/booking.api";
import { customerServiceApi } from "@/features/customer-service/api/customerService.api";
import { getErrorMessage } from "@/utils/apiError";
import type { Address, ServiceOption } from "@/types/booking";
import type { AgentBookingValues, AgentSend, AgentBookingAction } from "../types/agent.types";
import { composeFullAddress } from "@/features/profile/utils/addressLineParsing.utils";

export type AgentBookingEditMode = "quantity" | "address" | "payment";
const titles = { quantity: "Sửa số lượng", address: "Chọn địa chỉ thực hiện", payment: "Đổi phương thức thanh toán" };
const paymentLabels = { bank: "Chuyển khoản PayOS", wallet: "Ví Handigo", cash: "Tiền mặt" };
const inputClass = "min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";

export function AgentBookingEditor({ mode, values, preview, disabled, onClose, onSend, revision }: {
  mode: AgentBookingEditMode; values: AgentBookingValues; preview?: Record<string, unknown>;
  disabled: boolean; onClose: () => void; onSend: AgentSend; revision: number;
}) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [addressId, setAddressId] = useState(values.addressId ?? "");
  const [payment, setPayment] = useState(values.paymentMethod ?? "bank");
  const [quantity, setQuantity] = useState(String(values.uniformQuantity ?? preview?.quantity ?? 1));
  const [quantities, setQuantities] = useState<Record<string, string>>(Object.fromEntries(
    (values.selectedOptions ?? []).map((item) => [item.optionId, String(item.quantity)])));
  const needsLoad = mode === "address" || (mode === "quantity" && Boolean(values.selectedOptions?.length));
  const [loading, setLoading] = useState(needsLoad);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const selectedOptions = values.selectedOptions ?? [];
  const blocked = disabled || saving;

  useEffect(() => {
    if (!needsLoad) return;
    let active = true;
    const load = async () => {
      try {
        if (mode === "address") {
          const data = await bookingApi.getAddresses();
          if (active) setAddresses(data);
        } else if (values.serviceId) {
          const data = await customerServiceApi.options(values.serviceId);
          if (active) setOptions(data);
        } else throw new Error("Chưa xác định được dịch vụ. Hãy nhắn yêu cầu sửa số lượng cho trợ lý.");
      } catch (failure) {
        if (active) setLoadError(getErrorMessage(failure, "Chưa tải được thông tin. Vui lòng thử lại."));
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [attempt, mode, needsLoad, values.serviceId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || loading || loadError) return;
    setError("");
    let change: string;
    let patch: Extract<AgentBookingAction, { type: "update" }>["patch"];
    if (mode === "address") {
      const address = addresses.find((item) => item._id === addressId);
      if (!address) { setError("Vui lòng chọn một địa chỉ trong sổ địa chỉ."); return; }
      patch = { addressId: address._id };
      change = `Dùng địa chỉ ${composeFullAddress(address.fullAddress || address.detailAddress || "", address.ward, address.province)}${address.recipientName ? `; người nhận ${address.recipientName}` : ""}${address.recipientPhone ? `, ${address.recipientPhone}` : ""}${address.note ? `; ghi chú địa chỉ: ${address.note}` : ""}.`;
    } else if (mode === "payment") {
      patch = { paymentMethod: payment };
      change = `Đổi phương thức thanh toán sang ${paymentLabels[payment]}.`;
    } else {
      const valid = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 99;
      if (selectedOptions.length) {
        if (selectedOptions.some((item) => !valid(quantities[item.optionId] ?? ""))) {
          setError("Số lượng mỗi tùy chọn phải là số nguyên từ 1 đến 99."); return;
        }
        if (selectedOptions.some((item) => !options.some((option) => option._id === item.optionId))) {
          setError("Có tùy chọn không còn khả dụng. Hãy nhắn để trợ lý kiểm tra lại dịch vụ."); return;
        }
        change = `Đổi số lượng: ${selectedOptions.map((item) => {
          const option = options.find((candidate) => candidate._id === item.optionId)!;
          return `${option.selectionGroup ? `${option.selectionGroup} — ` : ""}${option.name}: ${quantities[item.optionId]}`;
        }).join("; ")}.`;
        patch = { selectedOptions: selectedOptions.map((item) => ({ optionId: item.optionId, quantity: Number(quantities[item.optionId]) })) };
      } else {
        if (!valid(quantity)) { setError("Số lượng phải là số nguyên từ 1 đến 99."); return; }
        change = `Đổi số lượng dịch vụ thành ${Number(quantity)}.`;
        patch = { quantity: Number(quantity) };
      }
    }
    setSaving(true);
    try {
      await onSend(change, undefined, { type: "update", revision, patch });
      onClose();
    } catch { setError("Chưa gửi được thay đổi. Dùng Thử lại trong chat để tiếp tục yêu cầu đã gửi."); }
    finally { setSaving(false); }
  };

  return <Modal open title={titles[mode]} size="sm" onClose={onClose}>
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm text-on-surface-variant">Trợ lý sẽ kiểm tra lại thông tin và gửi bản xác nhận mới.</p>
      {loading ? <p role="status" className="text-sm">Đang tải thông tin…</p> : loadError ? <div role="alert" className="space-y-2 text-sm text-error">
        <p>{loadError}</p><button type="button" className="min-h-11 underline" onClick={() => { setLoadError(""); setLoading(true); setAttempt((value) => value + 1); }}>Thử lại</button>
      </div> : mode === "address" ? addresses.length ? <label className="block space-y-2 text-sm"><span>Địa chỉ trong sổ địa chỉ</span>
        <select name="booking-address" autoComplete="off" value={addressId} onChange={(event) => setAddressId(event.target.value)} disabled={blocked} required className={inputClass}>
          <option value="" disabled>Chọn địa chỉ</option>
          {addresses.map((address) => <option key={address._id} value={address._id}>{composeFullAddress(address.fullAddress || address.detailAddress || "", address.ward, address.province)}{address.recipientName ? ` — ${address.recipientName}` : ""}{address.recipientPhone ? ` (${address.recipientPhone})` : ""}{address.note ? ` — ${address.note}` : ""}</option>)}
        </select></label> : <p className="text-sm text-on-surface-variant">Bạn chưa có địa chỉ. Bạn có thể nhắn địa chỉ mới để trợ lý hỗ trợ lưu và đặt lịch.</p>
      : mode === "payment" ? <fieldset disabled={blocked} className="space-y-2"><legend className="mb-2 text-sm font-semibold">Phương thức thanh toán</legend>
        {Object.entries(paymentLabels).filter(([key]) => key !== "cash" || preview?.serviceType !== "variable_price").map(([key, label]) => <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-outline-variant p-3 text-sm">
          <input type="radio" name="agent-edit-payment" value={key} checked={payment === key} onChange={() => setPayment(key as typeof payment)} />{label}
        </label>)}
        {preview?.serviceType === "variable_price" && <p className="text-xs text-on-surface-variant">Tiền cọc khảo sát thanh toán bằng chuyển khoản hoặc ví Handigo.</p>}
      </fieldset> : selectedOptions.length ? selectedOptions.map((item) => {
        const option = options.find((candidate) => candidate._id === item.optionId);
        return <label key={item.optionId} className="block space-y-2 text-sm"><span>{option?.name ?? "Tùy chọn không còn khả dụng"}</span>
          <input type="number" name={`quantity-${item.optionId}`} autoComplete="off" inputMode="numeric" min={1} max={99} step={1} required value={quantities[item.optionId] ?? ""} disabled={blocked || !option || !option.allowsQuantity}
            onChange={(event) => setQuantities((current) => ({ ...current, [item.optionId]: event.target.value }))} className={inputClass} />
          {option && !option.allowsQuantity && <span className="block text-xs text-on-surface-variant">Tùy chọn này giữ số lượng 1.</span>}</label>;
      }) : <label className="block space-y-2 text-sm"><span>Số lượng dịch vụ</span><input type="number" name="service-quantity" autoComplete="off" inputMode="numeric" min={1} max={99} step={1} required value={quantity} disabled={blocked} onChange={(event) => setQuantity(event.target.value)} className={inputClass} /></label>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm">Đóng</button>
        <button type="submit" disabled={blocked || loading || Boolean(loadError) || (mode === "address" && !addresses.length)} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">{saving ? "Đang gửi…" : "Gửi thay đổi"}</button></div>
    </form>
  </Modal>;
}
