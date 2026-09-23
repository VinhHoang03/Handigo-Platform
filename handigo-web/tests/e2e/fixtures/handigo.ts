import { test as base, expect, type Page } from '@playwright/test';
import type { User } from '../../../src/features/auth/types/auth.types';
import type { Address, Category, Service, Order } from '../../../src/types/booking';

export const customer: User = {
  id: 'customer-e2e', email: 'customer@example.test', fullName: 'Khách kiểm thử',
  role: 'CUSTOMER', phone: '0900000000', status: 'active',
};
export const category: Category = {
  _id: 'category-e2e', name: 'Vệ sinh kiểm thử', slug: 've-sinh-e2e', isActive: true,
};
export const service: Service = {
  _id: 'service-e2e', categoryId: category._id, name: 'Vệ sinh nhà kiểm thử',
  slug: 've-sinh-nha-e2e', serviceType: 'fixed_price', fixedPrice: 200000,
  requiresOptionSelection: false, isActive: true,
};
export const address: Address = {
  _id: 'address-e2e', userId: customer.id, recipientName: customer.fullName,
  recipientPhone: customer.phone, fullAddress: '123 Đường Kiểm Thử, Phường Bến Thành, Hồ Chí Minh',
  province: 'Hồ Chí Minh', ward: 'Bến Thành', latitude: 10.77, longitude: 106.69,
  isDefault: true,
};
export const order: Order = {
  _id: 'order-e2e', orderCode: 'HD-E2E-001', customerId: customer.id,
  serviceId: service, addressId: address, selectedOptionIds: [], orderType: 'normal',
  status: 'created', paymentMethod: 'cash', paymentStatus: 'unpaid',
  pricing: { bookingAmount: 200000, platformCommissionRate: 0.1,
    platformCommissionAmount: 20000, providerEarningAmount: 180000,
    promotionDiscountAmount: 0, voucherDiscountAmount: 0, totalPaidAmount: 0 },
  createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z',
};

export type ApiState = {
  user: User | null;
  loginUser: User;
  loginError: string | null;
  orderError: string | null;
  providersAvailable: boolean;
  createdOrder: Order | null;
  writes: Array<{ path: string; body: Record<string, unknown> }>;
};

// Mỗi test có trạng thái riêng; mọi request API đều bị chặn trước backend thật.
export const test = base.extend<{ api: ApiState }>({
  api: [async ({ page }, use) => {
    const state: ApiState = {
      user: null, loginUser: { ...customer }, loginError: null, orderError: null,
      providersAvailable: true, createdOrder: null, writes: [],
    };
    await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api/, '');
      const method = request.method();
      const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
      const data = (value: unknown) => reply({ success: true, data: value });
      if (method !== 'GET') state.writes.push({ path, body: request.postData() ? request.postDataJSON() : {} });
      if (path === '/auth/refresh-token') return state.user
        ? reply({ token: 'token-gia-lap-e2e' }) : reply({ message: 'Chưa đăng nhập' }, 401);
      if (path === '/auth/me') return state.user
        ? reply({ user: state.user }) : reply({ message: 'Chưa đăng nhập' }, 401);
      if (path === '/auth/login') {
        if (state.loginError) return reply({ message: state.loginError }, 401);
        state.user = { ...state.loginUser };
        return reply({ user: state.user, token: 'token-gia-lap-e2e' });
      }
      if (path === '/auth/logout') { state.user = null; return reply({ message: 'Đã đăng xuất' }); }
      if (method === 'GET') {
        if (path === '/categories/active') return data([category]);
        if (path === '/services') return data({ items: [service] });
        if (path === `/services/${service._id}`) return data(service);
        if (path === `/services/${service._id}/options`) return data([]);
        if (path === '/addresses') return data([address]);
        if (path === '/vouchers/available') return data([]);
        if (path === '/wallets/me') return data({ balance: 0 });
        if (path === '/providers/nearby') return data(state.providersAvailable ? [{
          id: 'provider-e2e', user: { id: 'provider-user-e2e', fullName: 'Chuyên gia kiểm thử' },
          services: [{ id: service._id, name: service.name }], workingAreas: [],
          availabilityStatus: 'online', averageRating: 5, totalFeedbacks: 1,
          totalCompletedOrders: 10, distanceMeters: 500,
        }] : []);
        if (path === `/orders/${order._id}`) return state.createdOrder
          ? data(state.createdOrder) : reply({ message: 'Không tìm thấy đơn' }, 404);
        if (path === '/orders') return data({ items: state.createdOrder ? [state.createdOrder] : [],
          pagination: { page: 1, limit: 10, total: state.createdOrder ? 1 : 0, totalPages: 1 } });
      }
      if (path === '/orders' && method === 'POST') {
        if (state.orderError) return reply({ message: state.orderError }, 400);
        state.createdOrder = { ...order, problemDescription: request.postDataJSON().problemDescription };
        return data(state.createdOrder);
      }
      if (path === '/payments/create' && method === 'POST') return data({
        payment: { _id: 'payment-e2e', orderId: order._id, amount: 200000,
          method: 'cash', paymentType: 'full', status: 'pending' }, paymentType: 'full',
      });
      // Các tiện ích ngoài phạm vi (chat, thông báo, ví...) nhận lỗi có kiểm soát.
      return reply({ message: 'API ngoài phạm vi bộ kiểm thử giao diện' }, 503);
    });
    await page.route('**/socket.io/**', (route) => route.abort());
    await use(state);
  }, { auto: true }],
});

export { expect };

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(customer.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('MatKhauGiaLap123!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

export async function selectService(page: Page) {
  await page.goto('/customer/bookings/new');
  await page.getByRole('button', { name: new RegExp(service.name) }).click();
  await page.getByRole('button', { name: 'Tiếp tục bước 2' }).click();
  await expect(page).toHaveURL(/\/customer\/bookings\/new\/location$/);
  await page.getByText('Đặt lịch ngay', { exact: true }).click();
}
