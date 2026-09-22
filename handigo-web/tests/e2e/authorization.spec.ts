import { test, expect, customer } from './fixtures/handigo';

for (const path of ['/customer/bookings/new', '/provider/orders', '/admin/users']) {
  test(`Khách chưa đăng nhập không truy cập được ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  });
}

for (const role of ['CUSTOMER', 'PROVIDER', 'ADMIN'] as const) {
  const home = { CUSTOMER: '/customer', PROVIDER: '/provider', ADMIN: '/admin' }[role];
  const forbidden = { CUSTOMER: ['/admin/users', '/provider/orders'],
    PROVIDER: ['/admin/users', '/customer/bookings/new'],
    ADMIN: ['/customer/bookings/new', '/provider/orders'] }[role];
  for (const path of forbidden) {
    test(`${role} bị chuyển về trang của mình khi mở ${path}`, async ({ page, api }) => {
      api.user = { ...customer, role, providerOnboardingStatus: role === 'PROVIDER' ? 'APPROVED' : null };
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${home}$`));
      await expect(page.getByText('Đang khôi phục phiên đăng nhập...', { exact: true })).toHaveCount(0);
    });
  }
}

test('Provider chưa được duyệt không truy cập trang nhận đơn', async ({ page, api }) => {
  api.user = { ...customer, role: 'PROVIDER', providerOnboardingStatus: 'PENDING_REVIEW' };
  await page.goto('/provider/orders');
  await expect(page).toHaveURL(/\/register-provider$/);
});

test('Phiên hết hiệu lực đưa khách về đăng nhập', async ({ page, api }) => {
  api.user = { ...customer };
  await page.goto('/customer/bookings/new');
  await expect(page.getByRole('heading', { name: /Chọn loại dịch vụ/ })).toBeVisible();
  api.user = null;
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

for (const item of [
  { role: 'ADMIN' as const, path: '/admin/users', heading: 'Quản lý người dùng' },
  { role: 'PROVIDER' as const, path: '/provider/orders', heading: 'Đơn dịch vụ' },
]) {
  test(`${item.role} truy cập được trang đúng quyền`, async ({ page, api }) => {
    api.user = { ...customer, role: item.role, providerOnboardingStatus: 'APPROVED' };
    await page.goto(item.path);
    await expect(page).toHaveURL(new RegExp(`${item.path}$`));
    await expect(page.getByRole('heading', { name: item.heading, exact: true })).toBeVisible();
  });
}
