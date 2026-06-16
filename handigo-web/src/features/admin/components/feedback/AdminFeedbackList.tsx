import { Eye, EyeOff } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { FeedbackCard } from '@/features/feedback/components/FeedbackCard';
import type { Feedback } from '@/features/feedback/types/feedback.types';

export function AdminFeedbackList({ items, onToggle }: { items: Feedback[]; onToggle: (feedback: Feedback) => void }) {
  return (
    <div className="space-y-4">
      {items.map((feedback) => (
        <FeedbackCard key={feedback._id} feedback={feedback} actions={<div className="flex items-center justify-between"><StatusBadge value={feedback.isVisible ? 'visible' : 'hidden'} /><button type="button" title={feedback.isVisible ? 'Ẩn đánh giá' : 'Hiện đánh giá'} onClick={() => onToggle(feedback)} className="rounded-lg border border-outline-variant p-2 text-primary">{feedback.isVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>} />
      ))}
    </div>
  );
}
