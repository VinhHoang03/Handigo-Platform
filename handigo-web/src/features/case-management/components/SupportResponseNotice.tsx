import { Headset } from "lucide-react";

export function SupportResponseNotice() {
  return (
    <p className="flex items-start gap-3 rounded-2xl bg-primary/8 px-4 py-3 text-sm leading-relaxed text-on-surface">
      <Headset aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
      <span>Đội ngũ tư vấn hỗ trợ sẽ phản hồi yêu cầu của bạn sớm nhất có thể.</span>
    </p>
  );
}
