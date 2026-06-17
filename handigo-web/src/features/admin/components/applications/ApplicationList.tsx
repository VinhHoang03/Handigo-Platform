import { StatusBadge } from '@/components/common/StatusBadge';
import type { AdminApplication } from '../../types/admin.types';

export function ApplicationList({
  items,
  onSelect,
}: {
  items: AdminApplication[];
  onSelect: (item: AdminApplication) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <button
          key={item._id}
          type="button"
          onClick={() => onSelect(item)}
          className="border-b border-outline-variant/40 p-5 text-left transition-colors hover:bg-surface-container-low"
        >
          <div className="flex justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={
                  item.userId.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    item.userId.fullName,
                  )}`
                }
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <p className="font-bold">{item.userId.fullName}</p>
                <p className="text-sm text-on-surface-variant">
                  {item.userId.email}
                </p>
              </div>
            </div>
            <StatusBadge value={item.status} />
          </div>
          <p className="mt-4 line-clamp-2">{item.description}</p>
          <p className="mt-3 text-sm text-primary">
            {item.experienceYears} năm kinh nghiệm · {item.serviceIds.length}{' '}
            dịch vụ · {item.identityDocument ? 'Có giấy tờ' : 'Chưa có giấy tờ'}
          </p>
        </button>
      ))}
    </div>
  );
}
