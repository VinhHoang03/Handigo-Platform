import React, { type ReactNode } from 'react';
import { Navbar } from '@/components/common/Navbar';

interface OrderCreationShellProps {
  children: ReactNode;
}

export const OrderCreationShell: React.FC<OrderCreationShellProps> = ({ children }) => (
  <div className="min-h-dvh overflow-x-hidden bg-background font-body-md text-body-md">
    <Navbar role="CUSTOMER" />
    <main id="main-content" className="relative min-h-dvh pb-12 pt-32">
      <div className="mx-auto max-w-container-max space-y-8 px-4 sm:px-5 lg:px-8">
        {children}
      </div>
    </main>
  </div>
);
