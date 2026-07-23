import type { AdminSupportTicket } from "../../types/adminSupport.types";

export function SupportAttachments({ attachments }: { attachments: AdminSupportTicket["attachments"] }) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <a
          key={attachment.url}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          {attachment.fileName || "Xem tệp đính kèm"}
        </a>
      ))}
    </div>
  );
}
