import { useMemo, useState, type ReactNode } from "react";
import { MaterialIcon } from "@/components/common/MaterialIcon";
import {
  supportFaqs,
  type SupportFaqGroup,
} from "../data/support-faq";

const GROUPS: SupportFaqGroup[] = [
  "Tài khoản",
  "Thanh toán",
  "Dịch vụ",
  "Lỗi kỹ thuật",
];

/** Bỏ dấu để "thanh toan" cũng khớp "thanh toán": người dùng ít khi gõ dấu. */
const foldAccents = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLocaleLowerCase("vi-VN");

interface SupportFaqProps {
  query: string;
  /** Nhóm đang chọn; `null` là xem tất cả. */
  group: SupportFaqGroup | null;
  onGroupChange: (group: SupportFaqGroup | null) => void;
}

/**
 * Danh sách câu hỏi dạng accordion, lọc theo từ khoá và theo nhóm.
 *
 * Ô tìm kiếm ở đầu trang giờ có nội dung thật để lọc. Trước đây nó tìm trên ba
 * câu hỏi và chỉ hiện kết quả khi đã gõ, nên với người dùng nó là một ô tìm kiếm
 * không tìm được gì.
 */
export function SupportFaq({ query, group, onGroupChange }: SupportFaqProps) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const keyword = foldAccents(query.trim());

  const results = useMemo(
    () =>
      supportFaqs.filter((faq) => {
        if (group && faq.group !== group) return false;
        if (!keyword) return true;
        // Gồm cả tên nhóm: gõ "thanh toan" thì ra cả nhóm Thanh toán, không chỉ
        // những câu tình cờ có cụm đó trong nội dung.
        return foldAccents(
          `${faq.group} ${faq.question} ${faq.answer}`,
        ).includes(keyword);
      }),
    [group, keyword],
  );

  return (
    <section
      id="cau-hoi-thuong-gap"
      aria-labelledby="faq-heading"
      className="mx-auto max-w-7xl px-6 py-12 lg:py-14"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <h2
          id="faq-heading"
          className="font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface"
        >
          Câu hỏi thường gặp
        </h2>

        <div role="group" aria-label="Lọc theo nhóm" className="flex flex-wrap gap-2">
          <FilterChip active={!group} onClick={() => onGroupChange(null)}>
            Tất cả
          </FilterChip>
          {GROUPS.map((item) => (
            <FilterChip
              key={item}
              active={group === item}
              onClick={() => onGroupChange(group === item ? null : item)}
            >
              {item}
            </FilterChip>
          ))}
        </div>
      </div>

      {results.length ? (
        <ul className="mt-8 divide-y divide-outline-variant/40 border-y border-outline-variant/40">
          {results.map((faq) => {
            const isOpen = openQuestion === faq.question;
            return (
              <li key={faq.question}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenQuestion(isOpen ? null : faq.question)}
                  className="flex w-full items-start justify-between gap-6 py-5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-label-sm font-semibold text-secondary">
                      {faq.group}
                    </span>
                    <span className="mt-1 block text-pretty text-lg font-semibold text-on-surface">
                      {faq.question}
                    </span>
                  </span>
                  <MaterialIcon
                    className={`mt-1 shrink-0 text-[22px] text-on-surface-variant transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    expand_more
                  </MaterialIcon>
                </button>
                {isOpen && (
                  <p className="max-w-[80ch] pb-6 text-pretty leading-7 text-on-surface-variant">
                    {faq.answer}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6 text-on-surface-variant">
          Không có câu hỏi nào khớp. Thử từ khoá ngắn hơn, hoặc gọi 1900 1234 để
          được trả lời trực tiếp.
        </p>
      )}
    </section>
  );
}

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`min-h-11 rounded-full border px-4 text-label-md font-medium transition-colors ${
      active
        ? "border-primary bg-primary text-on-primary"
        : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-primary/40"
    }`}
  >
    {children}
  </button>
);
