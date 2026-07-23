import React, { type ReactNode } from 'react';

export const BookingPageHeader: React.FC<{
  title: string;
  description: string;
  action?: ReactNode;
}> = ({ title, description, action }) => (
  <header className="space-y-md">
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
      <p className="text-on-surface-variant font-body-md mt-1">{description}</p>
    </div>
    {action}
  </header>
);
