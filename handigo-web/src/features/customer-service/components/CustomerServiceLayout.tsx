import type { ReactNode } from "react";
import { Navbar } from "@/components/common/Navbar";
import { AnimatedBackground } from "@/components/home/AnimatedBackground";

interface CustomerServiceLayoutProps {
  children: ReactNode;
}

export function CustomerServiceLayout({ children }: CustomerServiceLayoutProps) {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip font-body-md text-body-md">
      <AnimatedBackground />
      <Navbar role="CUSTOMER" />

      <main id="main-content" className="relative min-h-dvh pb-12 pt-32">
        <div className="mx-auto max-w-container-max space-y-8 px-4 sm:px-5 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
