import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { customerServiceApi, type PublicProviderProfile } from '@/features/customer-service/api/customerService.api';
import { ProviderProfileHeader } from '@/features/customer-service/components/ProviderProfileHeader';
import { ProviderAboutSection } from '@/features/customer-service/components/ProviderAboutSection';
import { ProviderFeedbackSection } from '@/features/customer-service/components/ProviderFeedbackSection';
import { InfoSection } from '@/features/customer-service/components/ProviderProfilePrimitives';

interface BookingProviderDetailsProps {
  providerId: string;
  canSelect: boolean;
  onClose: () => void;
  onSelect: () => void;
}

export const BookingProviderDetails = ({ providerId, canSelect, onClose, onSelect }: BookingProviderDetailsProps) => {
  const [profile, setProfile] = useState<PublicProviderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await customerServiceApi.publicProviderProfile(providerId);
        if (isMounted) setProfile(data);
      } catch {
        if (isMounted) setError('Không tải được hồ sơ thợ. Vui lòng thử lại.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void loadProfile();
    return () => { isMounted = false; };
  }, [providerId, retryCount]);

  return (
    <Modal open compact title="Hồ sơ chuyên gia" size="sm" placement="side" onClose={onClose}
      footer={(
        <div>
          {!canSelect && <p role="status" className="mb-sm text-xs text-on-surface-variant">Thợ không còn phù hợp với lịch hoặc địa chỉ hiện tại. Vui lòng chọn lại.</p>}
          <button type="button" disabled={isLoading || Boolean(error) || !profile || !canSelect} onClick={onSelect}
            className="min-h-11 w-full rounded-xl bg-primary px-sm text-[15px] font-bold text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50">
            Chọn thợ này
          </button>
        </div>
      )}>
      {isLoading ? (
        <p role="status" className="flex items-center justify-center gap-sm py-lg text-sm text-on-surface-variant">
          <Loader2 size={20} aria-hidden="true" className="animate-spin text-primary" />
          Đang tải hồ sơ thợ…
        </p>
      ) : error || !profile ? (
        <div role="alert" className="space-y-sm text-center text-sm text-error">
          <p>{error || 'Không tìm thấy hồ sơ thợ.'}</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="min-h-11 rounded-xl border border-outline-variant px-md font-bold">Thử lại</button>
        </div>
      ) : (
        <div className="space-y-3.5 text-[15px] leading-6">
          <ProviderProfileHeader compact profile={profile} />
          <ProviderAboutSection compact bio={profile.provider.bio} description={profile.provider.description} certificates={profile.provider.certificates} />
          <InfoSection compact title="Dịch vụ">
            <div className="flex flex-wrap gap-xs">
              {profile.provider.services.map((service) => <span key={service.id} className="rounded-lg bg-primary/5 px-2 py-1 text-[13px] text-primary">{service.name}</span>)}
              {profile.provider.services.length === 0 && <p>Chưa cập nhật dịch vụ.</p>}
            </div>
          </InfoSection>
          <ProviderFeedbackSection compact feedbacks={profile.feedbacks} totalFeedbacks={profile.provider.totalFeedbacks} />
        </div>
      )}
    </Modal>
  );
};
