import { useEffect, useState, type RefObject } from "react";
import { BookingProviderPicker } from "@/features/booking/components/BookingProviderPicker";
import { BookingPickerPopover } from "@/features/booking/components/BookingPickerPopover";
import { BookingProviderDetails } from "@/features/booking/components/BookingProviderDetails";
import { customerServiceApi, type NearbyProvider } from "@/features/customer-service/api/customerService.api";
import { getErrorMessage } from "@/utils/apiError";
import type { AgentBookingValues, AgentSession, AgentSend } from "../types/agent.types";

export function AgentBookingProviders({ values, anchorRef, disabled, onClose, onSend, draftCandidates, revision }: {
  values: AgentBookingValues; anchorRef: RefObject<HTMLDivElement | null>; disabled: boolean;
  onClose: () => void; onSend: AgentSend; revision: number;
  draftCandidates?: NonNullable<AgentSession["bookingDraft"]>["providerCandidates"];
}) {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(Boolean(values.serviceId && values.addressId && draftCandidates === undefined));
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedOptions = values.selectedOptions ? JSON.stringify(values.selectedOptions) : undefined;
  useEffect(() => {
    if (!values.serviceId || !values.addressId || draftCandidates !== undefined) return;
    let active = true;
    customerServiceApi.nearbyProviders(values.serviceId, values.addressId, values.scheduledAt,
      undefined, undefined, undefined, selectedOptions).then((data) => {
      if (active) setProviders(data);
    }).catch((failure: unknown) => {
      if (active) setError(getErrorMessage(failure, "Chưa tải được danh sách chuyên gia. Đóng và mở lại để thử lại."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [values.addressId, values.serviceId, values.scheduledAt, selectedOptions, draftCandidates]);

  const choose = async (id?: string, name?: string) => {
    if (disabled || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSend(id
        ? `Tôi chọn chuyên gia ${name}.`
        : "Để hệ thống tự tìm thợ.", undefined,
        { type: "update", revision, patch: { preferredProviderId: id ?? null } });
      onClose();
    } catch { setError("Chưa gửi được lựa chọn. Dùng Thử lại trong chat để tiếp tục yêu cầu đã gửi."); }
    finally { setSaving(false); }
  };

  if (draftCandidates !== undefined) {
    const viewing = draftCandidates.find((item) => item.id === viewingId);
    if (viewing) return <BookingProviderDetails providerId={viewing.id} canSelect={!disabled && !saving}
      onClose={() => setViewingId(null)} onSelect={() => void choose(viewing.id, viewing.name)} />;
    return <BookingPickerPopover id="booking-provider-picker" title="Chọn chuyên gia" anchorRef={anchorRef} onClose={onClose} zIndex={180}>
      <p className="mb-3 text-xs text-on-surface-variant">Danh sách theo địa chỉ trong bản nháp; sẽ kiểm tra lại khi xác nhận đặt đơn.</p>
      {!draftCandidates.length ? <p className="text-sm text-on-surface-variant">Chưa có danh sách thợ phù hợp. Bạn có thể nhắn trợ lý kiểm tra lại thợ cho địa chỉ này.</p>
        : <div className="max-h-[min(50dvh,360px)] space-y-2 overflow-y-auto">
          <button type="button" disabled={disabled || saving} onClick={() => void choose()} className="min-h-11 w-full rounded-xl border border-outline-variant p-3 text-left text-sm disabled:opacity-50">Để hệ thống tự tìm chuyên gia</button>
          {draftCandidates.map((provider) => <div key={provider.id} className="rounded-xl border border-outline-variant p-3 text-sm">
            <p className="font-semibold">{provider.name}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{[
              provider.averageRating !== undefined ? `${provider.averageRating.toLocaleString("vi-VN")} sao` : "",
              provider.totalCompletedOrders !== undefined ? `${provider.totalCompletedOrders} đơn hoàn thành` : "",
              provider.distanceMeters !== undefined ? `${(provider.distanceMeters / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km` : "",
            ].filter(Boolean).join(" · ")}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={disabled || saving} onClick={() => setViewingId(provider.id)} className="min-h-11 flex-1 rounded-lg border border-outline-variant px-2 disabled:opacity-50">Xem hồ sơ</button>
              <button type="button" disabled={disabled || saving} onClick={() => void choose(provider.id, provider.name)} className="min-h-11 flex-1 rounded-lg bg-primary px-2 text-on-primary disabled:opacity-50">{provider.id === values.preferredProviderId ? "Đã chọn" : "Chọn thợ"}</button>
            </div>
          </div>)}
        </div>}
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </BookingPickerPopover>;
  }
  return <BookingProviderPicker anchorRef={anchorRef} providers={providers} preferredProviderId={values.preferredProviderId}
    initialProviderId={values.preferredProviderId} canSearch={Boolean(values.serviceId && values.addressId)}
    requireSelection={values.orderType === "scheduled"} isLoading={loading || disabled || saving} loadError={error}
    zIndex={180} showAutoAssignNote={false} onClose={onClose} onConfirm={(id, name) => void choose(id, name)} />;
}
