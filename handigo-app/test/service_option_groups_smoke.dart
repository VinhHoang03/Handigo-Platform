import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/domain/service_option.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';

// Kiểm thử logic độc lập với Flutter SDK và kết nối máy chủ.
void main() {
  final service = Service.fromJson({
    '_id': 'service', 'name': 'Máy lạnh', 'serviceType': 'fixed_price',
    'optionGroups': [
      {'_id': 'type', 'name': 'Loại máy', 'selectionMode': 'single', 'isRequired': true},
      {'_id': 'work', 'name': 'Công việc', 'selectionMode': 'multiple', 'isRequired': true},
    ],
  });
  final detail = ServiceDetail(service: service, options: [
    for (final id in ['a', 'b']) ServiceOption(id: id, name: id, price: 180000, groupId: 'type'),
    for (final id in ['c', 'd']) ServiceOption(id: id, name: id, price: 90000, groupId: 'work'),
  ]);
  void check(bool valid, String message) { if (!valid) throw StateError(message); }
  check(detail.selectionError([]) != null, 'Thiếu nhóm bắt buộc phải bị từ chối');
  check(detail.selectionError(['a']) != null, 'Phải chọn cả hai nhóm bắt buộc');
  check(detail.selectionError(['a', 'b', 'c']) != null, 'Nhóm chọn một phải giới hạn một tùy chọn');
  check(detail.selectionError(['a', 'c', 'd']) == null, 'Nhóm chọn nhiều phải chấp nhận nhiều lựa chọn');
  check(detail.selectionError(['a', 'c', 'đã-xóa']) != null, 'Không chấp nhận tùy chọn đã mất');
  final price = BookingPreview.fromJson({'bookingAmount': 300000, 'discountedAmount': 250000, 'promotionDiscountAmount': 30000, 'voucherDiscountAmount': 20000});
  check(price.discountedAmount == 250000 && price.promotionDiscountAmount == 30000 && price.voucherDiscountAmount == 20000, 'Đọc đúng tổng tiền từ hệ thống');
  // ignore: avoid_print
  print('Đạt kiểm thử logic nhóm tùy chọn và tổng tiền Dart.');
}
