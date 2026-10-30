import { CircleCheck, CircleX, Files, History, Users } from 'lucide-react';

export const applicationSummaryFilters = [
  { key: 'total', label: 'Tổng hồ sơ', status: '', applicationType: '', icon: Users, tone: 'neutral' },
  { key: 'pending', label: 'Chờ duyệt', status: 'pending', applicationType: '', icon: History, tone: 'amber' },
  { key: 'addition', label: 'Bổ sung chờ duyệt', status: 'pending', applicationType: 'service_addition', icon: Files, tone: 'blue' },
  { key: 'approved', label: 'Đã duyệt', status: 'approved', applicationType: '', icon: CircleCheck, tone: 'green' },
  { key: 'rejected', label: 'Từ chối', status: 'rejected', applicationType: '', icon: CircleX, tone: 'rose' },
] as const;
