import { test, expect, customer, service, address, order, selectService } from './fixtures/handigo';

test.beforeEach(async ({ api }) => { api.user = { ...customer }; });

test('Chặn bước tiếp theo khi chưa chọn dịch vụ', async ({ page }) => {
  await page.goto('/customer/bookings/new');
  await expect(page.getByRole('button', { name: 'Tiếp tục bước 2' })).toBeDisabled();
  await expect(page).toHaveURL(/\/customer\/bookings\/new$/);
});

test('Chặn mô tả ngắn và cho phép tìm thợ tự động khi chưa có chuyên gia', async ({ page, api }) => {
  api.providersAvailable = false;
  await selectService(page);
  await expect(page.getByText('Chưa có thợ phù hợp gần địa chỉ này. Bạn có thể tiếp tục để hệ thống tìm và mở rộng bán kính tự động.', { exact: true })).toBeVisible();
  await page.getByLabel('Mô tả tình trạng').fill('Ngắn');
  await page.getByRole('button', { name: 'Tiếp tục bước 3' }).click();
  await expect(page.getByText('Vui lòng mô tả tình trạng tối thiểu 10 ký tự.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/location$/);
  await page.getByLabel('Mô tả tình trạng').fill('Cần vệ sinh nhà và phòng khách.');
  await page.getByRole('button', { name: 'Tiếp tục bước 3' }).click();
  await expect(page).toHaveURL(/\/payment$/);
  expect(api.writes.filter(({ path }) => path === '/orders')).toHaveLength(0);
});

for (const fails of [false, true]) {
  test(fails ? 'Giữ trang xác nhận và hiển thị lỗi khi tạo đơn thất bại' : 'Đặt dịch vụ bằng tiền mặt và xem đơn trong lịch sử', async ({ page, api }) => {
    if (fails) api.orderError = 'Dịch vụ tạm ngừng nhận đơn';
    await selectService(page);
    await expect(page.getByText('1 phù hợp', { exact: true })).toBeVisible();
    const description = 'Cần vệ sinh nhà và phòng khách.';
    await page.getByLabel('Mô tả tình trạng').fill(description);
    await page.getByRole('button', { name: 'Tiếp tục bước 3' }).click();
    await expect(page).toHaveURL(/\/payment$/);
    await page.getByText('Tiền mặt', { exact: true }).click();
    await expect(page.getByRole('radio', { name: /Tiền mặt/ })).toBeChecked();
    await page.getByRole('button', { name: 'Xác nhận & Thanh toán' }).click();
    if (fails) {
      await expect(page.getByRole('alert')).toHaveText(api.orderError!);
      await expect(page).toHaveURL(/\/payment$/);
      expect(api.writes.filter(({ path }) => path === '/payments/create')).toHaveLength(0);
      return;
    }
    await expect(page.getByRole('heading', { name: 'Đặt lịch thành công!' })).toBeVisible();
    await expect(page.getByText(order.orderCode, { exact: true })).toBeVisible();
    const orders = api.writes.filter(({ path }) => path === '/orders');
    expect(orders).toHaveLength(1);
    expect(orders[0].body).toMatchObject({ serviceId: service._id, addressId: address._id,
      selectedOptionIds: [], orderType: 'normal', problemDescription: description, paymentMethod: 'cash' });
    expect(api.writes.filter(({ path }) => path === '/payments/create').map(({ body }) => body))
      .toEqual([{ orderId: order._id, method: 'CASH', paymentType: 'FULL' }]);
    await page.goto('/customer/bookings');
    await expect(page.getByRole('link', { name: 'Chi tiết', exact: true }))
      .toHaveAttribute('href', `/customer/bookings/${order._id}`);
    await expect(page.getByRole('heading', { name: service.name, exact: true })).toBeVisible();
  });
}
