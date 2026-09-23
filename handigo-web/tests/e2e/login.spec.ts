import { test, expect, customer, login } from './fixtures/handigo';

test('Hiển thị biểu mẫu và cho phép hiện, ẩn mật khẩu', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible();
  const password = page.getByLabel('Mật khẩu', { exact: true });
  await password.fill('DuLieuGiaLap123!');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('Không gửi đăng nhập khi thiếu dữ liệu hoặc email sai định dạng', async ({ page, api }) => {
  await page.goto('/login');
  const submit = page.getByRole('button', { name: 'Đăng nhập', exact: true });
  await submit.click();
  expect(await page.getByLabel('Email', { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await page.getByLabel('Email', { exact: true }).fill('email-khong-hop-le');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('DuLieuGiaLap123!');
  await submit.click();
  expect(await page.getByLabel('Email', { exact: true }).evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);
  expect(api.writes.filter(({ path }) => path === '/auth/login')).toHaveLength(0);
});

test('Hiển thị lỗi khi API từ chối đăng nhập', async ({ page, api }) => {
  api.loginError = 'Email hoặc mật khẩu không chính xác';
  await login(page);
  await expect(page.getByRole('alert')).toHaveText(api.loginError);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeEnabled();
});

for (const remember of [true, false]) {
  test(`Đăng nhập CUSTOMER và khôi phục phiên, ghi nhớ: ${remember}`, async ({ page, api }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(customer.email.toUpperCase());
    await page.getByLabel('Mật khẩu', { exact: true }).fill('MatKhauGiaLap123!');
    await page.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' }).setChecked(remember);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(/\/customer$/);
    expect(api.writes.find(({ path }) => path === '/auth/login')?.body).toEqual({
      email: customer.email, password: 'MatKhauGiaLap123!', remember,
    });
    await page.goto('/customer/bookings/new');
    await expect(page.getByRole('heading', { name: /Chọn loại dịch vụ/ })).toBeVisible();
  });
}

test('Mở trang quên mật khẩu và đăng ký', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.goto('/login');
  await page.getByRole('link', { name: 'Đăng ký ngay' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

for (const role of ['ADMIN', 'PROVIDER'] as const) {
  test(`Đăng nhập ${role} chuyển tới đúng trang`, async ({ page, api }) => {
    api.loginUser = { ...customer, role, providerOnboardingStatus: role === 'PROVIDER' ? 'APPROVED' : null };
    await login(page);
    await expect(page).toHaveURL(role === 'ADMIN' ? /\/admin$/ : /\/provider$/);
    expect(api.writes.filter(({ path }) => path === '/auth/login')).toHaveLength(1);
  });
}
