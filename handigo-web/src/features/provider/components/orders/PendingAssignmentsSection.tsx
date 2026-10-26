import { PendingAssignmentCard } from '../PendingAssignmentCard';
import type { OrderAssignment } from '../../types/providerOrder.types';

interface PendingAssignmentsSectionProps {
  visible?: boolean;
  assignments: OrderAssignment[];
  loading: boolean;
  busy: boolean;
  onRefresh: () => void;
  onAccept: (assignmentId: string) => Promise<void>;
  onReject: (assignmentId: string) => Promise<void>;
}

/** Hiển thị đề nghị được mở từ thông báo. */
export function PendingAssignmentsSection({
  visible = false,
  assignments,
  loading,
  busy,
  onRefresh,
  onAccept,
  onReject,
}: PendingAssignmentsSectionProps) {
  return (
    <section className={visible ? 'space-y-md' : 'hidden'}>
      <div className="flex items-center justify-between gap-md">
        <h2 className="font-headline-md text-on-surface">Đơn chờ phản hồi</h2>
        <button type="button" onClick={onRefresh} className="text-sm font-medium text-primary hover:underline">
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-surface-container-low p-md text-on-surface-variant">
          Đang tải đơn chờ phản hồi...
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-outline-variant bg-surface-container-low p-lg text-center text-on-surface-variant">
          Hiện chưa có đơn mới cần phản hồi.
        </div>
      ) : (
        <div className="grid gap-md">
          {assignments.map((assignment) => (
            <PendingAssignmentCard
              key={assignment._id}
              assignment={assignment}
              onAccept={onAccept}
              onReject={onReject}
              busy={busy}
            />
          ))}
        </div>
      )}
    </section>
  );
}
