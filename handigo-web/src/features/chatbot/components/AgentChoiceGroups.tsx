import { useState } from "react";
import type { ChatbotMessage } from "../types/chatbot.types";

export function AgentChoiceGroups({ groups, disabled, onSend }: {
  groups: NonNullable<ChatbotMessage["choiceGroups"]>;
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [sending, setSending] = useState(false);
  const [details, setDetails] = useState("");
  const content = [...groups.flatMap((group, index) => selected[index]?.length
    ? [`${group.label}: ${selected[index].join(", ")}`] : []), details.trim()].filter(Boolean).join("\n");
  const blocked = disabled || sending;

  const submit = async () => {
    if (blocked || !content || content.length > 4000) return;
    setSending(true);
    try { await onSend(content); }
    catch { /* Lỗi gửi tin nhắn được hiển thị trong panel, giữ lựa chọn để thử lại. */ }
    finally { setSending(false); }
  };

  return (
    <div className="mt-3 space-y-3">
      {groups.map((group, index) => (
        <fieldset key={index} disabled={blocked} className="space-y-2">
          <legend className="text-xs font-semibold">{group.label}{group.multiple ? " (có thể chọn nhiều)" : ""}</legend>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option, optionIndex) => {
              const checked = selected[index]?.includes(option) ?? false;
              return (
                <label key={optionIndex} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs ${checked
                  ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/50"} ${blocked ? "cursor-default opacity-60" : ""}`}>
                  <input type={group.multiple ? "checkbox" : "radio"} name={`agent-choice-${index}`}
                    checked={checked} className="mt-0.5 accent-primary"
                    onChange={() => setSelected((current) => ({ ...current, [index]: group.multiple
                      ? checked ? (current[index] ?? []).filter((value) => value !== option) : [...(current[index] ?? []), option]
                      : [option] }))} />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <label className="block space-y-1 text-xs">
        <span>Bổ sung số lượng, giờ hẹn hoặc yêu cầu khác</span>
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} disabled={blocked}
          maxLength={1000} rows={2} placeholder="Ví dụ: 2 máy, 9 giờ sáng mai"
          className="w-full resize-none rounded-xl border border-outline-variant/50 bg-surface px-3 py-2 text-on-surface disabled:opacity-50" />
      </label>
      {content.length > 4000 && <p role="alert" className="text-xs text-error">Vui lòng rút gọn thông tin hoặc giảm số lựa chọn để gửi.</p>}
      <button type="button" onClick={() => void submit()} disabled={blocked || !content || content.length > 4000}
        className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary disabled:opacity-50">
        Gửi các lựa chọn
      </button>
      <p className="text-xs text-on-surface-variant">Bạn cũng có thể nhập yêu cầu hoặc bổ sung thông tin bên dưới.</p>
    </div>
  );
}
