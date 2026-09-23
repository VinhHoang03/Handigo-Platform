import { mapImage } from '../constants/bookingImages';

export const BookingSuccessLocationPreview = () => (
  <div className="w-full max-w-4xl mt-lg h-48 rounded-3xl overflow-hidden border border-outline-variant/30 relative shadow-sm">
    <div className="absolute inset-0 bg-surface-container-high flex items-center justify-center overflow-hidden">
      <img className="w-full h-full object-cover opacity-60 grayscale" src={mapImage} alt="Bản đồ vị trí" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-container/80 to-transparent" />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-container-lowest/90 backdrop-blur-sm px-md py-xs rounded-full shadow-md flex items-center gap-sm">
        <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
        <span className="text-label-sm font-label-sm text-on-surface">Đang tìm chuyên gia gần nhất...</span>
      </div>
    </div>
  </div>
);
