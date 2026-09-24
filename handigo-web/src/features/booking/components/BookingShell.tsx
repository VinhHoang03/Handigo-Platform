import React, { type ReactNode } from 'react';
import { DashboardShell } from '@/components/common/DashboardShell';

interface BookingShellProps {
  children: ReactNode;
}

export const BookingShell: React.FC<BookingShellProps> = ({ children }) => (
  <DashboardShell role="CUSTOMER">{children}</DashboardShell>
);
