import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { PublicContentLayout } from "../components/PublicContentLayout";
import { PublicSupportCta } from "../components/PublicSupportCta";
import {
  IconTile,
  SupportChannels,
} from "../components/SupportChannels";
import {
  SupportTicketSection,
  type SupportRole,
} from "../components/SupportTicketSection";
import { faqs, supportCategories } from "../data/supportData";

interface SupportPageProps {
  role?: SupportRole;
}

export default function SupportPage({ role }: SupportPageProps) {
  const [faqQuery, setFaqQuery] = useState("");
  const normalizedQuery = faqQuery.trim().toLocaleLowerCase("vi-VN");
  const filteredFaqs = useMemo(
    () =>
      faqs.filter((faq) =>
        `${faq.question} ${faq.answer}`
          .toLocaleLowerCase("vi-VN")
          .includes(normalizedQuery),
      ),
    [normalizedQuery],
  );

  const content = (
    <>
      <section
        className={`bg-surface-container-low px-5 py-12 text-center sm:px-6 sm:py-16 ${
          role ? "rounded-3xl border border-outline-variant/20" : "sm:py-20"
        }`}
      >
        <p className="text-label-sm font-semibold uppercase tracking-[0.18em] text-secondary">
          Trung tâm trợ giúp
        </p>
        <h1 className="mt-4 text-balance font-headline-xl text-4xl font-bold tracking-[-0.02em] text-on-surface sm:text-5xl">
          Chúng tôi có thể giúp gì cho bạn?
        </h1>

        <div className="relative mx-auto mt-8 max-w-2xl">
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-xl leading-none text-on-surface-variant"
          >
            search
          </span>
          <input
            value={faqQuery}
            onChange={(event) => setFaqQuery(event.target.value)}
            className="min-h-14 w-full rounded-full border border-outline-variant/60 bg-surface-container-lowest py-4 pl-14 pr-5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Tìm kiếm câu hỏi thường gặp..."
            aria-label="Tìm kiếm câu hỏi thường gặp"
          />
        </div>

        {faqQuery && (
          <div className="mx-auto mt-3 max-w-2xl overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest text-left">
            {filteredFaqs.length ? (
              filteredFaqs.map((faq) => (
                <div
                  key={faq.question}
                  className="border-b border-outline-variant/20 p-4 last:border-0"
                >
                  <p className="font-semibold text-on-surface">{faq.question}</p>
                  <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                    {faq.answer}
                  </p>
                </div>
              ))
            ) : (
              <p className="p-5 text-center text-on-surface-variant">
                Không tìm thấy câu trả lời phù hợp. Thử từ khoá ngắn hơn, hoặc
                gọi 1900 1234.
              </p>
            )}
          </div>
        )}
      </section>

      <section className={`mx-auto max-w-7xl ${role ? "py-4" : "px-6 pb-5 pt-10"}`}>
        <h2 className="mb-7 font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface">
          Danh mục hỗ trợ
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {supportCategories.map((category) => (
            <article
              key={category.title}
              className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 transition-colors hover:border-primary/30"
            >
              <IconTile icon={category.icon} />
              <h3 className="mt-5 text-lg font-semibold text-on-surface">
                {category.title}
              </h3>
              <p className="mt-2 text-pretty text-sm leading-6 text-on-surface-variant">
                {category.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {role ? (
        <>
          <SupportTicketSection role={role} />
          <section className="rounded-3xl bg-surface-container p-5 sm:p-6">
            <h2 className="mb-5 text-xl font-semibold text-on-surface">
              Kênh hỗ trợ
            </h2>
            <SupportChannels compact />
          </section>
        </>
      ) : (
        <section className="mx-auto grid max-w-7xl items-start gap-8 px-6 pb-4 pt-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <PublicSupportCta />
          <aside className="rounded-3xl bg-surface-container p-6">
            <h2 className="mb-5 text-xl font-semibold text-on-surface">
              Kênh hỗ trợ
            </h2>
            <SupportChannels />
          </aside>
        </section>
      )}
    </>
  );

  return role ? (
    <DashboardShell role={role}>{content}</DashboardShell>
  ) : (
    <PublicContentLayout>{content}</PublicContentLayout>
  );
}
