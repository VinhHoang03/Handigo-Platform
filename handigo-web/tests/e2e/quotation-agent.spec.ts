import { test, expect, customer, order, service } from './fixtures/handigo';
import type { QuotationAgentSnapshot } from '../../src/features/provider/types/quotationAgent.types';

const history = { id: 'history-e2e', title: 'Tụ 35uF', description: '450V', itemType: 'replacement_part', unitPrice: 180000, usedAt: '2026-09-20T00:00:00.000Z' };

test.beforeEach(async ({ page, api }) => {
  api.user = { ...customer, role: 'PROVIDER', providerOnboardingStatus: 'APPROVED' };
  await page.route('**/api/orders/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path.endsWith('/assignments/pending')) return reply([]);
    if (path.endsWith('/quotation')) return reply(null);
    if (path.endsWith(`/orders/${order._id}`)) return reply({ ...order, status: 'accepted', inspectionRequired: true,
      serviceId: { ...service, serviceType: 'variable_price', name: 'Sửa điều hòa' } });
    if (path.endsWith('/quotation-agent/history')) return reply({ items: [], autoFillId: null });
    return route.fulfill({ status: 503, json: { message: 'API ngoài phạm vi kiểm thử báo giá' } });
  });
});

test('Agent điền nhiều dòng, sửa số lượng, giữ ghi chú và hoàn tác', async ({ page, api }) => {
  let turn = 0;
  await page.route('**/quotation-agent/assist', async (route) => {
    const body = route.request().postDataJSON() as QuotationAgentSnapshot;
    turn++;
    await route.fulfill({ json: { success: true, data: { revision: body.revision, message: 'Đã cập nhật báo giá.', sources: [], warnings: [],
      updates: turn === 1 ? [
        { rowId: body.items[0].rowId, fields: { title: 'Tụ 35uF', quantity: 2, unitPrice: 180000, itemType: 'replacement_part' } },
        { fields: { title: 'Công thay', quantity: 1, unitPrice: 100000, itemType: 'labor' } },
      ] : [{ rowId: body.items[0].rowId, fields: { quantity: 3 } }],
    } } });
  });
  await page.goto(`/provider/orders/${order._id}`);
  await page.getByLabel('Mô tả báo giá', { exact: true }).fill('Thay hai tụ, mỗi cái 180 nghìn, công 100 nghìn');
  await page.getByRole('button', { name: 'Điền báo giá', exact: true }).click();
  await expect(page.getByLabel('Tên hạng mục')).toHaveCount(2);
  await expect(page.getByLabel('Số lượng', { exact: true }).first()).toHaveValue('2');
  await page.getByLabel('Ghi chú hạng mục').first().fill('Giữ bảo hành');
  await page.getByLabel('Mô tả báo giá', { exact: true }).fill('Đổi thành ba tụ');
  await page.getByRole('button', { name: 'Điền báo giá', exact: true }).click();
  await expect(page.getByLabel('Số lượng', { exact: true }).first()).toHaveValue('3');
  await expect(page.getByLabel('Đơn giá (VND)').first()).toHaveValue('180000');
  await expect(page.getByLabel('Ghi chú hạng mục').first()).toHaveValue('Giữ bảo hành');
  await page.getByRole('button', { name: 'Hoàn tác lần điền AI vừa rồi' }).click();
  await expect(page.getByLabel('Số lượng', { exact: true }).first()).toHaveValue('2');
  expect(api.writes.filter((entry) => entry.path.endsWith('/quotations'))).toHaveLength(0);
});

test('Phản hồi AI đến muộn không ghi đè form mới', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/quotation-agent/assist', async (route) => {
    const body = route.request().postDataJSON() as QuotationAgentSnapshot;
    await gate;
    await route.fulfill({ json: { success: true, data: { revision: body.revision, message: 'Đã điền', warnings: [], sources: [],
      updates: [{ rowId: body.items[0].rowId, fields: { title: 'Tên cũ', quantity: 2, unitPrice: 100000 } }] } } });
  });
  await page.goto(`/provider/orders/${order._id}`);
  await page.getByLabel('Mô tả báo giá', { exact: true }).fill('Thay tụ 100 nghìn');
  const sent = page.waitForRequest('**/quotation-agent/assist');
  await page.getByRole('button', { name: 'Điền báo giá', exact: true }).click(); await sent;
  await page.getByLabel('Tên hạng mục', { exact: true }).fill('Tên mới provider nhập');
  release();
  await expect(page.getByRole('alert')).toContainText('Form đã thay đổi');
  await expect(page.getByLabel('Tên hạng mục', { exact: true })).toHaveValue('Tên mới provider nhập');
});

test('Lịch sử điền giá khớp duy nhất và giữ giá provider đã sửa', async ({ page }) => {
  await page.route('**/quotation-agent/history?*', (route) => route.fulfill({ json: { success: true, data: { items: [history], autoFillId: history.id } } }));
  await page.goto(`/provider/orders/${order._id}`);
  await page.getByLabel('Tên hạng mục', { exact: true }).fill(history.title);
  await expect(page.getByLabel('Đơn giá (VND)')).toHaveValue('180000');
  await expect(page.getByLabel('Mô tả hạng mục')).toHaveValue('450V');
  await page.getByLabel('Đơn giá (VND)').fill('210000');
  await page.getByLabel('Tên hạng mục', { exact: true }).fill('Tụ 35uF mới');
  await expect(page.getByLabel('Tên hạng mục', { exact: true })).toHaveValue(history.title);
  await expect(page.getByLabel('Đơn giá (VND)')).toHaveValue('210000');
});

test('Nhiều kết quả lịch sử phải chọn và dòng thiếu giá không bị bỏ khi gửi', async ({ page }) => {
  await page.route('**/quotation-agent/history?*', (route) => route.fulfill({ json: { success: true, data: {
    items: [history, { ...history, id: 'second', title: 'Tụ 40uF', unitPrice: 200000 }], autoFillId: null,
  } } }));
  await page.goto(`/provider/orders/${order._id}`);
  await page.getByLabel('Tên hạng mục', { exact: true }).fill('Tụ');
  await expect(page.getByLabel('Gợi ý từ lịch sử báo giá')).toBeVisible();
  await expect(page.getByLabel('Đơn giá (VND)')).toHaveValue('0');
  await page.getByLabel('Gợi ý từ lịch sử báo giá').getByRole('button', { name: /Tụ 40uF/ }).click();
  await expect(page.getByLabel('Đơn giá (VND)')).toHaveValue('200000');
  await page.getByRole('button', { name: '+ Thêm hạng mục', exact: true }).click();
  await page.getByLabel('Tên hạng mục', { exact: true }).nth(1).fill('Chưa có giá');
  await page.getByRole('button', { name: 'Gửi báo giá cho khách hàng' }).click();
  await expect(page.getByRole('alert')).toContainText('tất cả hạng mục');
});

test('Ghi âm tạo WAV, hiển thị văn bản nhận dạng rồi điền form', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  let receivedAudio = false;
  await page.route('**/quotation-agent/transcribe', async (route) => {
    const body = route.request().postDataBuffer();
    receivedAudio = Boolean(body?.includes(Buffer.from('RIFF')) && body.includes(Buffer.from('WAVE')));
    await route.fulfill({ json: { success: true, data: { transcript: 'Công thay 100 nghìn' } } });
  });
  await page.route('**/quotation-agent/assist', async (route) => {
    const body = route.request().postDataJSON() as QuotationAgentSnapshot;
    await route.fulfill({ json: { success: true, data: { revision: body.revision, message: 'Đã điền', warnings: [], sources: [],
      updates: [{ rowId: body.items[0].rowId, fields: { title: 'Công thay', unitPrice: 100000 } }] } } });
  });
  await page.goto(`/provider/orders/${order._id}`);
  await page.getByRole('button', { name: 'Nhập bằng giọng nói' }).click();
  await expect(page.getByRole('button', { name: 'Dừng ghi âm' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Dừng ghi âm' }).click();
  await expect(page.getByLabel('Mô tả báo giá', { exact: true })).toHaveValue('Công thay 100 nghìn');
  expect(receivedAudio).toBe(true);
  await page.getByRole('button', { name: 'Điền báo giá', exact: true }).click();
  await expect(page.getByLabel('Đơn giá (VND)')).toHaveValue('100000');
});

test('Lỗi AI giữ dữ liệu, gửi báo giá vẫn dùng hợp đồng cũ và không kèm metadata', async ({ page }) => {
  await page.route('**/quotation-agent/history?*', (route) => route.fulfill({ json: { success: true, data: { items: [history], autoFillId: history.id } } }));
  await page.route('**/quotation-agent/assist', (route) => route.fulfill({ status: 503, json: { message: 'AI báo giá tạm thời hết hạn mức.' } }));
  await page.route('**/quotation-items/validate', (route) => route.fulfill({ json: { success: true,
    data: { relevance: { status: 'passed', serviceName: 'Sửa điều hòa', evaluations: [] } } } }));
  let sent: { items: Array<Record<string, unknown>> } | null = null;
  await page.route('**/orders/*/quotations', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { success: true, data: { _id: 'quotation-e2e', status: 'pending' } } });
  });
  await page.goto(`/provider/orders/${order._id}`);
  await page.getByLabel('Tên hạng mục', { exact: true }).fill(history.title);
  await expect(page.getByLabel('Đơn giá (VND)')).toHaveValue('180000');
  await page.getByLabel('Mô tả báo giá', { exact: true }).fill('Đổi số lượng thành hai');
  await page.getByRole('button', { name: 'Điền báo giá', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('hết hạn mức');
  await expect(page.getByLabel('Đơn giá (VND)')).toHaveValue('180000');
  await expect(page.getByLabel('Số lượng', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Gửi báo giá cho khách hàng' }).click();
  await expect.poll(() => sent).not.toBeNull();
  expect(sent!.items).toEqual([{ title: history.title, description: history.description, quantity: 1, unitPrice: history.unitPrice, itemType: history.itemType }]);
});

test('Từ chối quyền micro vẫn nhập báo giá thủ công được', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Không cấp quyền', 'NotAllowedError'); } });
  });
  await page.goto(`/provider/orders/${order._id}`);
  await page.getByRole('button', { name: 'Nhập bằng giọng nói' }).click();
  await expect(page.getByRole('alert')).toContainText('Không truy cập được micro');
  await page.getByLabel('Mô tả báo giá', { exact: true }).fill('Công sửa 100 nghìn');
  await expect(page.getByRole('button', { name: 'Điền báo giá', exact: true })).toBeEnabled();
});
