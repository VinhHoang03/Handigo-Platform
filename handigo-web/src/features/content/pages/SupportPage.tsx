import { useState } from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { PublicContentLayout } from "../components/PublicContentLayout";
import { PublicSupportCta } from "../components/PublicSupportCta";
import { IconTile, SupportChannels } from "../components/SupportChannels";
import { SupportFaq } from "../components/SupportFaq";
import {
  SupportTicketSection,
  type SupportRole,
} from "../components/SupportTicketSection";
import { supportCategories } from "../data/supportData";
import type { SupportFaqGroup } from "../data/support-faq";

interface SupportPageProps {
  role?: SupportRole;
}

export default function SupportPage({ role }: SupportPageProps) {
  const [faqQuery, setFaqQuery] = useState("");
  const [faqGroup, setFaqGroup] = useState<SupportFaqGroup | null>(null);

  // Bốn thẻ danh mục nay là bộ lọc thật cho danh sách câu hỏi bên dưới, thay vì
  // bốn tấm thẻ chỉ để nhìn.
  const selectCategory = (title: string) => {
    setFaqGroup(title as SupportFaqGroup);
    document
      .getElementById("cau-hoi-thuong-gap")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      </section>

      <section
        aria-labelledby="support-categories-heading"
        className={`mx-auto max-w-7xl ${role ? "py-4" : "px-6 pb-2 pt-12"}`}
      >
        <h2
          id="support-categories-heading"
          className="mb-7 font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface"
        >
          Danh mục hỗ trợ
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {supportCategories.map((category) => (
            <button
              key={category.title}
              type="button"
              onClick={() => selectCategory(category.title)}
              className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-left transition-colors hover:border-primary/30 hover:bg-surface-container-low"
            >
              <IconTile icon={category.icon} />
              <h3 className="mt-5 text-lg font-semibold text-on-surface">
                {category.title}
              </h3>
              <p className="mt-2 text-pretty text-sm leading-6 text-on-surface-variant">
                {category.text}
              </p>
            </button>
          ))}
        </div>
      </section>

      <SupportFaq
        query={faqQuery}
        group={faqGroup}
        onGroupChange={setFaqGroup}
      />

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
