export type BookingStatusTone = 'completed' | 'pending' | 'cancelled' | 'active';

export interface BookingListItem {
  id: string;
  serviceName: string;
  statusLabel: string;
  statusTone: BookingStatusTone;
  schedule: string;
  meta: string;
  price: string;
  imageUrl: string;
  primaryAction: string;
  secondaryAction?: string;
  rating?: string;
}

export interface ServiceTypeOption {
  id: string;
  label: string;
  icon: string;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  price: string;
}

export const userAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuARyCCp_DRCGkQD86OfC6uVpuF8fEBbXBt4HGN8QmYdL5UzG9_SqCwziPHJlA6sdnSMuuM0M4iPrj60PcbOf1Tay8zXYZ4f2Uu-n_wdO4q-vPoelLNHmMebsYSFMR4DmLvyx4EckHUwJ75M3e27ZQLoVG5O5dorIFpH9pmzWewWGvAXDD5raninyOCbDelMPkJ7VbxmR25BEJx3NxtjjR0W_wmbZNAE_yS7GTZDUH-7aKQX7QWevM_8Z9VQezxYcuFGLHLFjPczJvQ';

export const bookingNavItems = [
  { icon: 'dashboard', label: 'Bảng điều khiển', path: '/customer' },
  { icon: 'calendar_today', label: 'Lịch đặt chỗ', path: '/customer/bookings' },
  { icon: 'mail', label: 'Hộp thư', path: '/customer/inbox' },
  { icon: 'account_balance_wallet', label: 'Ví tiền', path: '/customer/wallet' },
  { icon: 'settings', label: 'Cài đặt', path: '/customer/settings' },
];

export const bookings: BookingListItem[] = [
  {
    id: 'HG-98231',
    serviceName: 'Dọn dẹp nhà cửa chuyên sâu',
    statusLabel: 'Đã hoàn thành',
    statusTone: 'completed',
    schedule: '14/05/2024, 09:00',
    meta: 'Chuyên gia: Minh Anh',
    price: '850.000đ',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBA37ECt2XUOxvvF3kIAxnIRAiQAZfklQOHiP_FDLixn_i5EfZiokudiNs3lvnY1SpzrU34evcJ1rvkRxH1uK53dgS7EO_TNlXqcrtyu-v38f-Ahz2L08N4kYRDYDZ7fRkxMQoz1d6pZEN5APxr-0YWisNSHU3Zm0Qhxoh7w2x_Ht_bNbG4k5rwCZXVfkBrNJ7aUGdiGNsz6SnBrEuXZ1vTddukUfGzzNyxzt6ugWjSHQhO8WpsOGrn7Vp0249lAVJfkwxE1tQ9loU',
    primaryAction: 'Đánh giá',
    secondaryAction: 'Xem chi tiết',
  },
  {
    id: 'HG-88420',
    serviceName: 'Sửa chữa điện & lắp đặt đèn',
    statusLabel: 'Đang xử lý',
    statusTone: 'pending',
    schedule: '18/05/2024, 15:30',
    meta: 'Chờ xác nhận từ đối tác',
    price: '420.000đ',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCboJ35wQ39dDkXyGzLovQwBTZUcAyOAkbUbRK1XjNU82d6wgM_tCH2Tu_sqAd1ASB952iEgZ3eKEmYqL7tLfeDy8T6aloPjyCPlgFDfVUd11HjSS1JBhiPq7OZrgBRJ0UEH9b4zdMez820Tf-YeJxe488S-9jtZ3jt9oqHxmJLqsTbUVTfHVqQ7eaxn58lOUzjaruiV5hDrruYV0fTMnDw-ZGQG9nfXhwRBLh38UGP6rI1pcoNqV5sOgNBqOhoD2YkrTvH637tFXU',
    primaryAction: 'Xem chi tiết',
  },
  {
    id: 'HG-77318',
    serviceName: 'Giặt là & sấy khô cao cấp',
    statusLabel: 'Đã hủy',
    statusTone: 'cancelled',
    schedule: '12/05/2024, 10:00',
    meta: 'Bạn đã hủy yêu cầu',
    price: '250.000đ',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDzQp__HQj35Wtf_APZGd3SAV16k5O1d0R6LA3qMcOrrMamAsQL1GJ7E4u75sjIxU5ytu7i3C16LsSYY7uzw3CUWEczLSSuvxPBgsqLvmAn76hkwao0L6h4tSt80ZREvWd9qOOc5Upa0bcZ6a3zXQdj26_5BkZhyNaR2igW7ZRHf5eMu9cPDKqUQ_pQcts13zZv8hFIJPJLCw5_DRBfuGx4dmMV1UKXVdmJO2_vSsKRM7DtMgnGZl9LJyKUGG7z0irMeuqjil7wQns',
    primaryAction: 'Đặt lại',
    secondaryAction: 'Chi tiết',
  },
  {
    id: 'HG-69012',
    serviceName: 'Thông tắc & sửa vòi nước',
    statusLabel: 'Đã hoàn thành',
    statusTone: 'completed',
    schedule: '05/05/2024, 14:00',
    meta: 'Chuyên gia: Hoàng Nam',
    price: '350.000đ',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBKNdgcO65mL9e09ln6Cvzzz8NACq9AZBZ25NQb4c1SdgAJBpXUg79ob99rvjXKIo31kX04jkIITEWmltZId0NwrJPnRfO7vtGnuy7UY60ICkmOBG6Ot4rgKMQpXcaYr9QaSeazlMi0svS-a8PedDcfNp3CQroxfXajbVExwJX8xI6GJPEC8qpOtcuzanUiwaYbqTXYwDN79Ceja21EmrB3hxUk9DpS_hrKrZFs1ZFoSuueFQ4wU6PEkxj671S8yDl6D6iZcXdU79M',
    primaryAction: 'Xem chi tiết',
    rating: '5.0',
  },
];

export const serviceTypes: ServiceTypeOption[] = [
  { id: 'cleaning', label: 'Dọn dẹp', icon: 'cleaning_services' },
  { id: 'plumbing', label: 'Điện nước', icon: 'plumbing' },
  { id: 'electrical', label: 'Thiết bị điện', icon: 'electrical_services' },
  { id: 'hvac', label: 'Máy lạnh/HVAC', icon: 'ac_unit' },
];

export const servicePackages: ServicePackage[] = [
  {
    id: 'home-cleaning',
    name: 'Dọn dẹp nhà cửa',
    description: 'Dọn dẹp định kỳ cơ bản hằng tuần.',
    price: '250.000đ/giờ',
  },
  {
    id: 'deep-cleaning',
    name: 'Tổng vệ sinh',
    description: 'Vệ sinh chuyên sâu toàn bộ ngóc ngách.',
    price: '850.000đ/gói',
  },
  {
    id: 'sofa-cleaning',
    name: 'Vệ sinh sofa/nệm',
    description: 'Xử lý vết bẩn bằng máy hút chuyên dụng.',
    price: '400.000đ/bộ',
  },
];

export const selectedServiceImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCWxoRZ2umqxPICm4SQB4Wanr6HXDRWAFu6KqKkZwU4RrcIm8RKXkuKLtgtYD4vxuBvBYJBTH6ccbiQomYicpcx6qI5BmJhK-HlJZ_uaGCII0mvdAyrnVrXfZ2lHiHZy-76eTtoJy1DLbTbkC9s99flrUGUoEv7rCI6aGcDvAwGwAjPH-TMHo_Ir0DfIIsLFRfqIqzNoC_QE7dBqwIN0bEzc-_5OhoZDNnflCi3RafnTIAhS5iRT8auG4OTHVEWEDJ2Ert7ckZrGZI';

export const mapImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAf44RiGlNYqtCcL-L7C8JJCCGm7sIPTniApLCsYEMvBdmK4hPcZEaKaeGKXIMVE7_V42-AkKRhK3_oDwSTX5dYZSfUI3BRN32To8FG7CC9cOrqPjx5XqNCKnDFttu2kikLTPx9B-wM9519mzJbifjM71cb-SkvhNCPw2_X9vr3ITO3wujVhQaKv-gaPsqzHNz5U9t5pvayIpgCa0t_bUk_SYmGJmT7swYLda_j2LIuXPIB0sOvnvijKLX04O5fUt9FUcXvLFz3mTo';

export const providerAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ0GO_qWtP836LOZCHFgXzsplok2uJJMZ5lUVdKCKVdPAB3jB38Zw94IHT3_-Sr9GUgXeNd9nTTbgP0rwKQfAK4j3o63rYHiYzEunJiEnK0DIEoj8P-GRE0_SedVHxDQyHzVFzuL7EqWkUuGc8LqKoMLe8kEHZMf-_DrYldMluBCZy2FI3sxLbr0dFeKxvcPv-i0oWLeALEOPz_gls_nH4-KeOvFq40sBCEHMmV87_ZvkkjS8QZm6dL0JO7ibS7s6veYav-jTZD0A';
