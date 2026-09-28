import { test, expect, customer } from './fixtures/handigo';
import type { AgentSession } from '../../src/features/chatbot/types/agent.types';

test('Gửi nhiều lựa chọn, xem tiến trình và sửa bản đặt lịch chưa xác nhận', async ({ page, api }) => {
  api.user = { ...customer };
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const initial: AgentSession = {
    sessionId, state: 'WAITING_USER_INPUT', currentGoal: 'Đặt vệ sinh nhà',
    messages: [{ _id: 'cau-hoi', sender: 'assistant', content: 'Chọn gói và giờ hẹn phù hợp.', createdAt: new Date().toISOString(),
      choiceGroups: [
        { label: 'Gói dịch vụ', multiple: false, options: ['Nhà dưới 50 m²', 'Nhà từ 50 đến 100 m²'] },
        { label: 'Giờ hẹn', multiple: false, options: ['9 giờ sáng mai', '14 giờ chiều mai'] },
      ] }],
    pendingConfirmation: null, requiresReconciliation: false, interruptedRequest: null, requiresNewSession: false,
  };
  let requestId = '';
  const sent: Array<{ message?: string; confirmation?: unknown }> = [];
  const replyGate = { release: () => {} };
  await page.route('**/api/ai/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path.endsWith('/sessions/latest')) return reply(initial);
    if (path.endsWith('/progress')) return reply({ sessionId, requestId, state: 'EXECUTING_TOOL',
      activity: { requestId, message: 'Đang kiểm tra giá và chuẩn bị bản xác nhận', updatedAt: new Date().toISOString() } });
    if (path.endsWith('/messages')) {
      const input = route.request().postDataJSON();
      sent.push(input);
      requestId = input.requestId;
      if (sent.length === 1) await new Promise<void>((resolve) => { replyGate.release = resolve; });
      return reply({ ...initial, state: 'WAITING_CONFIRMATION', messages: [
        { _id: `khach-${sent.length}`, sender: 'user', content: input.message, createdAt: new Date().toISOString() },
        { _id: `tro-ly-${sent.length}`, sender: 'assistant', content: 'Kiểm tra thông tin đặt lịch.', createdAt: new Date().toISOString() },
      ], pendingConfirmation: { actionId: `xac-nhan-${sent.length}`, tool: 'create_booking',
        preview: { title: 'Tạo đơn dịch vụ', service: 'Vệ sinh nhà', amount: 200000 }, expiresAt: new Date(Date.now() + 600000).toISOString() } });
    }
    return route.fulfill({ status: 503, json: { message: 'Ngoài phạm vi kiểm thử' } });
  });
  await page.goto('/customer/bookings');
  await page.getByRole('button', { name: 'Mở Trợ lý Handigo' }).click();
  await page.getByRole('radio', { name: 'Nhà dưới 50 m²', exact: true }).check();
  await page.getByRole('radio', { name: '9 giờ sáng mai', exact: true }).check();
  await page.getByLabel('Bổ sung số lượng, giờ hẹn hoặc yêu cầu khác').fill('Ưu tiên vệ sinh phòng khách');
  await page.getByRole('button', { name: 'Gửi các lựa chọn', exact: true }).click();
  await expect(page.getByText('Đang kiểm tra giá và chuẩn bị bản xác nhận', { exact: true })).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0].message).toContain('Nhà dưới 50 m²');
  expect(sent[0].message).toContain('9 giờ sáng mai');
  expect(sent[0].message).toContain('Ưu tiên vệ sinh phòng khách');
  replyGate.release();
  await expect(page.getByRole('button', { name: 'Xác nhận', exact: true })).toBeVisible();
  const composer = page.getByLabel('Nội dung gửi cho Trợ lý Handigo');
  await expect(composer).toBeEnabled();
  await composer.fill('Đổi sang 14 giờ');
  await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].message).toBe('Đổi sang 14 giờ');
  expect(sent.every((input) => !input.confirmation)).toBe(true);
});
