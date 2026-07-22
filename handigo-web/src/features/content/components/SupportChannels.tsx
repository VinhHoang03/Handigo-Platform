import { supportChannels } from "../data/supportData";

export function IconTile({
  icon,
  size = "md",
}: {
  icon: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-primary/8 text-primary ${
        size === "sm" ? "h-10 w-10" : "h-12 w-12"
      }`}
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined leading-none ${
          size === "sm" ? "text-xl" : "text-2xl"
        }`}
      >
        {icon}
      </span>
    </span>
  );
}

/**
 * Kênh liên hệ thật. Số điện thoại và email nay là liên kết bấm được — trước đây
 * chỉ là chữ, người dùng trên di động phải tự chép lại số.
 */
export function SupportChannels({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={compact ? "grid gap-4 md:grid-cols-3" : "space-y-4"}>
      {supportChannels.map((channel) => (
        <li
          key={channel.title}
          className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4"
        >
          <div className="flex items-start gap-3">
            <IconTile icon={channel.icon} size="sm" />
            <div className="min-w-0">
              <h3 className="font-semibold text-on-surface">{channel.title}</h3>
              {channel.href ? (
                <a
                  href={channel.href}
                  className="mt-1 block break-words font-semibold text-secondary hover:underline"
                >
                  {channel.value}
                </a>
              ) : (
                <p className="mt-1 break-words font-semibold text-secondary">
                  {channel.value}
                </p>
              )}
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {channel.text}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
