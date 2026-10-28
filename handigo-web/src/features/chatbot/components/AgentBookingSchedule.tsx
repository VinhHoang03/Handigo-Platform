import { useEffect, useState, type RefObject } from "react";
import { BookingDateTimeDialog } from "@/features/booking/components/BookingDateTimeDialog";
import { getUpcomingDates } from "@/features/booking/components/step2Helpers";
import type { AgentSend } from "../types/agent.types";

// Dùng giờ trên mặt đồng hồ Việt Nam cho bộ chọn dùng Date địa phương.
const vietnamClock = (now: Date) => new Date(now.toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(" ", "T"));

export function AgentBookingSchedule({ anchorRef, scheduledAt, disabled, onClose, onSend, revision }: {
  anchorRef: RefObject<HTMLDivElement | null>; scheduledAt?: string; disabled: boolean;
  onClose: () => void; onSend: AgentSend; revision: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = vietnamClock(new Date(now));
  const selected = scheduledAt && Number.isFinite(Date.parse(scheduledAt))
    ? vietnamClock(new Date(scheduledAt)) : undefined;
  const selectedValue = selected ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}T${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}:00` : "";

  const submit = async (date?: string, time?: string) => {
    if (disabled || saving) return;
    setError("");
    if (date && time) {
      const value = Date.parse(`${date}T${time}:00+07:00`);
      const currentMinute = Math.floor(Date.now() / 60000) * 60000;
      if (!Number.isFinite(value) || value < currentMinute) {
        setError("Chọn thời gian hợp lệ, không sớm hơn phút hiện tại theo giờ Việt Nam."); return;
      }
    }
    setSaving(true);
    try {
      await onSend(date && time
        ? `Đổi lịch hẹn sang ${date.split("-").reverse().join("/")} lúc ${time}.`
        : "Chuyển sang đặt ngay, bỏ lịch hẹn cũ.", undefined,
        { type: "update", revision, patch: date && time ? { orderType: "scheduled", scheduledAt: `${date}T${time}:00+07:00` } : { orderType: "normal", scheduledAt: null } });
      onClose();
    } catch { setError("Chưa gửi được giờ hẹn. Dùng Thử lại trong chat để tiếp tục yêu cầu đã gửi."); }
    finally { setSaving(false); }
  };

  return <BookingDateTimeDialog anchorRef={anchorRef} scheduledAt={selectedValue} upcomingDates={getUpcomingDates(clock)}
    currentTimestamp={clock.getTime()} error={error} zIndex={180} disabled={disabled || saving}
    description={saving ? "Đang cập nhật lịch hẹn…" : "Chọn ngày giờ mong muốn. Trợ lý sẽ kiểm tra lịch trống; chưa giữ chỗ."}
    onCancel={onClose} onImmediate={() => void submit()} onConfirm={(date, time) => void submit(date, time)} />;
}
