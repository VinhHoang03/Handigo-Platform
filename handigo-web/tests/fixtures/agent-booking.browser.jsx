import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ChatbotWidget } from '../../src/features/chatbot/components/ChatbotWidget';
import { AgentConfirmationCard } from '../../src/features/chatbot/components/AgentConfirmationCard';
import { ChatbotMessageList } from '../../src/features/chatbot/components/ChatbotMessageList';
import { ChatbotPanel } from '../../src/features/chatbot/components/ChatbotPanel';
import { saveAgentWalletResume, readAgentWalletResume, clearAgentWalletResume } from '../../src/features/chatbot/utils/agentWalletResume';

// Dữ liệu giả lập cho kiểm tra tương tác bằng trình duyệt; không đăng nhập hoặc gọi API thật.
const ids = {
  user: '111111111111111111111111', service: '222222222222222222222222',
  address: '333333333333333333333333', otherAddress: '444444444444444444444444',
  provider: '555555555555555555555555', order: '666666666666666666666666',
  session: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};
const returned = location.pathname === '/customer/wallet';
const visual = new URLSearchParams(location.search).get('visual');
const business = new URLSearchParams(location.search).has('business');
const scroll = new URLSearchParams(location.search).has('scroll');
const historyActions = new URLSearchParams(location.search).has('history-actions');
const paymentCancellation = new URLSearchParams(location.search).has('payment-cancellation');
const flowExtensions = new URLSearchParams(location.search).has('flow-extensions');
const calls = JSON.parse(sessionStorage.getItem('test:agent-calls') || '[]');
const log = (value) => { calls.push(value); sessionStorage.setItem('test:agent-calls', JSON.stringify(calls)); };
const fixture = window.__agentFixture = {
  ids, calls, policiesRead: 0, addressReads: 0, failNext: false,
  policies: {
    version: 'a'.repeat(64),
    paymentHoldMinutes: 17,
    matching: { initialRadiusKm: 10, expandedRadiusKm: 15, expandAfterMinutes: 3, expandedDurationMinutes: 2, providerResponseSeconds: 30 },
    fixedPriceRefund: {},
  },
  addresses: [
    { _id: ids.address, fullAddress: '12 Lê Lợi', ward: 'Phường A', province: 'Hà Nội', isDefault: true, recipientName: 'Nguyễn An', recipientPhone: '0912345678' },
    { _id: ids.otherAddress, fullAddress: '34 Nguyễn Trãi, Phường B, Hà Nội', ward: 'Phường B', province: 'Hà Nội', isDefault: false, recipientName: 'Trần Bình', recipientPhone: '0987654321' },
  ],
  providers: [{ id: ids.provider, user: { id: '777777777777777777777777', fullName: 'Nguyễn Minh' },
    services: [{ id: ids.service, name: 'Vệ sinh điều hòa' }], workingAreas: ['Hà Nội'], serviceArea: { ward: 'Phường B', province: 'Hà Nội' },
    availabilityStatus: 'online', averageRating: 4.8, totalFeedbacks: 5, totalCompletedOrders: 30, distanceMeters: 800 }],
  profile: {
    user: { id: '777777777777777777777777', fullName: 'Nguyễn Minh' },
    provider: { id: ids.provider, bio: 'Chuyên vệ sinh điều hòa tại nhà.', description: '', experienceYears: 5,
      availabilityStatus: 'online', verified: true, services: [{ id: ids.service, name: 'Vệ sinh điều hòa' }],
      serviceCategories: [], workingAreas: ['Hà Nội'], averageRating: 4.8, totalFeedbacks: 5,
      totalCompletedOrders: 30, identityVerified: true, certificates: [] },
    feedbacks: [{ id: 'review-1', rating: 5, comment: 'Đúng giờ và làm việc cẩn thận.', images: [], createdAt: new Date().toISOString(), customer: { fullName: 'Khách kiểm thử' }, service: { name: 'Vệ sinh điều hòa' } }],
  },
};
const values = { serviceId: ids.service, addressId: ids.address, uniformQuantity: 1, orderType: 'normal', paymentMethod: 'bank' };
const session = fixture.session = {
  sessionId: ids.session, state: 'WAITING_CONFIRMATION', currentGoal: 'Đặt vệ sinh điều hòa',
  requiresReconciliation: false, interruptedRequest: null, requiresNewSession: false,
  bookingDraft: { status: 'active', revision: 1, summary: [], missing: [], values },
  messages: [], payment: null, pendingConfirmation: null,
};
function confirmation(tool = 'create_booking') {
  const actionId = crypto.randomUUID();
  session.pendingConfirmation = { actionId, tool, expiresAt: new Date(Date.now() + 600000).toISOString(),
    preview: tool === 'create_booking' ? { title: 'Tạo đơn dịch vụ', service: 'Vệ sinh điều hòa', serviceType: 'fixed_price',
      policyVersion: fixture.policies.version,
      quantity: values.uniformQuantity, unitPrice: 200000, address: values.addressId === ids.address ? '12 Lê Lợi, Phường A, Hà Nội' : '34 Nguyễn Trãi, Phường B, Hà Nội',
      schedule: values.scheduledAt || 'Đặt ngay', paymentMethod: values.paymentMethod, amount: 200000 * values.uniformQuantity,
      customerAttachments: values.customerAttachments ?? [], addressStorage: values.saveAddressToBook === false ? 'Chỉ dùng cho đơn này, không lưu vào sổ địa chỉ' : undefined,
      providerName: values.preferredProviderId ? 'Nguyễn Minh' : undefined } : { title: 'Xác nhận trừ tiền ví', orderId: ids.order, orderCode: 'ORD-KIEM-THU', amount: 600000, paymentMethod: 'wallet' } };
  session.messages.push({ _id: crypto.randomUUID(), sender: 'assistant', content: '', createdAt: new Date().toISOString(),
    confirmation: { ...session.pendingConfirmation, status: 'WAITING_CONFIRMATION' } });
}
function book() {
  session.bookingDraft.status = 'booked'; session.bookingDraft.orderId = ids.order;
  session.state = 'WAITING_USER_INPUT'; session.pendingConfirmation = null;
  session.messages.forEach((message) => { if (message.confirmation) {
    message.confirmation.status = 'SUCCEEDED'; message.confirmation.booking = { orderId: ids.order, orderCode: 'ORD-KIEM-THU' };
  } });
  session.payment = { orderId: ids.order, orderCode: 'ORD-KIEM-THU', status: 'blocked', message: 'Ví chưa đủ tiền. Bạn có thể nạp ví để tiếp tục đúng đơn.' };
  session.viewedOrder = { orderId: ids.order, orderCode: 'ORD-KIEM-THU' };
  session.orderActions = { orderId: ids.order, orderCode: 'ORD-KIEM-THU', quotation: false, refunds: false, rebook: false, payment: true };
}
confirmation();
const historicalOrders = [
  { orderId: '101010101010101010101010', orderCode: 'HD-SUA-CU', status: 'completed', serviceId: ids.service,
    service: 'Sửa điều hòa', serviceType: 'variable_price', hasQuotation: true,
    address: { fullAddress: 'Đường Nguyễn Tạo, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng', ward: 'Phường Ngũ Hành Sơn', province: 'Thành phố Đà Nẵng' },
    providerId: ids.provider, provider: 'Nguyễn Minh', createdAt: '2026-09-10T02:00:00.000Z', scheduledAt: null, paymentStatus: 'paid' },
  { orderId: '202020202020202020202020', orderCode: 'HD-DA-HUY', status: 'cancelled', serviceId: ids.service,
    service: 'Vệ sinh điều hòa', serviceType: 'fixed_price', hasQuotation: false, address: null,
    providerId: null, provider: null, createdAt: '2026-09-11T02:00:00.000Z', scheduledAt: null, paymentStatus: 'refunded' },
  { orderId: '303030303030303030303030', orderCode: 'HD-DANG-LAM', status: 'accepted', serviceId: ids.service,
    service: 'Sửa điều hòa', serviceType: 'variable_price', hasQuotation: false, address: null,
    providerId: ids.provider, provider: 'Nguyễn Minh', createdAt: '2026-09-12T02:00:00.000Z', scheduledAt: null, paymentStatus: 'partially_paid' },
  { orderId: '404040404040404040404040', orderCode: 'HD-DICH-VU-CU', status: 'completed', serviceId: null,
    service: 'Dịch vụ không còn tồn tại', serviceType: null, hasQuotation: false, address: null,
    providerId: null, provider: null, createdAt: '2026-09-13T02:00:00.000Z', scheduledAt: null, paymentStatus: 'paid' },
];
if (historyActions) { session.messages = []; session.bookingDraft = null; session.pendingConfirmation = null; session.state = 'WAITING_USER_INPUT'; }
if (business) {
  fixture.policiesRead = 1;
  session.bookingDraft.hasDraftAddress = true;
  session.bookingDraft.providerCandidates = [{ id: ids.provider, name: 'Nguyễn Minh', averageRating: 4.8,
    totalCompletedOrders: 30, distanceMeters: 800 }];
  session.messages.unshift(
    { _id: 'request-previous-provider', sender: 'user', content: `Tôi muốn chọn lại thợ từng phục vụ cho dịch vụ ${ids.service}. Tra lịch sử đơn đã hoàn thành và cho tôi chọn đúng người; giữ các thông tin khác của bản nháp.`, createdAt: new Date().toISOString() },
    { _id: 'previous-provider', sender: 'assistant', content: `Nguyễn Minh (ID: ${ids.provider})`, createdAt: new Date().toISOString() },
  );
}
if (visual) {
  fixture.policiesRead = 1;
  fixture.history = { items: [
    { sessionId: ids.session, title: 'Đặt vệ sinh điều hòa', updatedAt: new Date().toISOString(), state: 'WAITING_CONFIRMATION', needsAttention: true },
    { sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Tìm thợ sửa máy giặt', updatedAt: new Date(Date.now() - 86400000).toISOString(), state: 'COMPLETED', needsAttention: false },
  ], pagination: { totalPages: 1, total: 2, page: 1, limit: 10 } };
  session.messages.unshift(
    { _id: 'visual-user', sender: 'user', content: 'Mình cần vệ sinh 2 máy điều hòa vào sáng mai, ở địa chỉ đã lưu.', createdAt: new Date().toISOString() },
    { _id: 'visual-assistant', sender: 'assistant', content: 'Mình đã chuẩn bị thông tin đặt dịch vụ cho bạn. Bạn có thể kiểm tra lại địa chỉ, chọn thợ ưu tiên và chỉnh sửa trước khi xác nhận.', createdAt: new Date().toISOString() },
  );
  if (visual === 'chat') {
    session.messages.pop();
    session.pendingConfirmation = null;
    session.state = 'WAITING_USER_INPUT';
    session.messages.at(-1).choiceGroups = [{ label: 'Thời gian phù hợp', options: ['Buổi sáng', 'Buổi chiều'], multiple: false }];
  }
  if (visual === 'payment') book();
  if (visual === 'welcome') {
    session.messages = [];
    session.pendingConfirmation = null;
    session.bookingDraft = null;
    session.state = 'WAITING_USER_INPUT';
  }
  if (visual === 'orders') {
    session.messages = [{ _id: 'ket-qua-tim-don', sender: 'assistant', content: 'Chọn thao tác trên đơn bạn muốn xử lý bên dưới.', createdAt: new Date().toISOString(),
      bookingSearch: { items: historicalOrders.slice(0, 2), pagination: { page: 1, limit: 2, total: 5, totalPages: 3 } } }];
    session.pendingConfirmation = null; session.bookingDraft = null; session.state = 'WAITING_USER_INPUT';
  }
}
if (returned) book();
if (flowExtensions) {
  fixture.policiesRead = 1; fixture.mapReads = 0; fixture.feedbackWrites = 0; fixture.careWrites = 0;
  session.bookingDraft.hasDraftAddress = true;
  fixture.feedbackContext = { order: { _id: ids.order, orderCode: 'ORD-KIEM-THU', status: 'completed' }, feedback: null, canReview: true };
  fixture.orderDetail = { _id: ids.order, status: 'accepted', providerId: { _id: ids.provider },
    addressId: { _id: null, fullAddress: '12 Lê Lợi', ward: 'Phường A', province: 'Hà Nội', latitude: 21.02, longitude: 105.84 },
    addressSnapshot: { fullAddress: '12 Lê Lợi', ward: 'Phường A', province: 'Hà Nội', latitude: 21.02, longitude: 105.84 }, createdAt: new Date().toISOString() };
}
if (paymentCancellation) {
  book();
  fixture.policiesRead = 1;
  fixture.cancelMode = 'ok';
  fixture.paymentRecord = { _id: '909090909090909090909090', orderId: ids.order, amount: 200000,
    paymentType: 'full', method: 'payos', status: 'pending' };
  session.payment = { ...fixture.paymentRecord, paymentId: fixture.paymentRecord._id, orderCode: 'ORD-KIEM-THU',
    message: 'Đang chờ thanh toán.', checkoutUrl: 'https://pay.payos.vn/web/qr-kiem-thu' };
}
fixture.get = async (id) => { log({ type: 'get', sessionId: id }); if (id !== ids.session) throw Error('Sai phiên'); return structuredClone(session); };
fixture.send = async (request) => {
  log({ type: 'send', request });
  if (fixture.waitForSend) await fixture.waitForSend;
  if (fixture.failNext) { fixture.failNext = false; throw Error('Mất kết nối giả lập'); }
  if (flowExtensions) {
    const reply = (content) => session.messages.push({ _id: crypto.randomUUID(), sender: 'assistant', content, createdAt: new Date().toISOString() });
    const prepare = (tool, preview) => {
      session.pendingConfirmation = { actionId: crypto.randomUUID(), tool, preview, expiresAt: new Date(Date.now() + 600000).toISOString() };
      session.messages.push({ _id: crypto.randomUUID(), sender: 'assistant', content: '', createdAt: new Date().toISOString(), confirmation: { ...session.pendingConfirmation, status: 'WAITING_CONFIRMATION' } });
    };
    if (request.bookingAction?.type === 'update') {
      Object.assign(values, request.bookingAction.patch); session.bookingDraft.revision++; confirmation();
    } else if (request.bookingAction?.type === 'provider') {
      session.assignedProvider = { orderId: ids.order, orderCode: 'ORD-KIEM-THU', status: 'accepted', checkedAt: new Date().toISOString(),
        provider: fixture.providerMissing ? null : { id: ids.provider, name: 'Thợ thực tế', phone: '0912345678', averageRating: 4.8, totalCompletedOrders: 30 },
        canContact: !fixture.providerMissing, canTrack: !fixture.providerMissing, location: null,
        trackingMessage: 'Thợ chưa chia sẻ vị trí.', message: 'Đơn hiện chưa có thông tin thợ thực hiện.' };
    } else if (request.bookingAction?.type === 'feedback') {
      const feedback = request.bookingAction.feedback;
      assert(feedback.orderId === ids.order, 'đánh giá đúng đơn');
      prepare('submit_booking_feedback', { title: feedback.mode === 'update' ? 'Sửa đánh giá dịch vụ' : 'Đánh giá dịch vụ', orderId: ids.order,
        orderCode: 'ORD-KIEM-THU', rating: feedback.rating, description: feedback.comment, customerAttachments: [] });
    } else if (request.confirmation) {
      const action = session.pendingConfirmation;
      const message = session.messages.find((item) => item.confirmation?.actionId === action.actionId);
      message.confirmation.status = request.confirmation.decision === 'REJECT' ? 'REJECTED' : 'SUCCEEDED';
      session.pendingConfirmation = null;
      if (request.confirmation.decision === 'CONFIRM') {
        if (action.tool === 'create_booking') {
          book(); session.payment = null; session.orderActions.provider = true; session.orderActions.feedback = true;
        } else if (action.tool === 'submit_booking_feedback') {
          fixture.feedbackWrites++; fixture.feedbackContext.feedback = { _id: 'danh-gia', rating: action.preview.rating, comment: action.preview.description, images: [] };
          reply('Đã gửi đánh giá dịch vụ.');
        } else { fixture.careWrites++; reply('Đã gửi yêu cầu và ảnh đính kèm.'); }
      } else reply('Đã bỏ yêu cầu, chưa gửi dữ liệu.');
    } else if (request.customerAttachments) {
      prepare('create_support_ticket', { title: 'Gửi yêu cầu hỗ trợ', subject: 'Bổ sung ảnh dịch vụ', description: request.message, customerAttachments: request.customerAttachments });
    }
    return structuredClone(session);
  }
  if (paymentCancellation) {
    const reply = (content) => session.messages.push({ _id: crypto.randomUUID(), sender: 'assistant', content, createdAt: new Date().toISOString() });
    if (request.confirmation) {
      const action = session.pendingConfirmation;
      assert(action?.tool === 'cancel_payment' && request.confirmation.actionId === action.actionId, 'xác nhận đúng hành động hủy QR');
      const message = session.messages.find((item) => item.confirmation?.actionId === action.actionId);
      session.pendingConfirmation = null;
      message.confirmation.status = request.confirmation.decision === 'REJECT' ? 'REJECTED' : fixture.cancelMode === 'error' ? 'EXPIRED' : 'SUCCEEDED';
      if (request.confirmation.decision === 'REJECT') reply('Đã bỏ yêu cầu hủy QR.');
      else if (fixture.cancelMode === 'error') reply('Chưa xác minh được việc hủy QR. Vui lòng kiểm tra thanh toán.');
      else {
        fixture.paymentRecord.status = fixture.cancelMode === 'paid' ? 'paid' : 'failed';
        session.payment = { ...session.payment, status: fixture.paymentRecord.status, checkoutUrl: undefined,
          message: fixture.cancelMode === 'paid' ? 'Đã thanh toán thành công.' : 'Đã hủy giao dịch QR thanh toán. Đơn hàng được giữ theo thời hạn hiện tại.' };
        reply(session.payment.message);
      }
    } else if (request.paymentStatus) {
      session.payment = { ...session.payment, status: fixture.paymentRecord.status,
        ...(fixture.paymentRecord.status !== 'pending' ? { checkoutUrl: undefined } : {}) };
    } else if (request.message.startsWith('Hủy QR') || request.message === 'Hủy thanh toán') {
      assert(!request.message.startsWith('Hủy QR') || request.message.includes(fixture.paymentRecord._id), 'nút hủy gửi đúng giao dịch QR');
      session.pendingConfirmation = { actionId: crypto.randomUUID(), tool: 'cancel_payment', expiresAt: new Date(Date.now() + 600000).toISOString(),
        preview: { title: 'Hủy giao dịch QR thanh toán', orderId: ids.order, orderCode: 'ORD-KIEM-THU', paymentId: fixture.paymentRecord._id,
          amount: fixture.paymentRecord.amount, note: 'Đơn hàng được giữ theo thời hạn thanh toán hiện tại.' } };
      session.messages.push({ _id: crypto.randomUUID(), sender: 'assistant', content: 'Vui lòng kiểm tra trước khi xác nhận.',
        createdAt: new Date().toISOString(), confirmation: { ...session.pendingConfirmation, status: 'WAITING_CONFIRMATION' } });
    } else reply('Vui lòng chọn phương thức thanh toán.');
    return structuredClone(session);
  }
  if (request.confirmation) {
    if (session.pendingConfirmation?.tool === 'create_booking' && request.confirmation.decision === 'CONFIRM') {
      assert(request.confirmation.policyConsent?.accepted === true && request.confirmation.policyConsent.version === fixture.policies.version, 'gửi bằng chứng đồng ý đúng chính sách');
    }
    book(); return structuredClone(session);
  }
  const text = request.message || '';
  if (request.bookingAction?.type === 'rebook_decision') {
    assert(request.bookingAction.proposalId === session.rebookProposal?.id, 'chọn đúng yêu cầu chuyển bản nháp');
    session.rebookProposal = null;
    if (request.bookingAction.accept) {
      fixture.savedDraft = structuredClone(session.bookingDraft);
      session.draftBackup = { id: crypto.randomUUID() };
      values.uniformQuantity = 2;
      session.bookingDraft.revision++;
    }
    confirmation(); return structuredClone(session);
  }
  if (request.bookingAction?.type === 'restore_draft') {
    assert(request.bookingAction.backupId === session.draftBackup?.id, 'quay lại đúng bản nháp dự phòng');
    for (const key of Object.keys(values)) delete values[key];
    Object.assign(values, fixture.savedDraft.values);
    session.bookingDraft = { ...fixture.savedDraft, revision: session.bookingDraft.revision + 1, values };
    session.draftBackup = null;
    confirmation(); return structuredClone(session);
  }
  if (!historyActions && /^(Xem báo giá đơn|Tra hoàn tiền đơn|Đặt lại đơn)/.test(text)) {
    session.messages.push({ _id: crypto.randomUUID(), sender: 'user', content: text, createdAt: new Date().toISOString() });
    return structuredClone(session);
  }
  if (historyActions) {
    session.messages.push({ _id: crypto.randomUUID(), sender: 'user', content: text, createdAt: new Date().toISOString() });
    const page = /^Xem trang (\d+)/.exec(text);
    const previousProviders = text.startsWith('Tôi muốn chọn lại thợ từng phục vụ') || text.includes('của danh sách thợ từng đặt');
    const reply = { _id: crypto.randomUUID(), sender: 'assistant', content: 'Chọn thao tác cho đúng đơn.', createdAt: new Date().toISOString() };
    if (text.includes('Tôi muốn tìm đơn cũ') || page || previousProviders) {
      const number = page ? Number(page[1]) : 1;
      const items = previousProviders ? number === 1 ? [historicalOrders[0]]
        : [{ ...historicalOrders[0], orderId: '505050505050505050505050', orderCode: 'HD-THO-TRANG-2', providerId: '565656565656565656565656' }]
        : number === 1 ? historicalOrders : [{ ...historicalOrders[0], orderId: '505050505050505050505050', orderCode: 'HD-TRANG-2', providerId: null, provider: null }];
      reply.bookingSearch = { ...(previousProviders ? { kind: 'previous_providers' } : {}), items: fixture.emptyHistory ? [] : items,
        pagination: { page: number, limit: 4, total: fixture.emptyHistory ? 0 : 5, totalPages: fixture.emptyHistory ? 0 : 2 } };
    } else if (text.startsWith('Chọn thợ từ đơn')) {
      values.preferredProviderId = text.includes('505050505050505050505050') ? '565656565656565656565656' : ids.provider;
      session.bookingDraft ??= { status: 'active', revision: 1, values, missing: [], summary: [] };
      confirmation(); return structuredClone(session);
    } else if (text.startsWith('Đặt lại')) {
      session.bookingDraft = { status: 'active', revision: 1, values, missing: ['Chọn lịch mới'], summary: [] };
      reply.content = 'Vui lòng chọn lịch mới trước khi xác nhận đặt dịch vụ.';
    } else reply.content = 'Đã đọc dữ liệu của đúng đơn bạn chọn.';
    session.messages.push(reply);
    return structuredClone(session);
  }
  if (session.bookingDraft.status === 'booked') {
    if (!text.includes(ids.order)) throw Error('Mất mã đơn khi tiếp tục thanh toán');
    if (business) {
      session.messages.push({ _id: crypto.randomUUID(), sender: 'user', content: text, createdAt: new Date().toISOString() });
      return structuredClone(session);
    }
    confirmation('create_payment'); return structuredClone(session);
  }
  session.messages.forEach((message) => { if (message.confirmation?.status === 'WAITING_CONFIRMATION') message.confirmation.status = 'EXPIRED'; });
  session.messages.push({ _id: crypto.randomUUID(), sender: 'user', content: text, customerAttachments: request.customerAttachments, createdAt: new Date().toISOString() });
  if (request.customerAttachments !== undefined) values.customerAttachments = request.customerAttachments;
  session.bookingDraft.revision++;
  if (request.bookingAction?.patch.mode === 'pause') {
    session.bookingDraft.status = 'paused'; session.pendingConfirmation = null;
  } else {
    session.bookingDraft.status = 'active';
    if (text.includes('Đổi số lượng dịch vụ thành 3')) values.uniformQuantity = 3;
    if (text.includes('34 Nguyễn Trãi')) values.addressId = ids.otherAddress;
    if (text.includes('sang Ví Handigo')) values.paymentMethod = 'wallet';
    if (text.includes('Tôi chọn chuyên gia Nguyễn Minh')) values.preferredProviderId = ids.provider;
    const time = /(\d{4}-\d{2}-\d{2}) lúc (\d{2}:\d{2})/.exec(text);
    if (time) { values.scheduledAt = time[1] + 'T' + time[2] + ':00+07:00'; values.orderType = 'scheduled'; }
    confirmation();
  }
  return structuredClone(session);
};
fixture.deposit = async (payload) => {
  log({ type: 'deposit', payload });
  return { transaction: { gatewayOrderCode: '1234567890', transactionCode: '1234567890' }, amount: payload.amount,
    checkoutUrl: location.origin + '/customer/wallet?walletDeposit=success&orderCode=1234567890' };
};
fixture.upload = async (sessionId, file) => {
  log({ type: 'upload', sessionId, size: file.size, mime: file.type });
  if (fixture.failUpload) { fixture.failUpload = false; throw Error('Lỗi upload giả lập'); }
  return { url: location.origin.replace('http:', 'https:') + '/anh-hien-trang-' + crypto.randomUUID() + '.png' };
};
const root = createRoot(document.getElementById('root'));
const render = (key) => root.render(<BrowserRouter key={key}><ChatbotWidget audience="CUSTOMER" /></BrowserRouter>);
render('ban-dau');

const pause = () => new Promise((resolve) => setTimeout(resolve, 25));
async function wait(check, label) {
  for (let i = 0; i < 140; i++) { if (check()) return; await pause(); }
  throw Error('Không đạt: ' + label);
}
const assert = (check, label) => { if (!check) throw Error('Không đạt: ' + label); };
function verifyStorage() {
  const value = { sessionId: ids.session, orderId: ids.order, depositOrderCode: '1234567890', createdAt: Date.now() };
  saveAgentWalletResume(ids.user, value);
  assert(readAgentWalletResume(ids.user)?.orderId === ids.order, 'đọc đúng đơn đã lưu');
  assert(readAgentWalletResume('888888888888888888888888') === null, 'không đọc thông tin của tài khoản khác');
  saveAgentWalletResume(ids.user, { ...value, createdAt: Date.now() - 25 * 3600000 });
  assert(readAgentWalletResume(ids.user) === null, 'bỏ thông tin quay lại quá hạn');
  sessionStorage.setItem('handigo-agent-wallet-resume:' + ids.user, '{');
  assert(readAgentWalletResume(ids.user) === null, 'không lỗi khi dữ liệu lưu bị hỏng');
  clearAgentWalletResume(ids.user);
}
function verifyDialogBounds() {
  const bounds = dialog().getBoundingClientRect();
  assert(bounds.left >= -1 && bounds.right <= innerWidth + 1, 'hộp thoại nằm trong chiều rộng màn hình');
}
const button = (text, root = document) => [...root.querySelectorAll('button')].find((item) => item.textContent.trim() === text);
const dialog = () => document.querySelector('[role="dialog"]');
const lastSend = () => calls.filter((item) => item.type === 'send').at(-1)?.request;
async function click(text, root = document) {
  await wait(() => button(text, root) && !button(text, root).disabled, 'nút khả dụng: ' + text);
  button(text, root).click(); await pause();
}
function change(input, value, event = 'input') {
  Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event(event, { bubbles: true }));
}
async function acceptPolicy() {
  await wait(() => document.querySelector('input[type="checkbox"]') && !document.querySelector('input[type="checkbox"]').disabled, 'tải chính sách');
  if (!document.querySelector('input[type="checkbox"]').checked) document.querySelector('input[type="checkbox"]').click();
  await pause();
}
async function verifyWalletReturn() {
    await wait(() => document.querySelector('[aria-label="Tiếp tục đặt dịch vụ sau nạp ví"]'), 'mở đúng cuộc trò chuyện sau PayOS');
    assert(calls.filter((item) => item.type === 'get').at(-1).sessionId === ids.session, 'khôi phục đúng session');
    assert(document.body.textContent.includes('Tiếp tục đơn ORD-KIEM-THU'), 'hiển thị đúng mã đơn');
    const before = calls.filter((item) => item.type === 'send').length;
    await wait(() => document.body.textContent.includes('1.000.000'), 'số dư mới từ API');
    assert(calls.filter((item) => item.type === 'send').length === before, 'không tự thanh toán sau nạp');
    await click('Kiểm tra đơn và thanh toán bằng ví');
    await wait(() => lastSend()?.message?.includes(ids.order), 'tiếp tục thanh toán trên cùng đơn');
    assert(session.pendingConfirmation?.tool === 'create_payment' && session.bookingDraft.orderId === ids.order, 'tiếp tục thanh toán đúng đơn đã tạo');
    await wait(() => !sessionStorage.getItem('handigo-agent-wallet-resume:' + ids.user), 'xóa thông tin quay lại sau khi tiếp tục');
    assert(calls.filter((item) => item.type === 'deposit').length === 1, 'chỉ tạo một giao dịch nạp ví');
    assert(!document.querySelector('[aria-label="Hành động với bản nháp đặt lịch"]'), 'không cho sửa bản nháp của đơn đã tạo');
    document.body.dataset.agentBookingPassed = 'true';
}
async function verifyPaymentCancellation() {
  const qr = () => document.querySelector('img[alt^="Mã QR PayOS"]');
  await wait(() => qr() && button('Hủy QR'), 'hiển thị QR và thao tác hủy');
  const initialOrder = session.bookingDraft.orderId;
  const before = calls.filter((item) => item.type === 'send').length;
  button('Hủy QR').click(); button('Hủy QR').click(); await pause();
  await wait(() => button('Xác nhận'), 'bản xác nhận hủy QR');
  assert(calls.filter((item) => item.type === 'send').length === before + 1, 'không gửi lặp khi bấm nhanh');
  assert(lastSend().message.includes(fixture.paymentRecord._id) && lastSend().message.includes(ids.order), 'gắn đúng đơn và QR');
  assert(qr() && fixture.paymentRecord.status === 'pending', 'chưa hủy hoặc ẩn QR trước xác nhận');
  assert(button('Hủy QR').disabled, 'khóa thao tác khi đang chờ xác nhận');
  await click('Từ chối');
  await wait(() => button('Hủy QR') && !button('Hủy QR').disabled, 'từ chối vẫn giữ QR');
  assert(qr() && fixture.paymentRecord.status === 'pending', 'từ chối chỉ bỏ yêu cầu hủy');
  const composer = document.querySelector('[aria-label="Nội dung gửi cho Trợ lý Handigo"]');
  change(composer, 'Hủy thanh toán'); await pause();
  document.querySelector('[aria-label="Gửi tin nhắn"]').click();
  await wait(() => button('Xác nhận'), 'hủy qua câu chat');
  fixture.cancelMode = 'error';
  await click('Xác nhận');
  await wait(() => button('Hủy QR') && !button('Hủy QR').disabled, 'cho kiểm tra lại sau lỗi hủy');
  assert(qr() && fixture.paymentRecord.status === 'pending', 'lỗi hủy chưa được ẩn QR hoặc báo thành công');
  fixture.cancelMode = 'ok';
  await click('Hủy QR'); await click('Xác nhận');
  await wait(() => !qr() && button('Chọn phương thức thanh toán'), 'hủy đã xác minh thì ẩn QR và cho chọn thanh toán lại');
  assert(session.bookingDraft.orderId === initialOrder && session.bookingDraft.status === 'booked', 'hủy QR vẫn giữ đúng đơn');
  assert(!button('Hủy QR') && session.payment.status === 'failed', 'QR đã hủy không có thao tác hủy lại');
  await click('Chọn phương thức thanh toán');
  assert(lastSend().message.includes(initialOrder), 'chọn phương thức mới trên cùng đơn');
  fixture.paymentRecord.status = 'pending';
  session.payment = { ...session.payment, status: 'pending', checkoutUrl: 'https://pay.payos.vn/web/qr-kiem-thu' };
  session.messages = []; session.pendingConfirmation = null;
  render('qr-nhan-tien-dong-thoi');
  await wait(() => document.querySelector('[aria-label="Mở Trợ lý Handigo"]'), 'mở kịch bản nhận tiền đồng thời');
  document.querySelector('[aria-label="Mở Trợ lý Handigo"]').click();
  await wait(() => qr() && button('Hủy QR'), 'QR đang chờ của kịch bản tiếp');
  fixture.cancelMode = 'paid';
  await click('Hủy QR'); await click('Xác nhận');
  await wait(() => !qr() && session.payment.status === 'paid', 'nhận tiền đồng thời thì ẩn QR và hiển thị đã thanh toán');
  assert(document.body.textContent.includes('Đã thanh toán thành công.'), 'không báo hủy thành công khi đã nhận tiền');
  assert(!button('Chọn phương thức thanh toán') && !button('Hủy QR'), 'không thu lại hoặc hủy khoản đã trả');
  document.body.dataset.agentBookingPassed = 'true';
}
async function verifyFlowExtensions() {
  await click('Dùng địa chỉ một lần');
  await wait(() => values.saveAddressToBook === false && button('Cho phép lưu địa chỉ'), 'chọn không lưu địa chỉ');
  assert(lastSend().bookingAction.patch.saveAddressToBook === false, 'gửi lựa chọn không lưu bằng dữ liệu cấu trúc');
  assert(document.body.textContent.includes('Chỉ dùng cho đơn này, không lưu vào sổ địa chỉ'), 'xác nhận hiển thị cách lưu địa chỉ');
  await click('Cho phép lưu địa chỉ');
  await wait(() => values.saveAddressToBook === true, 'cho phép lưu lại khi khách đổi ý');
  await click('Dùng địa chỉ một lần');
  await acceptPolicy(); await click('Xác nhận');
  await wait(() => button('Thợ thực hiện') && !button('Thợ thực hiện').disabled, 'thao tác cho đơn đã tạo');
  assert(document.querySelector('input[type="file"]'), 'vẫn đính kèm ảnh được sau khi tạo đơn');
  await click('Thợ thực hiện');
  const providerCard = () => document.querySelector('[aria-label="Thợ thực hiện đơn đang xem"]');
  await wait(() => providerCard()?.textContent.includes('Thợ thực tế'), 'hiển thị thợ thực hiện');
  assert(lastSend().bookingAction.orderId === ids.order && lastSend().bookingAction.type === 'provider', 'tra đúng đơn bằng thao tác cấu trúc');
  assert(providerCard().querySelector('a[href="tel:0912345678"]'), 'liên hệ đúng số thợ');
  assert(providerCard().textContent.includes('Thợ chưa chia sẻ vị trí.'), 'không bịa vị trí hoặc thời gian đến');
  await click('Nhắn tin', providerCard());
  await wait(() => fixture.chatOrderId === ids.order, 'mở trò chuyện đúng đơn');
  const closeChat = document.querySelector('[aria-label="Đóng trò chuyện"]');
  if (closeChat) closeChat.click();
  await click('Xem vị trí thợ', providerCard());
  await wait(() => providerCard()?.querySelector('[role="alert"]'), 'xử lý lỗi tải bản đồ');
  await click('Xem vị trí thợ', providerCard());
  await wait(() => providerCard()?.querySelector('.leaflet-container'), 'thử lại và mở bản đồ thật');
  assert(fixture.mapOrderId === ids.order, 'bản đồ lấy đúng đơn');
  fixture.providerMissing = true; await click('Làm mới', providerCard());
  await wait(() => providerCard() && !button('Nhắn tin', providerCard()), 'chưa có thợ thì bỏ liên hệ cũ');
  fixture.feedbackError = true;
  await click('Đánh giá dịch vụ');
  const form = () => document.querySelector('[aria-label="Đánh giá dịch vụ qua trợ lý"]');
  await wait(() => button('Thử lại', form()), 'xử lý lỗi kiểm tra đánh giá');
  await click('Thử lại', form());
  await wait(() => form()?.querySelector('select'), 'thử lại lấy điều kiện đánh giá');
  assert(form().querySelector('select').value === '', 'không tự chọn số sao');
  assert(button('Xem trước đánh giá', form()).disabled, 'chưa chọn số sao thì không gửi');
  change(form().querySelector('select'), '5', 'change');
  change(form().querySelector('textarea'), 'Thợ làm cẩn thận'); await pause();
  await click('Xem trước đánh giá', form());
  await wait(() => session.pendingConfirmation?.tool === 'submit_booking_feedback', 'xem trước đánh giá');
  assert(lastSend().bookingAction.feedback.rating === 5 && fixture.feedbackWrites === 0, 'xem trước chưa ghi đánh giá');
  assert(document.body.textContent.includes('Số sao') && !document.body.textContent.includes('5 đ'), 'hiển thị số sao không định dạng tiền');
  await click('Từ chối'); assert(fixture.feedbackWrites === 0, 'từ chối không gửi đánh giá');
  await click('Đánh giá dịch vụ'); await wait(() => form()?.querySelector('select'), 'mở lại đánh giá');
  change(form().querySelector('select'), '4', 'change'); change(form().querySelector('textarea'), 'Dịch vụ tốt'); await pause();
  await click('Xem trước đánh giá', form()); await click('Xác nhận');
  assert(fixture.feedbackWrites === 1, 'chỉ gửi sau xác nhận');
  await click('Đánh giá dịch vụ'); await wait(() => form()?.querySelector('select')?.value === '4', 'đọc lại đánh giá có sẵn');
  change(form().querySelector('select'), '3', 'change'); await pause();
  await click('Xem trước đánh giá', form());
  assert(lastSend().bookingAction.feedback.mode === 'update', 'sửa đúng đánh giá cũ');
  await click('Xác nhận'); assert(fixture.feedbackWrites === 2, 'xác nhận sửa đánh giá');
  const fileInput = document.querySelector('input[type="file"]');
  const files = new DataTransfer(); files.items.add(new File(['anh-gia-lap'], 'bang-chung.png', { type: 'image/png' }));
  fileInput.files = files.files; fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(() => calls.some((entry) => entry.type === 'upload') && document.querySelector('img[alt="Ảnh hiện trạng 1"]'), 'tải ảnh hỗ trợ sau khi đặt đơn');
  const composer = document.querySelector('[aria-label="Nội dung gửi cho Trợ lý Handigo"]');
  change(composer, 'Gửi ảnh bằng chứng cho yêu cầu hỗ trợ'); await pause();
  document.querySelector('[aria-label="Gửi tin nhắn"]').click();
  await wait(() => session.pendingConfirmation?.tool === 'create_support_ticket' && document.body.textContent.includes('Ảnh đính kèm yêu cầu'), 'xác nhận gửi ảnh hỗ trợ');
  assert(document.body.textContent.includes('Ảnh đính kèm yêu cầu') && session.pendingConfirmation.preview.customerAttachments.length === 1, 'xác nhận có ảnh đúng tác vụ');
  assert(session.bookingDraft.status === 'booked' && !values.customerAttachments?.length, 'không sửa ảnh đơn đã tạo');
  await click('Xác nhận'); assert(fixture.careWrites === 1, 'gửi hỗ trợ kèm ảnh sau xác nhận');
  session.requiresReconciliation = true; session.state = 'FAILED'; session.payment = null;
  session.pendingConfirmation = null; session.interruptedRequest = null;
  render('ho-tro-can-doi-soat');
  await wait(() => document.querySelector('[aria-label="Mở Trợ lý Handigo"]'), 'mở lại phiên cần đối soát');
  document.querySelector('[aria-label="Mở Trợ lý Handigo"]').click();
  await wait(() => button('Kiểm tra kết quả thao tác'), 'có nút đối soát cho hỗ trợ ngoài đặt đơn');
  const lookupComposer = document.querySelector('[aria-label="Nội dung gửi cho Trợ lý Handigo"]');
  assert(!lookupComposer.disabled, 'đang đối soát vẫn nhập được yêu cầu tra cứu');
  assert(!document.querySelector('input[type="file"]'), 'chưa mở thao tác tải ảnh trong lúc đối soát');
  assert(document.querySelector('[aria-label="Bắt đầu tác vụ mới"]').disabled, 'không bỏ hành động chưa rõ bằng reset');
  change(lookupComposer, 'Tra cứu hỗ trợ của tôi'); await pause();
  assert(!document.querySelector('[aria-label="Gửi tin nhắn"]').disabled, 'gửi được câu tra cứu khi chưa có lỗi mạng');
  document.querySelector('[aria-label="Gửi tin nhắn"]').click();
  await wait(() => lastSend().message === 'Tra cứu hỗ trợ của tôi', 'request tra cứu được gửi khi phiên cần đối soát');
  await wait(() => button('Kiểm tra kết quả thao tác') && !button('Kiểm tra kết quả thao tác').disabled, 'có thể kiểm tra lại sau lượt tra cứu');
  await click('Kiểm tra kết quả thao tác');
  assert(lastSend().message === 'Tiếp tục yêu cầu.', 'nút đối soát hỗ trợ dùng đúng luồng kiểm tra lại');
  session.requiresReconciliation = false;
  const panel = document.querySelector('aside').getBoundingClientRect();
  assert(panel.left >= 0 && panel.right <= innerWidth + 1, 'giao diện nằm trong màn hình');
  document.body.dataset.agentBookingPassed = 'true';
}
async function run() {
  if (returned) return verifyWalletReturn();
  await wait(() => document.querySelector('[aria-label="Mở Trợ lý Handigo"]'), 'hiển thị widget');
  document.querySelector('[aria-label="Mở Trợ lý Handigo"]').click();
  if (flowExtensions) return verifyFlowExtensions();
  if (historyActions) return verifyHistoryActions();
  if (paymentCancellation) return verifyPaymentCancellation();
  if (scroll) return verifyChatScroll();
  if (business) return verifyBusiness();
  if (visual) {
    if (visual === 'history') {
      await wait(() => document.querySelector('[aria-label="Mở lịch sử trò chuyện"]'), 'mở lịch sử');
      document.querySelector('[aria-label="Mở lịch sử trò chuyện"]').click();
      await wait(() => document.body.textContent.includes('Tìm thợ sửa máy giặt'), 'hiển thị lịch sử giả lập');
    } else if (visual === 'welcome') {
      await wait(() => document.body.textContent.includes('Bạn cần giúp gì cho ngôi nhà?'), 'hiển thị lời chào');
      assert(document.querySelector('aside h3').getBoundingClientRect().width > 250, 'lời chào dùng đủ chiều rộng khung chat');
      const input = document.querySelector('textarea[name="message"]');
      const send = document.querySelector('[aria-label="Gửi tin nhắn"]');
      const task = document.querySelector('[aria-label="Bắt đầu tác vụ mới"]');
      const history = document.querySelector('[aria-label="Mở lịch sử trò chuyện"]');
      const centerY = (element) => { const rect = element.getBoundingClientRect(); return rect.top + rect.height / 2; };
      assert(task.closest('header') && Math.abs(centerY(task) - centerY(history)) < 1, 'nút dấu cộng nằm ngang nút lịch sử');
      assert(!document.querySelector('form [aria-label="Bắt đầu tác vụ mới"]'), 'bỏ nút tác vụ khỏi ô nhập');
      assert(Math.abs(centerY(input) - centerY(send)) < 1, 'các nút ban đầu nằm ngang ô nhập');
      input.focus();
      await wait(() => send.getBoundingClientRect().top >= input.getBoundingClientRect().bottom,
        'focus chuyển nút xuống dưới ô nhập').catch((error) => {
          throw Error(error.message + ': ' + JSON.stringify({connected: input.isConnected, active: document.activeElement?.tagName,
            grid: input.parentElement.className, columns: getComputedStyle(input.parentElement).gridTemplateColumns,
            input: input.getBoundingClientRect().toJSON(), send: send.getBoundingClientRect().toJSON()}));
        });
      assert(document.activeElement === input, 'giữ focus sau khi đổi bố cục');
      document.querySelector('[aria-label="Đính kèm ảnh hiện trạng"]').focus();
      await pause();
      assert(send.getBoundingClientRect().top >= input.getBoundingClientRect().bottom, 'không thu gọn giữa lúc bấm nút trong ô nhập');
      task.focus();
      await wait(() => Math.abs(centerY(input) - centerY(send)) < 1, 'rời ô nhập đưa các nút về cùng hàng');
      task.blur();
    } else {
      await wait(() => document.querySelector('[aria-label="Nội dung cuộc trò chuyện"]'), 'mở giao diện để kiểm tra');
    }
    await pause();
    const panel = document.querySelector('[aria-label="Trợ lý Handigo"]');
    const bounds = panel.getBoundingClientRect();
    assert(bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight, 'khung chat nằm trong màn hình');
    const feed = document.querySelector('[aria-label="Nội dung cuộc trò chuyện"]');
    if (feed) {
      assert(feed.scrollWidth <= feed.clientWidth + 1, 'nội dung chat không tràn ngang');
      feed.scrollTop = visual === 'chat' || visual === 'orders' ? 0 : feed.scrollHeight;
    }
    document.body.dataset.agentBookingPassed = 'true';
    return;
  }
  await wait(() => button('Xác nhận'), 'hiển thị form');
  assert(button('Xác nhận').disabled, 'chưa đồng ý chính sách thì chưa xác nhận được');
  await wait(() => document.body.textContent.includes('Không thể tải chính sách'), 'hiển thị lỗi tải chính sách');
  await click('Thử lại');
  await acceptPolicy();
  assert(!button('Xác nhận').disabled, 'đồng ý chính sách mới cho xác nhận');
  await click('Số lượng');
  verifyDialogBounds();
  change(dialog().querySelector('input[type="number"]'), '0'); await pause();
  dialog().querySelector('form').requestSubmit(); await pause();
  assert(!lastSend(), 'không gửi số lượng không hợp lệ');
  change(dialog().querySelector('input[type="number"]'), '3'); await pause();
  fixture.failNext = true;
  await click('Gửi thay đổi', dialog());
  await wait(() => document.body.textContent.includes('Chưa gửi được thay đổi'), 'giữ form khi mất kết nối');
  const failedId = lastSend().requestId;
  await click('Đóng', dialog()); await click('Thử lại');
  await wait(() => session.bookingDraft.values.uniformQuantity === 3 && button('Số lượng'), 'cập nhật số lượng');
  assert(lastSend().requestId === failedId, 'thử lại giữ nguyên requestId');
  assert(lastSend().bookingAction?.type === 'update' && lastSend().bookingAction.patch.quantity === 3, 'gửi số lượng có cấu trúc và giữ khi thử lại');
  assert(button('Xác nhận').disabled, 'sửa form phải đồng ý lại chính sách');
  await click('Địa chỉ');
  await wait(() => document.body.textContent.includes('Lỗi địa chỉ giả lập'), 'lỗi tải sổ địa chỉ');
  await click('Thử lại', dialog());
  await wait(() => dialog()?.querySelector('select'), 'tải lại sổ địa chỉ');
  assert(dialog().querySelector(`option[value="${ids.otherAddress}"]`).textContent.split('Phường B').length === 2, 'địa chỉ trong danh sách không lặp phường');
  change(dialog().querySelector('select'), ids.otherAddress, 'change'); await pause();
  await click('Gửi thay đổi', dialog());
  await wait(() => values.addressId === ids.otherAddress && !dialog(), 'đổi địa chỉ');
  assert(lastSend().message.includes('Trần Bình') && lastSend().message.includes('0987654321'), 'giữ đúng người nhận của địa chỉ');
  assert(!lastSend().message.includes('bản nháp') && !lastSend().message.includes('Chưa tạo đơn'), 'tin chọn địa chỉ không kèm chỉ dẫn xử lý nội bộ');
  assert(lastSend().bookingAction?.patch.addressId === ids.otherAddress, 'địa chỉ được chọn bằng ID dữ liệu, không nhờ AI đoán tên');
  assert(lastSend().message.split('Phường B').length === 2 && lastSend().message.split('Hà Nội').length === 2, 'lệnh chọn địa chỉ không ghép lặp khu vực');
  await click('Thanh toán');
  dialog().querySelector('input[value="wallet"]').click(); await pause();
  await click('Gửi thay đổi', dialog());
  await wait(() => values.paymentMethod === 'wallet' && !dialog(), 'đổi sang ví');
  assert(lastSend().bookingAction?.patch.paymentMethod === 'wallet', 'gửi đúng phương thức có cấu trúc');
  await click('Ngày giờ');
  await wait(() => document.querySelector('#booking-date-time-picker'), 'bộ chọn lịch trong chat');
  verifyDialogBounds();
  assert(document.querySelector('#booking-date-time-picker').style.zIndex === '180', 'lịch nổi phía trên chat');
  assert(dialog().textContent.toLocaleLowerCase('vi-VN').includes('chưa giữ chỗ'), 'không khẳng định lịch đã được giữ');
  const wheels = dialog().querySelectorAll('[role="listbox"]');
  wheels[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); await pause();
  wheels[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); await pause();
  wheels[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); await pause();
  await click('Xác nhận', dialog());
  await wait(() => lastSend()?.bookingAction?.patch.scheduledAt && !dialog(), 'gửi lịch theo giờ Việt Nam');
  const [scheduledDate, scheduledTime] = lastSend().bookingAction.patch.scheduledAt.split('T');
  assert(lastSend().message === `Đổi lịch hẹn sang ${scheduledDate.split('-').reverse().join('/')} lúc ${scheduledTime.slice(0, 5)}.`, 'tin nhắn đổi lịch ngắn gọn, chỉ hiện ngày giờ');
  assert(scheduledTime.endsWith('+07:00'), 'dữ liệu lịch vẫn dùng giờ Việt Nam');
  await click('Xem thợ và hồ sơ');
  await wait(() => document.querySelector('[aria-label="Xem hồ sơ thợ Nguyễn Minh"]'), 'danh sách thợ thật từ API giả lập');
  document.querySelector('[aria-label="Xem hồ sơ thợ Nguyễn Minh"]').click();
  await wait(() => document.body.textContent.includes('Đúng giờ và làm việc cẩn thận.'), 'xem đánh giá trong hồ sơ');
  verifyDialogBounds();
  assert(document.body.textContent.includes('Chuyên vệ sinh điều hòa tại nhà.'), 'hiển thị giới thiệu chuyên gia');
  await click('Chọn thợ này', dialog());
  await wait(() => values.preferredProviderId === ids.provider && !dialog(), 'chọn đúng chuyên gia');
  assert(lastSend().message.includes('Nguyễn Minh') && !lastSend().message.includes('555555')
    && lastSend().bookingAction?.patch.preferredProviderId === ids.provider, 'gửi đúng thợ bằng dữ liệu cấu trúc, không đưa ID vào nội dung chat');
  await click('Tạm dừng');
  await wait(() => button('Tiếp tục bản nháp'), 'hành động phù hợp với bản nháp tạm dừng');
  assert(!button('Ngày giờ'), 'form cũ không còn cho sửa sau tạm dừng');
  await click('Tiếp tục bản nháp');
  await wait(() => button('Số lượng'), 'khôi phục form');
  await click('chính sách Handigo');
  await wait(() => dialog()?.textContent.includes('17 phút'), 'chính sách dùng cấu hình từ API');
  await click('Đồng ý với chính sách', dialog());
  await wait(() => !dialog() && !button('Xác nhận').disabled, 'đồng ý chính sách của form hiện tại');
  await click('Xác nhận');
  await wait(() => button('Nạp ví cho đơn này'), 'đơn được giữ khi ví thiếu');
  assert(calls.filter((item) => item.type === 'send' && item.request.confirmation).length === 1, 'chỉ xác nhận tạo đơn một lần');
  await click('Nạp ví cho đơn này');
  await wait(() => dialog()?.querySelector('input[inputmode="numeric"]') && !dialog().querySelector('button[type="submit"]').disabled, 'mở nạp ví cho đúng đơn');
  verifyDialogBounds();
  const input = dialog().querySelector('input[inputmode="numeric"]');
  change(input, '200000'); await pause();
  await click('Nạp tiền qua PayOS', dialog());
  await wait(() => fixture.redirectCaptured, 'lưu thông tin trước chuyển hướng PayOS');
  const saved = JSON.parse(sessionStorage.getItem('handigo-agent-wallet-resume:' + ids.user));
  assert(saved.sessionId === ids.session && saved.orderId === ids.order, 'lưu đúng phiên và đơn trước chuyển hướng');
  assert(saved.depositOrderCode === '1234567890', 'giữ mã giao dịch nạp ví từ API');
  assert(calls.find((item) => item.type === 'deposit').payload.amount === 200000, 'nạp đúng số tiền đã nhập');
  // Mô phỏng trang được mở lại sau cổng ngoài, giữ sessionStorage như cùng một tab trình duyệt.
  history.replaceState({}, '', '/customer/wallet?walletDeposit=success&orderCode=1234567890');
  render('quay-lai-sau-payos');
  await verifyWalletReturn();
}
async function verifyHistoryActions() {
  await click('Tìm đơn cũ');
  const results = () => [...document.querySelectorAll('[aria-label="Kết quả tìm đơn cũ"]')];
  const current = () => results().at(-1);
  const card = (code) => current().querySelector(`[aria-label="Đơn ${code}"]`);
  await wait(() => card('HD-SUA-CU'), 'thẻ đơn tìm thấy');
  assert(card('HD-SUA-CU').querySelector('a').getAttribute('href') === '/customer/bookings/' + historicalOrders[0].orderId, 'đường dẫn chi tiết đúng đơn');
  assert(card('HD-SUA-CU').textContent.includes('09:00'), 'ngày giờ đơn dùng múi giờ Việt Nam');
  assert(card('HD-SUA-CU').textContent.split('Phường Ngũ Hành Sơn').length === 2, 'địa chỉ thẻ không bị lặp khu vực');
  assert(button('Đặt lại', card('HD-SUA-CU')) && button('Xem báo giá', card('HD-SUA-CU')), 'đơn sửa đã hoàn thành có thao tác phù hợp');
  assert(button('Tra hoàn tiền', card('HD-DA-HUY')) && !button('Xem báo giá', card('HD-DA-HUY')), 'đơn giá cố định đã hủy có tra hoàn tiền');
  assert(!button('Đặt lại', card('HD-DANG-LAM')), 'không gợi ý đặt trùng đơn đang xử lý');
  assert(!button('Đặt lại', card('HD-DICH-VU-CU')), 'dịch vụ đã xóa không có đặt lại');
  assert(!current().textContent.includes(ids.provider) && !current().textContent.includes(historicalOrders[0].orderId), 'không lộ ID trên thẻ');
  await click('Xem báo giá', card('HD-DANG-LAM'));
  await wait(() => lastSend()?.message?.includes(historicalOrders[2].orderId) && !document.querySelector('aside textarea').disabled, 'xem báo giá đúng đơn đang xử lý');
  await click('Tra hoàn tiền', card('HD-DA-HUY'));
  await wait(() => lastSend()?.message?.startsWith('Tra hoàn tiền') && !document.querySelector('aside textarea').disabled, 'tra hoàn tiền');
  assert(lastSend().message.includes(historicalOrders[1].orderId), 'tra hoàn tiền không dùng đơn khác trong phiên');
  await click('Sau', current());
  await wait(() => current()?.textContent.includes('HD-TRANG-2'), 'chuyển trang kết quả');
  assert(lastSend().message === 'Xem trang 2 của kết quả tìm đơn cũ.', 'gửi đúng trang');
  assert(button('Sau', results()[0]).disabled, 'trang lịch sử cũ không gửi nhầm bộ lọc mới');
  await click('Trước', current());
  await wait(() => card('HD-SUA-CU'), 'quay lại trang đầu');
  await click('Đặt lại', card('HD-SUA-CU'));
  assert(!lastSend().message.startsWith('Đặt lại'), 'mở lựa chọn thợ chưa gửi đặt lại');
  await click('Giữ thợ cũ', card('HD-SUA-CU'));
  await wait(() => lastSend()?.message?.startsWith('Đặt lại cùng thợ cũ') && !document.querySelector('aside textarea').disabled, 'đặt lại cùng thợ');
  assert(lastSend().message.includes(historicalOrders[0].orderId), 'đặt lại đúng đơn đã chọn');
  assert(!session.pendingConfirmation && !calls.some((entry) => entry.request?.confirmation), 'chưa chọn lịch và xác nhận thì chưa tạo đơn');
  await click('Đặt lại', card('HD-SUA-CU')); await click('Tìm thợ phù hợp', card('HD-SUA-CU'));
  await wait(() => lastSend()?.message?.startsWith('Đặt lại đơn') && !document.querySelector('aside textarea').disabled, 'đặt lại không giữ thợ');
  await click('Đặt lại', card('HD-DA-HUY'));
  await wait(() => lastSend()?.message?.includes(historicalOrders[1].orderId) && !document.querySelector('aside textarea').disabled, 'đặt lại đơn đã hủy');
  assert(!lastSend().message.includes('cùng thợ'), 'không tự giữ thợ từ đơn đã hủy');
  let release;
  fixture.waitForSend = new Promise((resolve) => { release = resolve; });
  await click('Xem báo giá', card('HD-DANG-LAM'));
  assert([...current().querySelectorAll('button')].every((entry) => entry.disabled), 'khóa thao tác lặp khi đang xử lý');
  release(); fixture.waitForSend = null;
  await wait(() => !document.querySelector('aside textarea').disabled, 'kết thúc lượt tra cứu');
  fixture.failNext = true;
  await click('Xem báo giá', card('HD-DANG-LAM'));
  await wait(() => document.body.textContent.includes('Mất kết nối giả lập'), 'hiển thị lỗi tra cứu');
  const requestId = lastSend().requestId;
  await click('Thử lại');
  await wait(() => !document.body.textContent.includes('Mất kết nối giả lập') && !document.querySelector('aside textarea').disabled, 'thử lại an toàn');
  assert(lastSend().requestId === requestId && lastSend().message.includes(historicalOrders[2].orderId), 'thử lại giữ request và đơn đã chọn');
  fixture.emptyHistory = true;
  await click('Sau', current());
  await wait(() => button('Tìm tất cả đơn', current()), 'kết quả rỗng có hướng tiếp tục');
  fixture.emptyHistory = false;
  await click('Tìm tất cả đơn', current());
  await wait(() => card('HD-SUA-CU'), 'tìm lại từ trạng thái rỗng');
  await click('Thợ từng đặt');
  await wait(() => current()?.textContent.includes('Thợ từng phục vụ') && button('Chọn thợ này', current()), 'hiển thị thẻ thợ đã phục vụ');
  assert(current().textContent.includes('Nguyễn Minh') && current().textContent.includes('Dịch vụ đã làm'), 'hiển thị tên thợ và dịch vụ đã phục vụ');
  assert(!button('Đặt lại', current()) && !button('Xem báo giá', current()), 'lịch sử thợ có đúng thao tác chọn thợ');
  fixture.emptyHistory = true;
  await click('Sau', current());
  await wait(() => button('Kiểm tra lại lịch sử thợ', current()), 'lịch sử thợ rỗng có hướng tiếp tục');
  fixture.emptyHistory = false;
  await click('Kiểm tra lại lịch sử thợ', current());
  await wait(() => button('Chọn thợ này', current()), 'kiểm tra lại lịch sử thợ');
  await click('Sau', current());
  await wait(() => current()?.textContent.includes('HD-THO-TRANG-2'), 'phân trang lịch sử thợ');
  assert(lastSend().message === 'Xem trang 2 của danh sách thợ từng đặt.', 'phân trang thợ không dùng nhầm truy vấn đơn cũ');
  const oldAddress = values.addressId, oldQuantity = values.uniformQuantity;
  await click('Chọn thợ này', current());
  await wait(() => values.preferredProviderId === '565656565656565656565656' && !document.querySelector('aside textarea').disabled, 'chọn đúng thợ trùng tên từ trang hai');
  assert(lastSend().message === 'Chọn thợ từ đơn 505050505050505050505050 (HD-THO-TRANG-2).', 'gửi đúng đơn nguồn để chọn thợ');
  assert(values.addressId === oldAddress && values.uniformQuantity === oldQuantity, 'chọn thợ giữ địa chỉ và số lượng');
  assert(!document.querySelector('[aria-label="Nội dung cuộc trò chuyện"]').textContent.includes('565656565656565656565656'), 'không hiển thị ID thợ trong chat');
  const feed = document.querySelector('[aria-label="Nội dung cuộc trò chuyện"]');
  assert(feed.scrollWidth <= feed.clientWidth + 1, 'thẻ kết quả không tràn ngang');
  document.body.dataset.agentBookingPassed = 'true';
}
async function verifyChatScroll() {
  await wait(() => button('Số lượng'), 'bản xác nhận trước khi gửi');
  const feed = () => document.querySelector('[aria-label="Nội dung cuộc trò chuyện"]');
  async function sendAndCheck(text, readHistory = false) {
    let release;
    fixture.waitForSend = new Promise((resolve) => { release = resolve; });
    const revision = session.bookingDraft.revision;
    const input = document.querySelector('aside textarea');
    change(input, text); await pause();
    input.closest('form').requestSubmit();
    const visibleRequest = () => {
      const bubble = [...feed().querySelectorAll('p')].findLast((item) => item.textContent === text);
      if (!bubble) return false;
      const bounds = bubble.getBoundingClientRect(), viewport = feed().getBoundingClientRect();
      return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
    };
    await wait(visibleRequest, 'tin vừa gửi nhìn thấy trong khi xử lý');
    if (readHistory) {
      feed().scrollTop = 0;
      feed().dispatchEvent(new Event('scroll', { bubbles: true }));
      await pause();
    }
    release(); fixture.waitForSend = null;
    await wait(() => session.bookingDraft.revision === revision + 1 && !document.querySelector('aside textarea').disabled, 'phản hồi kèm bản xác nhận mới');
    await pause();
    assert(readHistory ? feed().scrollTop === 0 : visibleRequest(), readHistory
      ? 'không kéo người dùng khỏi tin cũ đang đọc khi phản hồi tới'
      : 'bản xác nhận dài không đẩy tin vừa gửi ra khỏi màn hình');
  }
  await sendAndCheck('Tôi muốn áp mã giảm giá cho đơn này');
  await sendAndCheck('Cho tôi kiểm tra lại thông tin đơn', true);
  // Phiên cũ có bản xác nhận chưa gắn vào tin nhắn vẫn phải thấy yêu cầu mới.
  for (const message of session.messages) {
    if (message.confirmation?.actionId === session.pendingConfirmation.actionId) delete message.confirmation;
  }
  render('ban-xac-nhan-cu');
  await wait(() => document.querySelector('[aria-label="Mở Trợ lý Handigo"]'), 'tải lại phiên có bản xác nhận rời');
  document.querySelector('[aria-label="Mở Trợ lý Handigo"]').click();
  await wait(() => button('Số lượng'), 'tải bản xác nhận rời');
  await sendAndCheck('Tôi muốn chọn lại mã giảm giá');
  document.body.dataset.agentBookingPassed = 'true';
}
async function verifyBusiness() {
  await wait(() => button('Xác nhận'), 'mở bản xác nhận');
  const chatText = () => document.querySelector('[aria-label="Nội dung cuộc trò chuyện"]').textContent;
  assert(chatText().includes('chọn lại thợ từng phục vụ cho dịch vụ này.'), 'hiển thị yêu cầu bằng lời thay mã dịch vụ');
  assert(!chatText().includes(ids.service) && !chatText().includes(ids.provider), 'ẩn ID trong tin khách và trợ lý đã lưu');
  assert(session.messages.find((message) => message._id === 'request-previous-provider').content.includes(ids.service), 'giữ nguyên ID trong dữ liệu gốc');
  const originalValues = structuredClone(values);
  async function showProposal() {
    for (const message of session.messages) if (message.confirmation?.status === 'WAITING_CONFIRMATION') message.confirmation.status = 'EXPIRED';
    session.pendingConfirmation = null; session.state = 'WAITING_USER_INPUT';
    session.rebookProposal = { id: crypto.randomUUID() };
    render(crypto.randomUUID());
    await wait(() => document.querySelector('[aria-label="Mở Trợ lý Handigo"]'), 'mở yêu cầu chuyển bản nháp');
    document.querySelector('[aria-label="Mở Trợ lý Handigo"]').click();
    await wait(() => button('Giữ bản đang soạn') && button('Chuyển sang đặt lại'), 'có hai lựa chọn trước khi thay bản nháp');
  }
  await showProposal();
  await click('Giữ bản đang soạn');
  await wait(() => !button('Chuyển sang đặt lại') && button('Số lượng'), 'giữ bản nháp và chuẩn bị lại form');
  assert(lastSend().bookingAction?.accept === false && JSON.stringify(values) === JSON.stringify(originalValues), 'giữ nguyên dữ liệu khi từ chối chuyển');
  await showProposal();
  await click('Chuyển sang đặt lại');
  await wait(() => button('Quay lại bản nháp trước'), 'có đường quay lại sau khi chuyển');
  assert(lastSend().bookingAction?.accept === true && values.uniformQuantity === 2, 'chỉ chuyển sau lựa chọn rõ ràng');
  await click('Quay lại bản nháp trước');
  await wait(() => !button('Quay lại bản nháp trước') && button('Số lượng'), 'khôi phục bản nháp ban đầu');
  assert(lastSend().bookingAction?.type === 'restore_draft' && JSON.stringify(values) === JSON.stringify(originalValues), 'khôi phục đúng toàn bộ giá trị cũ');
  await click('Xem thợ và hồ sơ');
  await wait(() => document.querySelector('#booking-provider-picker'), 'xem thợ theo địa chỉ tạm');
  await click('Xem hồ sơ', dialog());
  await wait(() => document.body.textContent.includes('Đúng giờ và làm việc cẩn thận.'), 'xem đánh giá trước khi lưu địa chỉ');
  await click('Chọn thợ này', dialog());
  await wait(() => values.preferredProviderId === ids.provider && !dialog(), 'chọn thợ cho địa chỉ tạm');
  await acceptPolicy();
  const choose = async (files) => {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    const input = document.querySelector('input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
  };
  const picture = () => new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'hien-trang.png', { type: 'image/png' });
  await choose([new File(['x'], 'sai.txt', { type: 'text/plain' })]);
  await wait(() => document.body.textContent.includes('tối đa 5 MB mỗi ảnh'), 'chặn loại tệp sai');
  assert(!calls.some((item) => item.type === 'upload'), 'không upload tệp sai');
  await choose([new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'qua-lon.png', { type: 'image/png' })]);
  assert(!calls.some((item) => item.type === 'upload'), 'không upload tệp quá lớn');
  await choose(Array.from({ length: 5 }, picture));
  await wait(() => document.body.textContent.includes('Chỉ được đính kèm tối đa 4 ảnh'), 'chặn quá 4 ảnh');
  fixture.failUpload = true;
  await choose([picture()]);
  await wait(() => document.body.textContent.includes('Lỗi upload giả lập'), 'lỗi upload có thể thử lại');
  await choose([picture()]);
  await wait(() => document.querySelector('[aria-label="Bỏ ảnh hiện trạng 1"]'), 'hiển thị ảnh vừa tải');
  assert(button('Xác nhận').disabled, 'ảnh chưa gửi thì không xác nhận form cũ');
  const composer = document.querySelector('[aria-label="Nội dung gửi cho Trợ lý Handigo"]');
  change(composer, 'Máy bị chảy nước, xem ảnh hiện trạng.'); await pause();
  document.querySelector('[aria-label="Gửi tin nhắn"]').click();
  await wait(() => lastSend()?.customerAttachments?.length === 1 && button('Xác nhận'), 'gửi ảnh cùng mô tả');
  assert(calls.filter((item) => item.type === 'upload').every((item) => item.sessionId === ids.session), 'upload gắn đúng phiên');
  await wait(() => document.querySelector('[aria-label="Nội dung cuộc trò chuyện"] img'), 'ảnh trong lịch sử tin nhắn');
  await wait(() => document.body.textContent.includes('Ảnh hiện trạng gửi kèm đơn'), 'ảnh trong form xác nhận');
  assert(button('Xác nhận').disabled, 'sửa ảnh phải đồng ý chính sách lại');
  await acceptPolicy();
  document.querySelector('[aria-label="Bỏ ảnh hiện trạng 1"]').click(); await pause();
  assert(button('Xác nhận').disabled, 'bỏ ảnh chưa gửi không xác nhận được');
  document.querySelector('[aria-label="Gửi tin nhắn"]').click();
  await wait(() => lastSend()?.customerAttachments?.length === 0 && values.customerAttachments?.length === 0
    && ![...document.querySelectorAll('[aria-label="Xác nhận thao tác"]')].at(-1)?.textContent.includes('Ảnh hiện trạng gửi kèm đơn'), 'gửi xóa ảnh bằng mảng rỗng');
  await choose(Array.from({ length: 4 }, picture));
  await wait(() => document.querySelectorAll('[aria-label="Ảnh hiện trạng đính kèm"] img').length === 4, 'tải đủ 4 ảnh');
  assert(document.querySelector('[aria-label="Đính kèm ảnh hiện trạng"]').disabled, 'đủ 4 ảnh thì khóa thêm ảnh');
  document.querySelector('[aria-label="Gửi tin nhắn"]').click();
  await wait(() => lastSend()?.customerAttachments?.length === 4 && [...document.querySelectorAll('[aria-label="Xác nhận thao tác"]')].at(-1)?.querySelectorAll('img').length === 4, 'gửi đủ 4 ảnh');
  await acceptPolicy();
  await click('Xác nhận');
  await wait(() => button('Kiểm tra thanh toán'), 'hành động nghiệp vụ cho đơn đã tạo');
  assert(!button('Xem báo giá') && !button('Tra hoàn tiền') && !button('Đặt lại đơn này'), 'đơn giá cố định đang chờ tiền không gợi ý báo giá, hoàn tiền hoặc đặt lại');
  assert(document.querySelector('[aria-label="Đính kèm ảnh yêu cầu"]'), 'đơn đã tạo vẫn gửi ảnh cho yêu cầu hỗ trợ được');
  assert(!document.querySelector('aside form img[alt^="Ảnh hiện trạng"]'), 'không tự đưa ảnh đơn đã tạo vào yêu cầu mới');
  session.orderActions = { orderId: ids.order, orderCode: 'ORD-KIEM-THU', quotation: true, refunds: true, rebook: true, payment: false };
  render('don-bao-gia-da-huy');
  await wait(() => document.querySelector('[aria-label="Mở Trợ lý Handigo"]'), 'tải lại trạng thái đơn đã hủy');
  document.querySelector('[aria-label="Mở Trợ lý Handigo"]').click();
  await wait(() => button('Xem báo giá'), 'hành động cho đơn báo giá đã hủy');
  for (const label of ['Xem báo giá', 'Tra hoàn tiền', 'Đặt lại đơn này']) {
    await click(label);
    assert(lastSend().message.includes(ids.order), 'nút ' + label + ' giữ đúng đơn');
    assert(!chatText().includes(ids.order), 'ẩn ID trong tin nhắn từ nút ' + label);
  }
  // Kiểm tra nút tìm kiếm ở trạng thái chưa gắn đơn; fixture không mô phỏng suy luận LLM.
  session.bookingDraft = null; session.payment = null; session.viewedOrder = null; session.orderActions = null;
  fixture.get = async () => structuredClone(session);
  document.querySelector('[aria-label="Đóng trợ lý"]').click();
  render('tra-cuu-nghiep-vu');
  await wait(() => document.querySelector('[aria-label="Mở Trợ lý Handigo"]'), 'mở phiên tra cứu');
  document.querySelector('[aria-label="Mở Trợ lý Handigo"]').click();
  await wait(() => button('Tìm đơn cũ') && button('Thợ từng đặt'), 'có lối vào tìm đơn/thợ cũ');
  const progress = { _id: `booking:${ids.order}`, sender: 'assistant', content: 'Theo dõi đơn ORD-KIEM-THU.\nĐơn hàng chưa thanh toán.', createdAt: new Date().toISOString() };
  session.messages.push(progress);
  fixture.socketHandlers['agent:order:message']({ sessionId: ids.session, message: structuredClone(progress) });
  await wait(() => chatText().includes('Đơn hàng chưa thanh toán.'), 'nhận thông báo ban đầu qua socket');
  progress.content = 'Theo dõi đơn ORD-KIEM-THU.\nĐã thanh toán tiền cọc.';
  fixture.socketHandlers['agent:order:message']({ sessionId: ids.session, message: structuredClone(progress) });
  await wait(() => chatText().includes('Đã thanh toán tiền cọc.') && !chatText().includes('Đơn hàng chưa thanh toán.'), 'cập nhật tin ban đầu sau thanh toán');
  const bubbles = () => [...document.querySelectorAll('[aria-label="Nội dung cuộc trò chuyện"] p')].filter((node) => node.textContent.includes('Theo dõi đơn ORD-KIEM-THU.'));
  assert(bubbles().length === 1, 'socket thay nội dung cùng ID, không thêm bong bóng chat');
  fixture.socketHandlers['agent:order:message']({ sessionId: ids.session, message: structuredClone(progress) });
  await pause();
  assert(bubbles().length === 1, 'phát lại socket vẫn chỉ có một tin');
  const feed = document.querySelector('[aria-label="Nội dung cuộc trò chuyện"]');
  assert(feed.scrollWidth <= feed.clientWidth + 1, 'ảnh và tin nhắn không tràn ngang');
  await verifyVoucherOrder();
  await verifyRepairPreview();
  document.body.dataset.agentBookingPassed = 'true';
}
async function verifyVoucherOrder() {
  const container = document.createElement('div');
  document.body.append(container);
  const previewRoot = createRoot(container);
  let action = { actionId: 'xac-nhan-voucher', tool: 'create_booking', preview: { title: 'Đặt dịch vụ', amount: 40000 },
    expiresAt: new Date(Date.now() + 600000).toISOString() };
  const message = { _id: 'voucher-sau-form', sender: 'assistant', content: 'Bạn có thể chọn mã giảm giá bên dưới.',
    createdAt: new Date().toISOString(), confirmation: action,
    choiceGroups: [{ label: 'Voucher có thể sử dụng', multiple: false, options: ['GIAM10 — giảm 10.000 đ', 'Không dùng voucher'] }] };
  const sent = [];
  const show = async (pendingActionId, overrides = {}) => {
    const pendingConfirmation = pendingActionId ? { ...action, actionId: pendingActionId } : null;
    previewRoot.render(<BrowserRouter><ChatbotPanel audience="CUSTOMER" messages={[message]} isReplying={false}
      isLoading={false} error="" availabilityMessage="" userId={ids.user}
      agentSession={{ ...session, bookingDraft: { status: 'active', revision: 1, values, summary: [], missing: [] } }}
      pendingConfirmation={pendingConfirmation} onClose={() => {}} onRetry={() => {}} onDecision={() => {}}
      onSend={async (content) => { sent.push(content); }} {...overrides} /></BrowserRouter>);
    await pause();
  };
  try {
    await show(action.actionId);
    const form = container.querySelector('[aria-label="Xác nhận thao tác"]');
    const vouchers = container.querySelector('fieldset');
    const feedback = [...container.querySelectorAll('p')].find((node) => node.textContent === message.content);
    assert(form && vouchers && Boolean(form.compareDocumentPosition(vouchers) & Node.DOCUMENT_POSITION_FOLLOWING), 'form xác nhận hiển thị trước lựa chọn voucher');
    assert(feedback && Boolean(form.compareDocumentPosition(feedback) & Node.DOCUMENT_POSITION_FOLLOWING), 'phản hồi voucher nằm sau form');
    assert(!vouchers.disabled, 'chọn được voucher khi form đặt đơn đang chờ xác nhận');
    for (const overrides of [{ isReplying: true }, { isLoading: true }, { taskBlocked: true }, { error: 'Chưa xử lý được' },
      { availabilityMessage: 'Cần bắt đầu phiên mới' }, { pendingConfirmation: { ...action, tool: 'create_payment' } }]) {
      await show(action.actionId, overrides);
      const choices = container.querySelector('fieldset');
      assert(!choices || choices.disabled, 'khóa chọn mã khi bận, lỗi, đối soát hoặc chờ hành động khác');
    }
    await show(action.actionId);
    container.querySelector('input[type="radio"]').click(); await pause();
    await click('Tiếp tục', container);
    assert(sent.at(-1) === 'Voucher có thể sử dụng: GIAM10 — giảm 10.000 đ', 'gửi đúng mã đã chọn qua luồng voucher hiện có');
    assert(!sent.some((content) => content.includes('Xác nhận')), 'chọn mã chưa tạo đơn hoặc thanh toán');
    action = { ...action, actionId: 'xac-nhan-sau-giam', preview: { ...action.preview, voucherCode: 'GIAM10', discountAmount: 10000, amount: 30000 } };
    message.confirmation = action;
    message._id = 'form-sau-giam';
    await show(action.actionId);
    assert(container.querySelector('[aria-label="Xác nhận thao tác"]').textContent.includes('30.000 đ'), 'hiển thị số tiền sau giảm trong form mới');
    assert(button('Xác nhận', container).disabled, 'form sau giảm vẫn cần đồng ý chính sách trước khi xác nhận');
    const choices = container.querySelectorAll('input[type="radio"]');
    choices[1].click(); await pause();
    await click('Tiếp tục', container);
    assert(sent.at(-1) === 'Voucher có thể sử dụng: Không dùng voucher', 'gửi được lựa chọn bỏ mã');
    message.choiceGroups = [{ label: 'Chuyên gia đang phù hợp', multiple: false, options: ['Thợ kiểm thử'] }];
    await show(action.actionId);
    assert(container.querySelector('fieldset').disabled, 'không mở khóa nhóm lựa chọn khác khi đang xác nhận');
    message.choiceGroups = [{ label: 'Kiểm tra voucher', multiple: false, options: ['Kiểm tra lại voucher', 'Không dùng voucher'] }];
    await show(action.actionId);
    assert(!container.querySelector('fieldset').disabled, 'cho thử lại tra mã khi form đặt đơn đang chờ');
    await show(undefined);
    assert(!container.querySelector('fieldset'), 'không dùng được lựa chọn voucher của bản xác nhận cũ');
  } finally { previewRoot.unmount(); container.remove(); }
}
async function verifyRepairPreview() {
  const container = document.createElement('div');
  document.body.append(container);
  const previewRoot = createRoot(container);
  const base = { title: 'Đặt sửa điều hòa', serviceType: 'variable_price', options: ['Điều hòa treo tường × 1: 0 đ'],
    originalAmount: 40000, discountAmount: 0, amount: 40000 };
  const row = (label) => [...container.querySelectorAll('dt')].find((item) => item.textContent === label)?.nextElementSibling?.textContent;
  const show = async (preview) => {
    previewRoot.render(<AgentConfirmationCard action={{ actionId: 'gia-coc', tool: 'create_booking', preview,
      expiresAt: new Date(Date.now() + 600000).toISOString() }} disabled readOnly />);
    await pause();
  };
  try {
    await show(base);
    assert(row('Tùy chọn') === 'Điều hòa treo tường', 'ẩn số lượng một và giá tùy chọn 0đ của sửa chữa');
    assert(row('Giá trước giảm') === undefined && row('Giảm giá') === undefined, 'không có mã thì ẩn hai dòng giảm giá');
    assert(row('Tiền đặt cọc') === '40.000 đ', 'cọc chưa có mã giữ đúng giá server');
    await show({ ...base, voucherCode: 'GIAM10', discountAmount: 10000, amount: 30000 });
    assert(row('Voucher') === 'GIAM10' && row('Giảm giá') === '10.000 đ', 'có mã đã áp dụng mới hiện tiền giảm');
    assert(row('Giá trước giảm') === undefined, 'bỏ dòng giá trước giảm cả khi có mã');
    assert(row('Tiền đặt cọc') === '30.000 đ', 'hiện cọc sau giảm, không trừ mã hai lần');
    await show({ ...base, voucherCode: 'GIAMHET', discountAmount: 40000, amount: 0 });
    assert(row('Tiền đặt cọc') === '0 đ', 'mã giảm hết cọc vẫn hiện khoản phải trả 0đ');
    await show({ ...base, options: ['Điều hòa treo tường × 2: 0 đ'] });
    assert(row('Tùy chọn') === 'Điều hòa treo tường × 2', 'giữ số lượng thực tế khi có nhiều máy');
    await show({ ...base, serviceType: 'fixed_price', options: ['Vệ sinh điều hòa × 1: 200.000 đ'] });
    assert(row('Tùy chọn') === 'Vệ sinh điều hòa × 1: 200.000 đ', 'giữ chi tiết giá dịch vụ cố định');
  } finally { previewRoot.unmount(); container.remove(); }
}
setTimeout(() => { void Promise.resolve().then(() => { if (!returned) verifyStorage(); }).then(run).catch((error) => { document.body.dataset.agentBookingError = error.stack || error.message; }); }, 30);
