enum ProviderIncomePeriod { today, week, month, year, customRange }

DateTime vietnamDateTime(DateTime value) =>
    value.toUtc().add(const Duration(hours: 7));

class ProviderIncomeRange {
  const ProviderIncomeRange(this.from, this.to, this.period);
  factory ProviderIncomeRange.forPeriod(
    ProviderIncomePeriod period,
    DateTime now, {
    int? selectedYear,
    DateTime? selectedStartDate,
    DateTime? selectedEndDate,
  }) {
    final vn = vietnamDateTime(now);
    final today = DateTime.utc(vn.year, vn.month, vn.day);
    final start = selectedStartDate ?? today;
    final end = selectedEndDate ?? start;
    return switch (period) {
      ProviderIncomePeriod.today => ProviderIncomeRange(today, today, period),
      ProviderIncomePeriod.week => ProviderIncomeRange(
        today.subtract(Duration(days: today.weekday - 1)),
        today.add(Duration(days: 7 - today.weekday)),
        period,
      ),
      ProviderIncomePeriod.month => ProviderIncomeRange(
        DateTime.utc(today.year, today.month, 1),
        DateTime.utc(today.year, today.month + 1, 0),
        period,
      ),
      ProviderIncomePeriod.year => ProviderIncomeRange(
        DateTime.utc(selectedYear ?? today.year, 1, 1),
        DateTime.utc(selectedYear ?? today.year, 12, 31),
        period,
      ),
      ProviderIncomePeriod.customRange => ProviderIncomeRange(
        DateTime.utc(start.year, start.month, start.day),
        DateTime.utc(end.year, end.month, end.day),
        period,
      ),
    };
  }
  final DateTime from, to;
  final ProviderIncomePeriod period;
  String get fromDate => dayKey(from);
  String get toDate => dayKey(to);
  String get label => switch (period) {
    ProviderIncomePeriod.today => 'Hôm nay',
    ProviderIncomePeriod.week => 'Tuần này',
    ProviderIncomePeriod.month => 'Tháng này',
    ProviderIncomePeriod.year => 'năm ${from.year}',
    ProviderIncomePeriod.customRange => 'trong khoảng đã chọn',
  };
  bool get isSingleDay => from == to;
  static String dayKey(DateTime day) =>
      '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';

  @override
  bool operator ==(Object other) =>
      other is ProviderIncomeRange &&
      from == other.from &&
      to == other.to &&
      period == other.period;
  @override
  int get hashCode => Object.hash(from, to, period);
}

class ProviderFinanceEntry {
  const ProviderFinanceEntry({
    required this.id,
    required this.type,
    required this.amount,
    required this.direction,
    required this.status,
    this.description,
    this.createdAt,
    this.balanceAfter,
    this.orderId,
    this.orderCode,
    this.transactionCode,
    this.grossAmount,
    this.platformFee,
    this.netEarning,
    this.paymentMethod,
    this.affectsWalletBalance,
    this.systemRevenueOnly = false,
    this.bankLabel,
    this.adminNote,
    this.gatewayOrderCode,
    this.checkoutUrl,
  });

  factory ProviderFinanceEntry.fromJson(Map<String, dynamic> json) {
    final metadata = json['metadata'] is Map
        ? json['metadata'] as Map
        : const {};
    final settlement = json['settlementDetails'] is Map
        ? json['settlementDetails'] as Map
        : metadata;
    final order = json['relatedOrderId'];
    final gateway = json['gatewayResponse'];
    final paymentLink = gateway is Map ? gateway['paymentLink'] : null;
    return ProviderFinanceEntry(
      id: '${json['_id'] ?? json['id']}',
      type: '${json['type'] ?? ''}',
      amount: _number(json['amount']) ?? 0,
      direction: '${json['direction'] ?? ''}',
      status: '${json['status'] ?? ''}',
      description: json['description'] as String?,
      createdAt: DateTime.tryParse('${json['createdAt']}'),
      balanceAfter: _number(json['balanceAfter']),
      orderId: order == null
          ? null
          : order is Map
          ? '${order['_id'] ?? order['id']}'
          : '$order',
      orderCode: metadata['orderCode'] as String?,
      transactionCode: json['transactionCode'] as String?,
      grossAmount: _number(settlement['grossAmount']),
      platformFee: _number(settlement['platformFee']),
      netEarning: _number(settlement['netEarning']),
      paymentMethod: metadata['paymentMethod'] as String?,
      affectsWalletBalance: metadata['affectsWalletBalance'] as bool?,
      systemRevenueOnly: metadata['systemRevenueOnly'] == true,
      gatewayOrderCode: json['gatewayOrderCode']?.toString(),
      checkoutUrl: paymentLink is Map
          ? paymentLink['checkoutUrl'] as String?
          : null,
    );
  }

  factory ProviderFinanceEntry.withdrawal(Map<String, dynamic> json) {
    final bank = json['bankAccountId'];
    final number = bank is Map ? '${bank['accountNumber'] ?? ''}' : '';
    final last4 = number.length > 4
        ? number.substring(number.length - 4)
        : number;
    return ProviderFinanceEntry(
      id: '${json['_id'] ?? json['id']}',
      type: 'withdraw',
      direction: 'out',
      amount: _number(json['amount']) ?? 0,
      status: '${json['status'] ?? ''}',
      description: 'Yêu cầu rút tiền',
      createdAt: DateTime.tryParse('${json['createdAt']}'),
      bankLabel: bank is Map ? '${bank['bankName'] ?? ''} · ****$last4' : null,
      adminNote: json['adminNote'] as String?,
    );
  }

  final String id, type, direction, status;
  final double amount;
  final DateTime? createdAt;
  final String? description,
      orderId,
      orderCode,
      transactionCode,
      paymentMethod,
      bankLabel,
      adminNote;
  final double? balanceAfter, grossAmount, platformFee, netEarning;
  final bool? affectsWalletBalance;
  final bool systemRevenueOnly;
  final String? gatewayOrderCode, checkoutUrl;
  bool get isIncome =>
      status == 'success' &&
      !systemRevenueOnly &&
      (type == 'provider_earning' || type == 'platform_fee');
  double get incomeAmount => type == 'platform_fee' ? -amount : amount;
  String get typeLabel =>
      const {
        'provider_earning': 'Thu nhập dịch vụ',
        'provider_weekly_reward': 'Tiền thưởng tuần',
        'platform_fee': 'Phí nền tảng',
        'deposit': 'Nạp ví',
        'payment': 'Thanh toán',
        'refund': 'Hoàn tiền',
        'withdraw': 'Rút tiền',
        'withdraw_rejected': 'Hoàn khoản rút bị từ chối',
        'adjustment': 'Điều chỉnh ví',
      }[type] ??
      'Giao dịch ví';
  String get statusLabel =>
      const {
        'pending': 'Chờ xử lý',
        'success': 'Thành công',
        'failed': 'Thất bại',
        'cancelled': 'Đã hủy',
        'approved': 'Đã duyệt',
        'rejected': 'Đã từ chối',
      }[status] ??
      'Chưa xác định';

  static double? _number(dynamic value) =>
      value is num && value.isFinite ? value.toDouble() : null;
}

class ProviderIncomeGroup {
  ProviderIncomeGroup(this.entries);
  final List<ProviderFinanceEntry> entries;
  ProviderFinanceEntry get primary => entries.firstWhere(
    (item) => item.type == 'provider_earning',
    orElse: () => entries.first,
  );
  double get amount => entries.fold(0, (sum, item) => sum + item.incomeAmount);
  bool get hasBreakdown =>
      primary.grossAmount != null &&
      primary.platformFee != null &&
      primary.grossAmount! - primary.platformFee! == amount;
}

class ProviderIncomeSummary {
  const ProviderIncomeSummary({
    required this.amount,
    required this.completedOrders,
    required this.byDay,
    required this.entries,
  });
  factory ProviderIncomeSummary.fromJson(
    Map<String, dynamic> json,
    List<ProviderFinanceEntry> entries,
  ) {
    final completed = json['completedOrders'] as Map;
    return ProviderIncomeSummary(
      amount: (completed['amount'] as num).toDouble(),
      completedOrders: (completed['count'] as num).toInt(),
      byDay: {
        for (final item in (json['earningsByDay'] as List).whereType<Map>())
          '${item['day']}': (item['amount'] as num).toDouble(),
      },
      entries: entries.where((item) => item.isIncome).toList(),
    );
  }
  final double amount;
  final int completedOrders;
  final Map<String, double> byDay;
  final List<ProviderFinanceEntry> entries;

  List<ProviderIncomeGroup> get groups {
    final grouped = <String, List<ProviderFinanceEntry>>{};
    for (final entry in entries) {
      (grouped[entry.orderId ?? entry.id] ??= []).add(entry);
    }
    return grouped.values.map(ProviderIncomeGroup.new).toList();
  }

  List<({String label, double amount})> chart(ProviderIncomeRange range) {
    if (range.isSingleDay) {
      final amounts = List<double>.filled(24, 0);
      for (final entry in entries) {
        if (entry.createdAt == null) continue;
        final date = vietnamDateTime(entry.createdAt!);
        if (ProviderIncomeRange.dayKey(date) == range.fromDate) {
          amounts[date.hour] += entry.incomeAmount;
        }
      }
      return [
        for (var hour = 0; hour < 24; hour++)
          (label: '${hour.toString().padLeft(2, '0')}h', amount: amounts[hour]),
      ];
    }
    if (range.period == ProviderIncomePeriod.year) {
      final amounts = List<double>.filled(12, 0);
      for (final entry in byDay.entries) {
        final day = DateTime.tryParse(entry.key);
        if (day != null && day.year == range.from.year) {
          amounts[day.month - 1] += entry.value;
        }
      }
      return [
        for (var month = 1; month <= 12; month++)
          (label: 'T$month', amount: amounts[month - 1]),
      ];
    }
    return [
      for (
        var day = range.from;
        !day.isAfter(range.to);
        day = day.add(const Duration(days: 1))
      )
        (
          label: '${day.day}/${day.month}',
          amount: byDay[ProviderIncomeRange.dayKey(day)] ?? 0,
        ),
    ];
  }
}
