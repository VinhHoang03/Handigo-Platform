import axios from 'axios';

/** Hằng số & hàm thuần cho CreateBookingStep2Page — tách ra để trang chính giữ dưới 200 dòng. */

export const timeSlots = Array.from({ length: 10 }, (_, index) => {
  const startHour = 8 + index;
  return `${String(startHour).padStart(2, '0')}:00`;
});
export const MIN_DESCRIPTION_LENGTH = 10;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MIN_IMAGE_WIDTH = 320;
export const MIN_IMAGE_HEIGHT = 240;

export type RecurrenceCount = 1 | 2 | 3 | 4 | 8 | 12;

export type Step2FormErrors = {
  addressId?: string;
  preferredProviderId?: string;
  problemDescription?: string;
  scheduledAt?: string;
};

export const getUploadErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || 'Không thể tải ảnh lên. Vui lòng thử lại.';
  }
  return 'Không thể tải ảnh lên. Vui lòng thử lại.';
};

export const getTodayInputValue = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().split('T')[0];
};

export const getUpcomingDates = () =>
  Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return {
      value: new Date(date.getTime() - timezoneOffset).toISOString().split('T')[0],
      weekday: new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date),
      day: new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(date),
      month: new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(date),
    };
  });

export const buildRecurringPreview = (
  scheduledAt: string | undefined,
  unit: 'weekly' | 'monthly',
  count: number,
) => {
  if (!scheduledAt?.includes('T')) return [];
  const start = new Date(scheduledAt);
  return Array.from({ length: count }, (_, index) => {
    const occurrence = new Date(start);
    if (unit === 'weekly') {
      occurrence.setDate(start.getDate() + index * 7);
    } else {
      const targetDay = start.getDate();
      occurrence.setDate(1);
      occurrence.setMonth(start.getMonth() + index);
      const lastDay = new Date(
        occurrence.getFullYear(),
        occurrence.getMonth() + 1,
        0,
      ).getDate();
      occurrence.setDate(Math.min(targetDay, lastDay));
    }
    return occurrence;
  });
};

export const validateImageFile = (file: File) => new Promise<string | null>((resolve) => {
  if (!file.type.startsWith('image/')) {
    resolve(`"${file.name}" không phải là tệp ảnh hợp lệ.`);
    return;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    resolve(`"${file.name}" vượt quá dung lượng 5MB.`);
    return;
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(imageUrl);
    if (image.naturalWidth < MIN_IMAGE_WIDTH || image.naturalHeight < MIN_IMAGE_HEIGHT) {
      resolve(`"${file.name}" có độ phân giải quá thấp.`);
      return;
    }
    resolve(null);
  };
  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    resolve(`"${file.name}" không thể đọc nội dung ảnh.`);
  };
  image.src = imageUrl;
});
