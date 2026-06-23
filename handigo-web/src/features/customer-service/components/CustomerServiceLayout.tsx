import type { ReactNode } from "react";
import { Navbar } from "@/components/common/Navbar";

interface CustomerServiceLayoutProps {
  children: ReactNode;
}

export function CustomerServiceLayout({ children }: CustomerServiceLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background font-body-md text-body-md">
      <Navbar role="CUSTOMER" />

      <main className="relative min-h-screen pb-12 pt-32">
        <div className="mx-auto max-w-container-max space-y-8 px-4 sm:px-5 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
