import { ToggleOption } from "@/features/customer/components/ToggleOption";
import { CalendarCheck, Megaphone, MessageSquareText } from "lucide-react";
export function NotificationSettingsSection() {
  return (
    <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm md:p-8">
      <h3 className="mb-5 font-headline-md text-headline-md text-on-surface">
        Cài đặt thông báo
      </h3>
      <div className="space-y-5">
        <ToggleOption
          label="Cập nhật đặt lịch"
          desc="Nhận thông báo khi lịch đặt được xác nhận hoặc thay đổi."
          icon={CalendarCheck}
          checked
        />
        <ToggleOption
          label="Tiếp thị và khuyến mãi"
          desc="Nhận các ưu đãi và cập nhật từ Handigo."
          icon={Megaphone}
        />
        <ToggleOption
          label="Tin nhắn SMS trực tiếp"
          desc="Nhận thông báo qua SMS."
          icon={MessageSquareText}
          checked
        />
      </div>
    </section>
  );
}
