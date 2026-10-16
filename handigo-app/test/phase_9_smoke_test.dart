import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';

void main() {
  group('Giai đoạn 9 - quy tắc booking', () {
    test('giới hạn số lượng option trong khoảng backend hỗ trợ', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(bookingDraftProvider.notifier);
      controller.setQuantity('option-1', 0);
      expect(controller.state.quantities['option-1'], 1);
      controller.setQuantity('option-1', 120);
      expect(controller.state.quantities['option-1'], 99);
    });

    test('chuẩn hóa mã voucher trước khi gửi API', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(bookingDraftProvider.notifier);
      controller.setVoucherCode('  handigo-10 ');
      expect(controller.state.voucherCode, 'HANDIGO-10');
      controller.setVoucherCode(' ');
      expect(controller.state.voucherCode, isNull);
    });

    test('giữ đúng loại booking và phương thức thanh toán', () {
      expect(bookingTypeValue(BookingType.recurring), 'recurring');
      expect(paymentMethodValue(PaymentMethod.bank), 'bank');
    });
  });
}
