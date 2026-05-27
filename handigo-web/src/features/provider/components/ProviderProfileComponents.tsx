import React from 'react';
import type { Certification } from '../types/provider.types';

export const StatBox: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color = 'text-primary' }) => (
  <div className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl">
    <span className="text-on-surface-variant font-label-md">{label}</span>
    <span className={`font-bold flex items-center gap-1 ${color}`}>
      {value} {icon}
    </span>
  </div>
);

export const CertificationItem: React.FC<{ cert: Certification }> = ({ cert }) => (
  <div className="flex items-center gap-3 p-3 bg-surface-container rounded-xl">
    <span className="material-symbols-outlined text-primary">verified_user</span>
    <div>
      <p className="font-label-md text-label-md">{cert.title}</p>
      <p className="text-[12px] text-on-surface-variant">Hết hạn: {cert.expiryDate}</p>
    </div>
  </div>
);

export const SecurityItem: React.FC<{ icon: string; title: string; desc: string; action?: React.ReactNode; color?: string }> = ({ icon, title, desc, action, color = 'text-primary bg-primary-container/20' }) => (
  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 hover:border-primary/30 transition-all">
    <div className="flex items-center gap-md">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="font-label-md text-label-md text-on-surface">{title}</p>
        <p className="text-body-md text-on-surface-variant text-sm">{desc}</p>
      </div>
    </div>
    {action}
  </div>
);
