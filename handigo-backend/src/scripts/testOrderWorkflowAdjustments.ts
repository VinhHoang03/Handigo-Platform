import assert from 'node:assert/strict';
import { calculateRefundPolicy } from '../services/refundPolicy.service';
import { withAssignmentArea } from '../utils/orderAddress';
import { createProviderApplicationSchema } from '../validations/providerApplication.validator';
import { confirmCashPaymentSchema } from '../validations/order.validator';

const now = new Date();
for (const orderType of ['normal', 'scheduled', 'recurring'] as const) {
  const input = { role: 'customer' as const, orderType, orderStatus: 'accepted' as const, hasAssignedProvider: true,
    paidAmount: 100000, now, providerAcceptedAt: new Date(now.getTime() - 1000) };
  assert.equal(calculateRefundPolicy(input).canCancel, true);
  const arrived = calculateRefundPolicy({ ...input, providerArrived: true });
  assert.equal(arrived.canCancel, false);
  assert.equal(arrived.refundAmount, 0);
  assert.match(arrived.policyReason, /đã xác nhận đến nơi/);
}

const snapshot = { fullAddress: '12 Đường Kiểm Thử', ward: 'Phường thử', province: 'Tỉnh thử', recipientPhone: '0900000000' };
const assignment = withAssignmentArea({ addressId: null, addressSnapshot: snapshot });
assert.equal(assignment?.addressId.fullAddress, snapshot.fullAddress);
assert.equal('recipientPhone' in assignment!.addressId, false);
assert.equal('addressSnapshot' in assignment!, false);
const legacy = withAssignmentArea({ addressId: { _id: 'dia-chi-cu', fullAddress: '34 Đường Cũ', ward: 'Phường cũ', province: 'Tỉnh cũ' } });
assert.equal(legacy?.addressId.fullAddress, '34 Đường Cũ');

const application = { applicationType: 'service_addition', serviceIds: ['100000000000000000000001'] };
assert.equal(createProviderApplicationSchema.safeParse(application).success, true);
const certificate = { title: 'Chứng chỉ kiểm thử', imageUrls: ['https://example.com/chung-chi.jpg'], issuedAt: '2024-02-29', expiresAt: '2099-01-01' };
const parseCertificate = (patch: object) => createProviderApplicationSchema.safeParse({ ...application, certificates: [{ ...certificate, ...patch }] });
assert.equal(parseCertificate({}).success, true);
for (const patch of [{ issuedAt: '2023-02-29' }, { issuedAt: '2024-02-30' }, { issuedAt: '0000-01-01' },
  { issuedAt: '2098-01-01' }, { expiresAt: '2020-01-01' }, { expiresAt: '2024-01-01' }]) {
  assert.equal(parseCertificate(patch).success, false, JSON.stringify(patch));
}
assert.equal(confirmCashPaymentSchema.safeParse({ expectedAmount: 100000 }).success, true);
for (const expectedAmount of [-1, 1.5, '100000', undefined]) {
  assert.equal(confirmCashPaymentSchema.safeParse({ expectedAmount }).success, false);
}
console.log('Đạt: khóa hủy ngay khi đến nơi, địa chỉ đầy đủ gửi riêng cho thợ, chứng chỉ tùy chọn, ngày hợp lệ và số tiền xác nhận tiền mặt.');
