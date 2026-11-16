import 'dart:math' as math;

import 'package:dio/dio.dart';

/// Chỉ dùng để xem thử giao diện provider với dữ liệu giả.
/// Bật bằng: `flutter run -d chrome --dart-define=MOCK_PROVIDER_API=true`
/// Chỉ hoạt động ở bản debug. Không gọi backend, không ghi dữ liệu thật:
/// các thao tác ghi (POST/PATCH/DELETE) chỉ trả về thành công giả.
const bool kMockProviderApi = bool.fromEnvironment('MOCK_PROVIDER_API');

class DevProviderMockInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    handler.resolve(
      Response<Map<String, dynamic>>(
        requestOptions: options,
        statusCode: 200,
        data: _route(options),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Định tuyến: path -> dữ liệu giả
// ---------------------------------------------------------------------------

Map<String, dynamic> _route(RequestOptions o) {
  final path = o.path;
  final q = o.queryParameters;
  final isGet = o.method.toUpperCase() == 'GET';

  if (path == '/auth/refresh-token') return {'token': 'mock-token'};
  if (path == '/auth/me') return {'user': _user};
  if (path == '/auth/logout') return {'success': true};

  if (path == '/dashboard/overview') return _ok(_overview);
  if (path == '/dashboard/provider/availability') {
    final body = o.data;
    final status = body is Map ? body['availabilityStatus'] : null;
    return _ok({..._overview, 'availabilityStatus': status ?? 'online'});
  }
  if (path == '/dashboard/earnings') return _ok(_earnings(q));

  if (path == '/orders/provider') {
    final status = q['status']?.toString();
    final list = status == null || status.isEmpty || status == 'all'
        ? _orders
        : _orders
              .where((order) => status.split(',').contains(order['status']))
              .toList();
    return _ok(_page(list, q));
  }
  if (path == '/orders/provider/recent') {
    return _ok({'items': _orders.take(5).toList()});
  }
  if (path == '/orders/assignments/pending') return _ok(<dynamic>[]);

  final orderMatch = RegExp(r'^/orders/(mock-order-\d+)$').firstMatch(path);
  if (orderMatch != null) {
    final id = orderMatch.group(1);
    final order = _orders.firstWhere(
      (order) => order['_id'] == id,
      orElse: () => _orders.first,
    );
    return _ok(order);
  }

  if (path == '/wallets/me') return _ok(_wallet);
  if (path == '/wallets/me/summary') return _ok(_walletSummary);
  if (path == '/wallets/me/transactions') {
    final type = q['type']?.toString();
    final list = type == null || type.isEmpty
        ? _entries
        : _entries.where((e) => e['type'] == type).toList();
    return _ok(_page(list, q));
  }
  if (path == '/withdrawals/me') return _ok(_page(_withdrawals, q));
  if (path == '/bank-accounts') return _ok(_banks);

  if (path == '/providers/me/rewards') {
    return _ok(_rewardWeek('${q['weekStart'] ?? _vnDay(DateTime.now())}'));
  }
  if (path == '/providers/me/rewards/history') {
    final current = _weekStart(DateTime.now());
    return _ok({
      'items': [
        for (var i = 0; i < 4; i++)
          _rewardWeek(_dayKey(current.subtract(Duration(days: 7 * i)))),
      ],
      'nextBefore': null,
    });
  }
  if (path == '/providers/me') return _ok(_profile);

  if (path == '/feedback/provider/me') return _ok(_page(_feedbacks, q));
  if (path == '/chat/conversations') return _ok(_page(_conversations, q));
  if (path == '/notifications') return _ok(_page(_notifications, q));
  if (path == '/notifications/unread-count') return _ok({'count': 3});

  // Các endpoint chưa có dữ liệu giả: GET trả danh sách rỗng, ghi trả thành công.
  return isGet ? _ok(_page(const [], q)) : _ok(<String, dynamic>{});
}

Map<String, dynamic> _ok(Object? data) => {'success': true, 'data': data};

Map<String, dynamic> _page(
  List<Map<String, dynamic>> items,
  Map<String, dynamic> q,
) {
  final limit = math.min(math.max(_int(q['limit'], 20), 1), 1000);
  final page = math.min(math.max(_int(q['page'], 1), 1), 100000);
  final total = items.length;
  final start = math.min((page - 1) * limit, total);
  final end = math.min(start + limit, total);
  return {
    'items': items.sublist(start, end),
    'pagination': {
      'page': page,
      'limit': limit,
      'total': total,
      'totalPages': total == 0 ? 1 : (total / limit).ceil(),
    },
  };
}

int _int(Object? value, int fallback) =>
    value is num ? value.toInt() : int.tryParse('$value') ?? fallback;

// ---------------------------------------------------------------------------
// Thời gian: mọi mốc tính theo giờ hiện tại để dữ liệu luôn "gần đây"
// ---------------------------------------------------------------------------

final DateTime _now = DateTime.now();
DateTime _at(int dayOffset, int hour, [int minute = 0]) =>
    DateTime(_now.year, _now.month, _now.day + dayOffset, hour, minute);

String _iso(DateTime value) => value.toUtc().toIso8601String();

/// Ngày (yyyy-MM-dd) theo múi giờ Việt Nam (UTC+7).
String _vnDay(DateTime value) =>
    _dayKey(value.toUtc().add(const Duration(hours: 7)));

String _dayKey(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${value.day.toString().padLeft(2, '0')}';

/// Thứ Hai đầu tuần (theo giờ VN) của một thời điểm.
DateTime _weekStart(DateTime value) {
  final vn = value.toUtc().add(const Duration(hours: 7));
  final day = DateTime.utc(vn.year, vn.month, vn.day);
  return day.subtract(Duration(days: day.weekday - DateTime.monday));
}

// ---------------------------------------------------------------------------
// Dữ liệu giả
// ---------------------------------------------------------------------------

const _provider = {
  '_id': 'mock-provider',
  'userId': {
    '_id': 'mock-provider-user',
    'fullName': 'Nguyễn Văn An (demo)',
    'avatar': null,
    'gender': 'male',
  },
};

const _user = {
  'id': 'mock-provider-user',
  'fullName': 'Nguyễn Văn An (demo)',
  'email': 'demo.provider@handigo.local',
  'role': 'PROVIDER',
  'avatar': null,
  'gender': 'male',
  'isGoogleAccount': false,
  'providerOnboardingStatus': 'APPROVED',
};

const _overview = {
  'walletBalance': 4850000,
  'monthlyEarnings': 12350000,
  'completedOrders': 48,
  'averageRating': 4.8,
  'availabilityStatus': 'online',
  'pendingWithdrawals': 1,
  'pendingBalance': 350000,
};

const _wallet = {
  'balance': 4850000,
  'pendingBalance': 350000,
  'currency': 'VND',
  'totalEarnings': 38200000,
  'totalWithdrawn': 32000000,
};

const _walletSummary = {
  'currentBalance': 4850000,
  'totalEarnings': 38200000,
  'totalWithdrawals': 32000000,
  'totalPlatformFeesPaid': 5730000,
};

const _banks = [
  {
    '_id': 'mock-bank-1',
    'bankName': 'Vietcombank',
    'bankCode': 'VCB',
    'accountNumber': '0123456789',
    'accountHolderName': 'NGUYEN VAN AN',
    'isDefault': true,
  },
  {
    '_id': 'mock-bank-2',
    'bankName': 'MB Bank',
    'bankCode': 'MB',
    'accountNumber': '987654321',
    'accountHolderName': 'NGUYEN VAN AN',
    'isDefault': false,
  },
];

const _profile = {
  '_id': 'mock-provider',
  'userId': {
    '_id': 'mock-provider-user',
    'fullName': 'Nguyễn Văn An (demo)',
    'email': 'demo.provider@handigo.local',
    'gender': 'male',
    'avatar': null,
  },
  'status': 'APPROVED',
  'bio':
      'Thợ sửa chữa dân dụng hơn 6 năm kinh nghiệm, làm việc cẩn thận và đúng hẹn.',
  'experienceYears': 6,
  'averageRating': 4.8,
};

/// Đơn giả: trạng thái đa dạng để thấy đủ các nhãn/màu trên giao diện.
List<Map<String, dynamic>> get _orders => [
  _order(
    1,
    'in_progress',
    'Sửa ống nước bồn rửa',
    'Chung cư Sunrise City, Quận 7',
    'Anh Tuấn',
    _at(0, 9, 30),
    150000,
    'unpaid',
    90,
    'Bồn rửa bị rò nước ở khớp nối phía dưới.',
  ),
  _order(
    2,
    'accepted',
    'Bảo dưỡng máy lạnh treo tường x2',
    'KDC Him Lam, Quận 7',
    'Anh Nam',
    _at(0, 14),
    360000,
    'unpaid',
    90,
    'Hai máy lạnh cần vệ sinh và kiểm tra gas.',
  ),
  _order(
    3,
    'accepted',
    'Kiểm tra đường điện gia đình',
    'Phường Tân Phong, Quận 7',
    'Chị Mai',
    _at(1, 9),
    280000,
    'unpaid',
    90,
    'Một số ổ cắm chập chờn, cần kiểm tra đường dây.',
  ),
  _order(
    4,
    'created',
    'Thay khóa cửa chính',
    'Đường Nguyễn Thị Thập, Quận 7',
    'Chị Hương',
    _at(0, 8),
    250000,
    'unpaid',
    60,
    'Ổ khóa bị kẹt, cần thay ổ mới.',
  ),
  _order(
    5,
    'completed',
    'Vệ sinh máy giặt cửa ngang',
    'Đỗ Xuân Hợp, TP. Thủ Đức',
    'Chị Lan',
    _at(-1, 8, 30),
    250000,
    'paid',
    90,
    'Máy giặt rung mạnh và có tiếng ồn khi vắt.',
  ),
  _order(
    6,
    'completed',
    'Tổng vệ sinh căn hộ',
    'Chung cư Riviera Point, Quận 7',
    'Anh Minh',
    _at(-3, 15),
    420000,
    'paid',
    120,
    'Căn hộ cần tổng vệ sinh trước khi bàn giao.',
  ),
  _order(
    7,
    'completed',
    'Thay bóng đèn và ổ cắm',
    'Phường An Phú, TP. Thủ Đức',
    'Chị Thu',
    _at(-5, 10),
    150000,
    'paid',
    60,
    'Thay 4 bóng đèn LED và 2 ổ cắm âm tường.',
  ),
  _order(
    8,
    'cancelled',
    'Sửa vòi sen phòng tắm',
    'Phường Tân Phong, Quận 7',
    'Chị Hạnh',
    _at(-1, 11),
    180000,
    'unpaid',
    60,
    'Vòi sen bị rò nước và áp lực nước yếu.',
  ),
  _order(
    9,
    'completed',
    'Sửa điều hòa không lạnh',
    'Phường Bình Thọ, TP. Thủ Đức',
    'Anh Đức',
    _at(-12, 13),
    300000,
    'paid',
    90,
    'Điều hòa chạy nhưng không làm lạnh.',
  ),
  _order(
    10,
    'completed',
    'Sửa khóa tủ và bản lề',
    'Phường Linh Trung, TP. Thủ Đức',
    'Chị Ngọc',
    _at(-16, 9),
    120000,
    'paid',
    60,
    'Bản lề tủ bếp bị lỏng, khóa tủ kẹt.',
  ),
  _order(
    11,
    'completed',
    'Thông tắc bồn cầu',
    'Phường Hiệp Bình Chánh, TP. Thủ Đức',
    'Anh Hải',
    _at(0, 6),
    200000,
    'paid',
    60,
    'Bồn cầu bị tắc, nước không thoát.',
  ),
];

Map<String, dynamic> _order(
  int n,
  String status,
  String service,
  String address,
  String customer,
  DateTime scheduled,
  int amount,
  String paymentStatus,
  int durationMinutes,
  String problem,
) {
  final parts = address.split(', ');
  return {
    '_id': 'mock-order-$n',
    'orderCode': 'HD-DEMO-${n.toString().padLeft(3, '0')}',
    'status': status,
    'paymentStatus': paymentStatus,
    'paymentMethod': 'cash',
    'orderType': 'scheduled',
    'scheduledAt': _iso(scheduled),
    'createdAt': _iso(scheduled.subtract(const Duration(days: 1))),
    'updatedAt': _iso(scheduled),
    'problemDescription': problem,
    'serviceId': {
      'name': service,
      'serviceType': n % 3 == 0 ? 'variable_price' : 'fixed_price',
      'coverImage': null,
    },
    'addressSnapshot': {
      'addressLabel': 'Nhà riêng',
      'recipientName': customer,
      'recipientPhone': '0900000${n.toString().padLeft(3, '0')}',
      'fullAddress': address,
      'ward': parts.first,
      'province': parts.last,
      'latitude': 10.76 + n * 0.001,
      'longitude': 106.66 + n * 0.001,
    },
    'customerId': {
      '_id': 'mock-customer-$n',
      'fullName': customer,
      'avatar': null,
      'phone': '0900000${n.toString().padLeft(3, '0')}',
    },
    'providerId': _provider,
    'pricing': {'totalPaidAmount': amount, 'subtotal': amount},
    'schedule': {
      'durationMinutes': durationMinutes,
      'expectedStartAt': _iso(scheduled),
      'expectedEndAt': _iso(scheduled.add(Duration(minutes: durationMinutes))),
    },
    'statusHistory': const <Map<String, dynamic>>[],
    'cancellation': status == 'cancelled'
        ? {'reason': 'Khách hủy đơn trước giờ hẹn', 'cancelledBy': 'customer'}
        : null,
  };
}

/// Các giao dịch ví/doanh thu, sắp xếp mới nhất trước.
List<Map<String, dynamic>> get _entries {
  final list = <Map<String, dynamic>>[];
  for (final order in _orders.where((o) => o['status'] == 'completed')) {
    final gross = (order['pricing'] as Map)['totalPaidAmount'] as int;
    final fee = (gross * 0.15).round();
    final net = gross - fee;
    final createdAt = DateTime.parse(
      order['scheduledAt'] as String,
    ).add(const Duration(hours: 2));
    final related = {'_id': order['_id'], 'orderCode': order['orderCode']};
    final code = order['orderCode'];
    final settlement = {
      'grossAmount': gross,
      'platformFee': fee,
      'netEarning': net,
    };
    list.add({
      '_id': 'tx-earn-${order['_id']}',
      'type': 'provider_earning',
      'amount': gross,
      'direction': 'in',
      'status': 'success',
      'description': 'Thu nhập đơn $code',
      'createdAt': _iso(createdAt),
      'balanceAfter': null,
      'relatedOrderId': related,
      'metadata': {
        'orderCode': code,
        'paymentMethod': 'cash',
        'serviceName': (order['serviceId'] as Map)['name'],
      },
      'settlementDetails': settlement,
    });
    list.add({
      '_id': 'tx-fee-${order['_id']}',
      'type': 'platform_fee',
      'amount': fee,
      'direction': 'out',
      'status': 'success',
      'description': 'Phí nền tảng đơn $code',
      'createdAt': _iso(createdAt),
      'relatedOrderId': related,
      'metadata': {'orderCode': code, 'paymentMethod': 'cash'},
      'settlementDetails': settlement,
    });
  }
  list.addAll([
    {
      '_id': 'tx-reward-1',
      'type': 'provider_weekly_reward',
      'amount': 150000,
      'direction': 'in',
      'status': 'success',
      'description': 'Thưởng hoàn thành tuần trước',
      'createdAt': _iso(_at(-4, 9)),
      'metadata': {},
    },
    {
      '_id': 'tx-deposit-1',
      'type': 'deposit',
      'amount': 500000,
      'direction': 'in',
      'status': 'success',
      'description': 'Nạp ví qua PayOS',
      'createdAt': _iso(_at(-6, 16)),
      'metadata': {'paymentMethod': 'payos'},
    },
    {
      '_id': 'tx-refund-1',
      'type': 'refund',
      'amount': 80000,
      'direction': 'in',
      'status': 'success',
      'description': 'Hoàn tiền đơn HD-DEMO-008',
      'createdAt': _iso(_at(-2, 12)),
      'metadata': {'orderCode': 'HD-DEMO-008'},
    },
    {
      '_id': 'tx-withdraw-1',
      'type': 'withdraw',
      'amount': 1000000,
      'direction': 'out',
      'status': 'success',
      'description': 'Rút tiền về Vietcombank',
      'createdAt': _iso(_at(-7, 10)),
      'metadata': {},
    },
    {
      '_id': 'tx-withdraw-2',
      'type': 'withdraw_rejected',
      'amount': 200000,
      'direction': 'in',
      'status': 'rejected',
      'description': 'Hoàn khoản rút bị từ chối',
      'createdAt': _iso(_at(-9, 15)),
      'metadata': {},
    },
    {
      '_id': 'tx-pending-1',
      'type': 'provider_earning',
      'amount': 350000,
      'direction': 'in',
      'status': 'pending',
      'description': 'Thu nhập chờ xác nhận',
      'createdAt': _iso(_at(0, 7)),
      'metadata': {'orderCode': 'HD-DEMO-004'},
    },
  ]);
  list.sort(
    (a, b) => DateTime.parse(
      b['createdAt'] as String,
    ).compareTo(DateTime.parse(a['createdAt'] as String)),
  );
  return list;
}

/// Thống kê thu nhập theo khoảng ngày (fromDate/toDate theo giờ VN).
Map<String, dynamic> _earnings(Map<String, dynamic> q) {
  final from = q['fromDate']?.toString();
  final to = q['toDate']?.toString();
  final inRange = _entries.where((e) {
    final day = _vnDay(DateTime.parse(e['createdAt'] as String));
    return (from == null || day.compareTo(from) >= 0) &&
        (to == null || day.compareTo(to) <= 0);
  }).toList();
  final earnings = inRange
      .where((e) => e['type'] == 'provider_earning' && e['status'] == 'success')
      .toList();
  final byDay = <String, num>{};
  for (final e in earnings) {
    final day = _vnDay(DateTime.parse(e['createdAt'] as String));
    final net = (e['settlementDetails'] as Map)['netEarning'] as int;
    byDay[day] = (byDay[day] ?? 0) + net;
  }
  final netTotal = earnings.fold<int>(
    0,
    (sum, e) => sum + ((e['settlementDetails'] as Map)['netEarning'] as int),
  );
  return {
    'completedOrders': {'amount': netTotal, 'count': earnings.length},
    'earningsByDay': [
      for (final entry in byDay.entries)
        {'day': entry.key, 'amount': entry.value},
    ],
    'recentTransactions': _page(inRange, q),
  };
}

List<Map<String, dynamic>> get _withdrawals => [
  {
    '_id': 'mock-wd-1',
    'amount': 350000,
    'status': 'pending',
    'createdAt': _iso(_at(0, 8)),
    'bankAccountId': {'bankName': 'Vietcombank', 'accountNumber': '0123456789'},
    'adminNote': null,
  },
  {
    '_id': 'mock-wd-2',
    'amount': 1000000,
    'status': 'approved',
    'createdAt': _iso(_at(-7, 10)),
    'bankAccountId': {'bankName': 'Vietcombank', 'accountNumber': '0123456789'},
    'adminNote': null,
  },
  {
    '_id': 'mock-wd-3',
    'amount': 200000,
    'status': 'rejected',
    'createdAt': _iso(_at(-9, 15)),
    'bankAccountId': {'bankName': 'MB Bank', 'accountNumber': '987654321'},
    'adminNote': 'Sai số tài khoản, vui lòng cập nhật lại.',
  },
];

/// Thưởng tuần: tuần hiện tại đang chạy, các tuần trước đã chốt.
Map<String, dynamic> _rewardWeek(String weekStart) {
  final current = _dayKey(_weekStart(DateTime.now()));
  final isCurrent = weekStart == current;
  return {
    'weekStart': weekStart,
    'status': isCurrent ? 'active' : 'settled',
    'programActive': true,
    'summary': {
      'diamonds': isCurrent ? 6 : 9,
      'amount': isCurrent ? 150000 : 250000,
      'completionRate': 0.96,
      'cancellationRate': 0.02,
      'averageRating': 4.8,
      'completionMet': true,
      'cancellationMet': true,
      'ratingMet': true,
      'eligible': true,
    },
    'milestones': [
      {'diamonds': 5, 'amount': 100000},
      {'diamonds': 8, 'amount': 250000},
      {'diamonds': 10, 'amount': 400000},
    ],
  };
}

List<Map<String, dynamic>> get _feedbacks => [
  for (final (i, rating, comment) in [
    (1, 5, 'Thợ đến đúng giờ, làm việc gọn gàng và sạch sẽ.'),
    (2, 4, 'Làm tốt, chỉ hơi chậm một chút so với dự kiến.'),
    (3, 5, 'Giải thích rõ tình trạng máy và báo giá minh bạch.'),
    (4, 3, 'Sửa được nhưng vẫn còn tiếng ồn nhẹ.'),
  ])
    {
      '_id': 'mock-feedback-$i',
      'rating': rating,
      'comment': comment,
      'createdAt': _iso(_at(-i, 17)),
      'orderId': {
        '_id': 'mock-order-${i + 4}',
        'orderCode': 'HD-DEMO-00${i + 4}',
      },
      'customerId': {'fullName': _orders[i + 3]['customerId']!['fullName']},
      'reply': null,
    },
];

List<Map<String, dynamic>> get _conversations => [
  for (final order in _orders.take(4))
    {
      '_id': 'mock-conv-${order['_id']}',
      'orderId': {
        '_id': order['_id'],
        'orderCode': order['orderCode'],
        'serviceId': {'name': order['serviceId']!['name']},
      },
      'customerId': order['customerId'],
      'providerId': _provider,
      'lastMessage': {
        'content': 'Mình đến sớm khoảng 10 phút nhé.',
        'sentAt': _iso(_at(0, 7, 45)),
        'senderId': {'_id': 'mock-customer-${order['_id']}'},
      },
      'providerLastSeenAt': _iso(_at(0, 7)),
    },
];

List<Map<String, dynamic>> get _notifications => [
  for (final (i, title, content, read) in [
    (
      1,
      'Đơn mới được phân công',
      'Bạn có đơn HD-DEMO-002 lúc 14:00 hôm nay.',
      false,
    ),
    (
      2,
      'Khách đã thanh toán',
      'Đơn HD-DEMO-005 đã được thanh toán đầy đủ.',
      false,
    ),
    (
      3,
      'Thưởng tuần đã cộng vào ví',
      'Bạn nhận được 150.000đ tiền thưởng tuần.',
      false,
    ),
    (
      4,
      'Đánh giá mới',
      'Khách hàng vừa đánh giá 5 sao cho đơn HD-DEMO-006.',
      true,
    ),
    (
      5,
      'Lịch hẹn đã đổi',
      'Đơn HD-DEMO-003 đã đổi sang ngày mai lúc 09:00.',
      true,
    ),
  ])
    {
      '_id': 'mock-notif-$i',
      'title': title,
      'content': content,
      'type': 'ORDER',
      'isRead': read,
      'createdAt': _iso(_at(0, 6 + i)),
      'data': {},
    },
];
