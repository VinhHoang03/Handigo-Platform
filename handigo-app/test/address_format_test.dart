import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/shared/utils/address_format.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';

void main() {
  test('Rút gọn địa chỉ bản đồ và không lặp phường, thành phố', () {
    expect(
      formatAddressData({
        'fullAddress':
            '45, Đường Lê Hữu Trác, Phường An Hải, Thành phố Đà Nẵng, 02363, Việt Nam',
        'ward': 'Phường An Hải',
        'province': 'Thành phố Đà Nẵng',
        'placeId': 'map-place',
      }),
      '45 Lê Hữu Trác, An Hải, Đà Nẵng',
    );
  });

  test('Giữ chữ Đường nhập tay và địa chỉ cũ không rõ nguồn', () {
    for (final placeId in [null, '', 'agent-area:danang']) {
      expect(
        formatAddressData({
          'fullAddress': '12345 Đường số 2',
          'ward': 'Phường An Hải',
          'province': 'Thành phố Đà Nẵng',
          'placeId': placeId,
        }),
        '12345 Đường số 2, An Hải, Đà Nẵng',
      );
    }
    expect(formatAddress('12345'), '12345');
    expect(formatAddressData({}), isNull);
  });

  test('Địa chỉ snapshot được rút gọn mà không thay đổi dữ liệu nguồn', () {
    final snapshot = {
      'fullAddress': '45 Đường Lê Hữu Trác',
      'ward': 'Phường An Hải',
      'province': 'Thành phố Đà Nẵng',
    };
    final order = OrderDetail.fromJson({
      '_id': 'order',
      'addressSnapshot': snapshot,
    });
    expect(order.addressLabel, '45 Đường Lê Hữu Trác, An Hải, Đà Nẵng');
    expect(snapshot['fullAddress'], '45 Đường Lê Hữu Trác');
  });
}
