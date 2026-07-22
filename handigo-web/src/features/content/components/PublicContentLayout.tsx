import type { ReactNode } from "react";
import { Navbar } from "@/components/common/Navbar";
import { HomeFooter } from "@/components/home/HomeFooter";

export function PublicContentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main id="main-content" className="pt-24">{children}</main>
      <HomeFooter />
    </div>
  );
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-secondary">{eyebrow}</p>}
      <h2 className="font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 leading-7 text-on-surface-variant">{description}</p>}
    </div>
  );
}
