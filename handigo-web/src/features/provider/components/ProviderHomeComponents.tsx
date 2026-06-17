import React from 'react';
import type { Job } from '../types/provider.types';

// JobCard
interface JobCardProps {
  job: Job;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => (
  <div className={`p-md rounded-xl transition-colors ${job.status === 'Active'
      ? 'relative pl-6 border-l-4 border-primary bg-primary/5'
      : 'pl-6 border-l-4 border-outline-variant hover:bg-surface-container-low'
    }`}>
    {job.status === 'Active' && (
      <div className="absolute -left-[10px] top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full ring-4 ring-background"></div>
    )}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
      <div>
        <div className="flex items-center gap-2 mb-xs">
          {job.status === 'Đang hoạt động' && (
            <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Đang hoạt động</span>
          )}
          <span className="font-label-md text-on-surface-variant">{job.startTime} - {job.endTime}</span>
        </div>
        <h4 className={`text-on-background ${job.status === 'Đang hoạt động' || job.status === 'Active' ? 'font-headline-md text-headline-md' : 'font-body-lg font-semibold'}`}>
          {job.title}
        </h4>
        <p className="font-body-md text-on-surface-variant">{job.address}</p>
      </div>
      <div className="flex items-center gap-2">
        {job.status === 'Đang hoạt động' || job.status === 'Active' ? (
          <>
            <button className="bg-primary text-white px-6 py-2 rounded-xl font-label-md hover:shadow-lg transition-all">Bắt đầu công việc</button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg">
              <span className="material-symbols-outlined">directions</span>
            </button>
          </>
        ) : (
          <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold uppercase">Đã xác nhận</span>
        )}
      </div>
    </div>
  </div>
);

// WalletWidget
interface WalletWidgetProps {
  balance: string;
  weeklyEarnings: string;
}

export const WalletWidget: React.FC<WalletWidgetProps> = ({ balance, weeklyEarnings }) => (
  <div className="glass-card p-md rounded-xl">
    <div className="flex items-center justify-between mb-md">
      <h3 className="font-headline-md text-headline-md">Ví</h3>
      <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
    </div>
    <div className="mb-lg">
      <p className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">Số dư khả dụng</p>
      <p className="text-[40px] font-bold text-on-background leading-tight">{balance}</p>
    </div>
    <div className="space-y-md">
      <div className="flex items-center justify-between p-3 bg-surface-container rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">trending_up</span>
          </div>
          <div>
            <p className="font-label-md">Thu nhập hàng tuần</p>
            <p className="text-xs text-on-surface-variant">+12% so với tuần trước</p>
          </div>
        </div>
        <p className="font-semibold text-on-background">{weeklyEarnings}</p>
      </div>
      <button className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform">Rút tiền ngay</button>
    </div>
  </div>
);

// EarningsChart
export const EarningsChart: React.FC = () => (
  <div className="glass-card p-md rounded-xl overflow-hidden relative min-h-[220px] flex flex-col">
    <h3 className="font-label-md text-on-surface-variant mb-base">Nhu cầu dịch vụ (Hàng tuần)</h3>
    <div className="mt-auto flex items-end justify-between gap-1 h-32">
      <div className="flex-1 bg-primary/20 rounded-t-lg transition-all hover:bg-primary" style={{ height: '45%' }}></div>
      <div className="flex-1 bg-primary/20 rounded-t-lg transition-all hover:bg-primary" style={{ height: '60%' }}></div>
      <div className="flex-1 bg-primary/20 rounded-t-lg transition-all hover:bg-primary" style={{ height: '35%' }}></div>
      <div className="flex-1 bg-primary/20 rounded-t-lg transition-all hover:bg-primary" style={{ height: '85%' }}></div>
      <div className="flex-1 bg-primary rounded-t-lg transition-all hover:bg-primary" style={{ height: '95%' }}></div>
      <div className="flex-1 bg-primary/20 rounded-t-lg transition-all hover:bg-primary" style={{ height: '55%' }}></div>
      <div className="flex-1 bg-primary/20 rounded-t-lg transition-all hover:bg-primary" style={{ height: '70%' }}></div>
    </div>
    <div className="flex justify-between mt-xs px-1 text-[10px] text-on-surface-variant font-bold">
      <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
    </div>
  </div>
);

// QuickAccessCard
interface QuickAccessCardProps {
  icon: string;
  title: string;
  desc: string;
}

export const QuickAccessCard: React.FC<QuickAccessCardProps> = ({ icon, title, desc }) => (
  <div className="glass-card p-md rounded-xl hover:scale-105 transition-all cursor-pointer group">
    <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center mb-md group-hover:bg-primary group-hover:text-white transition-colors">
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <h4 className="font-body-lg font-semibold">{title}</h4>
    <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
  </div>
);
