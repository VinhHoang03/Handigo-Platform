import { test, expect, login } from './fixtures/handigo';

const realApiEnabled = process.env.E2E_REAL_API === '1';
const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

type ApiResult = { status: number; body: unknown };
type ApiInit = { method?: string; body?: string; headers?: Record<string, string> };
type AddressRecord = { _id: string };
type ServiceRecord = { _id: string; isActive: boolean; isDeleted: boolean };
type ServiceOptionRecord = { _id: string; isActive: boolean; isDeleted: boolean };
type OrderRecord = { _id: string; serviceId: unknown; addressId: string };
type ApiEnvelope<T> = { data?: T };

async function api(
  page: import('@playwright/test').Page,
  path: string,
  init?: ApiInit,
  token?: string,
): Promise<ApiResult> {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, {
    path,
    init: {
      ...init,
      headers: {
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  });
}

test.describe('Backend thật', () => {
  test.skip(!realApiEnabled, 'Bật E2E_REAL_API=1 để chạy với backend thật.');

  test('CUSTOMER đăng nhập qua API và mở được trang đặt dịch vụ', async ({ page }) => {
    test.skip(!customerEmail || !customerPassword,
      'Cần E2E_CUSTOMER_EMAIL và E2E_CUSTOMER_PASSWORD của tài khoản test.');

    await login(page);
    await expect(page).toHaveURL(/\/customer$/);
    await page.goto('/customer/bookings/new');
    await expect(page.getByRole('heading', { name: /Chọn loại dịch vụ/ })).toBeVisible();
  });

  test('CUSTOMER không truy cập được trang ADMIN', async ({ page }) => {
    test.skip(!customerEmail || !customerPassword,
      'Cần E2E_CUSTOMER_EMAIL và E2E_CUSTOMER_PASSWORD của tài khoản test.');

    await login(page);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/customer$/);
  });

  test('Tạo đơn bằng service, option và address lấy từ backend thật', async ({ page }) => {
    test.skip(!customerEmail || !customerPassword,
      'Cần E2E_CUSTOMER_EMAIL và E2E_CUSTOMER_PASSWORD của tài khoản test.');

    const token = await login(page);
    await expect(page).toHaveURL(/\/customer$/);
    if (!token) throw new Error('Không lấy được access token sau khi đăng nhập.');

    const addresses = await api(page, '/addresses', undefined, token);
    expect(addresses.status, JSON.stringify(addresses.body)).toBe(200);
    const addressBody = addresses.body as ApiEnvelope<AddressRecord[]> | null;
    const address = addressBody?.data?.[0] ?? null;
    if (!address?._id) {
      test.skip(true, 'Tài khoản test chưa có địa chỉ trong backend.');
      return;
    }

    const services = await api(page, '/services?page=1&limit=100', undefined, token);
    expect(services.status, JSON.stringify(services.body)).toBe(200);
    const servicesBody = services.body as ApiEnvelope<{ items?: ServiceRecord[] }> | null;
    const items = servicesBody?.data?.items ?? [];
    let selectedService: ServiceRecord | null = null;
    let selectedOption: ServiceOptionRecord | null = null;
    for (const candidate of items) {
      if (!candidate.isActive || candidate.isDeleted) continue;
      const options = await api(page, `/services/${candidate._id}/options`, undefined, token);
      if (options.status !== 200) continue;
      const optionsBody = options.body as ApiEnvelope<ServiceOptionRecord[]> | null;
      const activeOption = optionsBody?.data?.find((option) => option.isActive && !option.isDeleted) ?? null;
      if (activeOption) {
        const nearby = await api(
          page,
          `/providers/nearby?serviceId=${encodeURIComponent(candidate._id)}&addressId=${encodeURIComponent(address._id)}`,
          undefined,
          token,
        );
        const nearbyBody = nearby.body as ApiEnvelope<unknown[]> | null;
        const hasProvider = nearby.status === 200 && (nearbyBody?.data?.length ?? 0) > 0;
        if (!hasProvider) continue;
        selectedService = candidate;
        selectedOption = activeOption;
        break;
      }
    }
    if (!selectedService || !selectedOption) {
      test.skip(true, 'Địa chỉ test chưa có provider phù hợp với service và option đang hoạt động.');
      return;
    }

    const createOrder = await api(page, '/orders', {
      method: 'POST',
      body: JSON.stringify({
        serviceId: selectedService._id,
        selectedOptionIds: [selectedOption._id],
        selectedOptions: [{ optionId: selectedOption._id, quantity: 1 }],
        addressId: address._id,
        orderType: 'normal',
        problemDescription: 'Kiểm thử tích hợp backend thật bằng Playwright.',
        paymentMethod: 'cash',
      }),
    }, token);
    expect(createOrder.status, JSON.stringify(createOrder.body)).toBe(201);
    const createdOrder = (createOrder.body as ApiEnvelope<OrderRecord> | null)?.data;
    if (!createdOrder) {
      throw new Error(`Backend không trả về đơn hàng: ${JSON.stringify(createOrder.body)}`);
    }
    expect(createdOrder?._id).toBeTruthy();
    expect(createdOrder.serviceId).toBeTruthy();
    expect(createdOrder.addressId).toBe(address._id);

    const detail = await api(page, `/orders/${createdOrder._id}`, undefined, token);
    expect(detail.status, JSON.stringify(detail.body)).toBe(200);
    const detailOrder = (detail.body as ApiEnvelope<OrderRecord> | null)?.data;
    expect(detailOrder?._id).toBe(createdOrder._id);

    // Đơn chưa thanh toán được xóa để mỗi lần chạy không tạo dữ liệu rác.
    const cleanup = await api(page, `/orders/${createdOrder._id}/unpaid`, { method: 'DELETE' }, token);
    expect([200, 204, 404]).toContain(cleanup.status);
  });
});
