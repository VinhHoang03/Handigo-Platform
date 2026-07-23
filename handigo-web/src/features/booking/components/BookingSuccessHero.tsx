import { CheckCircle2 } from "lucide-react";
export const BookingSuccessHero = () => (
  <div className="text-center mb-lg w-full max-w-2xl">
    <div className="inline-flex items-center justify-center w-24 h-24 bg-success-container text-on-success-container rounded-full mb-md animate-[float_4s_ease-in-out_infinite] shadow-lg shadow-success/20">
      <CheckCircle2 aria-hidden="true" size={48} className="font-bold" fill="currentColor" />
    </div>
    <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">Đặt lịch thành công!</h1>
    <p className="font-body-lg text-body-lg text-on-surface-variant">
      Cảm ơn bạn đã tin tưởng HandiGo. Chuyên gia của chúng tôi sẽ sớm liên hệ với bạn.
    </p>
  </div>
);
