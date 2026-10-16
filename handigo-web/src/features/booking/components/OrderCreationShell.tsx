import React, { type ReactNode } from 'react';
import { Navbar } from '@/components/common/Navbar';
import styles from './OrderCreationShell.module.css';

interface OrderCreationShellProps {
  children: ReactNode;
}

export const OrderCreationShell: React.FC<OrderCreationShellProps> = ({ children }) => (
  <div className="min-h-dvh overflow-x-clip bg-background font-body-md text-body-md">
    <Navbar role="CUSTOMER" />
    <main id="main-content" className={`${styles.content} relative min-h-dvh pb-10 pt-28 text-body-md`}>
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 sm:px-5 lg:px-8">
        {children}
      </div>
    </main>
  </div>
);
