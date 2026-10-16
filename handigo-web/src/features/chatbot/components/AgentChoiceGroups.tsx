import { useState } from "react";
import type { ChatbotMessage } from "../types/chatbot.types";
import { agentDisplayText } from "../utils/agentDisplayText";

export function AgentChoiceGroups({ groups, disabled, onSend }: {
  groups: NonNullable<ChatbotMessage["choiceGroups"]>;
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [sending, setSending] = useState(false);
  const content = groups.flatMap((group, index) => selected[index]?.length
    ? [`${group.label}: ${selected[index].join(", ")}`] : []).join("\n");
  const blocked = disabled || sending;

  const submit = async () => {
    if (blocked || !content || content.length > 4000) return;
    setSending(true);
    try { await onSend(content); }
    catch { /* Lỗi gửi tin nhắn được hiển thị trong panel, giữ lựa chọn để thử lại. */ }
    finally { setSending(false); }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-outline-variant/30 pt-4">
      {groups.map((group, index) => (
        <fieldset key={index} disabled={blocked} className="space-y-2">
          <legend className="text-xs font-semibold">{agentDisplayText(group.label)}{group.multiple ? " (có thể chọn nhiều)" : ""}</legend>
          <div className={group.label === "Địa chỉ" ? "grid gap-2" : "flex flex-wrap gap-2"}>
            {group.options.map((option, optionIndex) => {
              const checked = selected[index]?.includes(option) ?? false;
              return (
                <label key={optionIndex} className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-primary/25 ${checked
                  ? "border-primary/60 bg-primary/5 font-medium text-primary" : "border-outline-variant/50 bg-surface-container-lowest hover:border-primary/30"} ${blocked ? "cursor-default opacity-60" : ""}`}>
                  <input type={group.multiple ? "checkbox" : "radio"} name={`agent-choice-${index}`}
                    checked={checked} className="mt-0.5 accent-primary"
                    onChange={() => setSelected((current) => ({ ...current, [index]: group.multiple
                      ? checked ? (current[index] ?? []).filter((value) => value !== option) : [...(current[index] ?? []), option]
                      : [option] }))} />
                  <span className="min-w-0 break-words leading-5">{agentDisplayText(option)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {content.length > 4000 && <p role="alert" className="text-xs text-error">Vui lòng rút gọn thông tin hoặc giảm số lựa chọn để gửi.</p>}
      <button type="button" onClick={() => void submit()} disabled={blocked || !content || content.length > 4000}
        className="min-h-11 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
        {sending ? "Đang gửi…" : "Tiếp tục"}
      </button>
    </div>
  );
}
