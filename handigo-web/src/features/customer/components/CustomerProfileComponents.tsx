import React from 'react';
import type { Address } from '../types/customer.types';

interface ProfileSectionHeaderProps {
  icon: string;
  title: string;
  action?: React.ReactNode;
}

export const ProfileSectionHeader: React.FC<ProfileSectionHeaderProps> = ({ icon, title, action }) => (
  <div className="flex justify-between items-center mb-md">
    <h3 className="font-headline-md text-headline-md flex items-center gap-2">
      <span className="material-symbols-outlined text-primary">{icon}</span> {title}
    </h3>
    {action}
  </div>
);

interface AddressCardProps {
  address: Address;
}

export const AddressCard: React.FC<AddressCardProps> = ({ address }) => {
  const getIcon = () => {
    switch (address.type) {
      case 'home': return 'home';
      case 'office': return 'business';
      default: return 'favorite';
    }
  };

  const getIconColor = () => {
    switch (address.type) {
      case 'home': return 'text-primary bg-primary/10';
      case 'office': return 'text-secondary bg-secondary/10';
      default: return 'text-tertiary bg-tertiary-fixed-dim/20';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/30 transition-all cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getIconColor()}`}>
          <span className="material-symbols-outlined">{getIcon()}</span>
        </div>
        <div>
          <h4 className="font-label-md text-label-md font-bold">{address.label}</h4>
          <p className="font-label-sm text-label-sm text-outline line-clamp-1">{address.address}</p>
        </div>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 text-outline hover:text-primary"><span className="material-symbols-outlined text-lg">edit</span></button>
        <button className="p-1 text-outline hover:text-error"><span className="material-symbols-outlined text-lg">delete</span></button>
      </div>
    </div>
  );
};

export const ToggleOption: React.FC<{ label: string; desc: string; icon: string; checked?: boolean; color?: string }> = ({ label, desc, icon, checked, color = 'bg-surface-container' }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="font-label-md text-label-md font-bold">{label}</p>
        <p className="font-label-sm text-label-sm text-outline">{desc}</p>
      </div>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} className="sr-only peer" onChange={() => {}} />
      <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  </div>
);
