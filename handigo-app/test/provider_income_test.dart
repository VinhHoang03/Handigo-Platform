import 'dart:async';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/realtime_connection.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/provider/data/provider_repository.dart';
import 'package:handigo_app/features/provider/domain/provider_income.dart';
import 'package:handigo_app/features/provider/presentation/provider_income_screen.dart';
import 'package:handigo_app/shared/widgets/account_overview_widgets.dart';

Map<String, dynamic> _entry(
  String id,
  String type,
  double amount, {
  String status = 'success',
  Map<String, dynamic> metadata = const {},
}) => {
  'id': id,
  'type': type,
  'amount': amount,
  'status': status,
  'direction': type == 'platform_fee' ? 'out' : 'in',
  'createdAt': '2026-11-01T18:30:00Z',
  'relatedOrderId': 'order',
  'metadata': metadata,
};

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  final calls =
      <
        ({
          String path,
          String method,
          Map<String, dynamic>? data,
          Map<String, dynamic>? query,
        })
      >[];
  Completer<Map<String, dynamic>>? withdrawal;
  int get posts => calls.where((c) => c.method == 'POST').length;
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    calls.add((path: path, method: method, data: data, query: query));
    const rewardSummary = {
      'diamonds': 160,
      'amount': 50000,
      'completionRate': 90,
      'cancellationRate': 10,
      'averageRating': 4.9,
      'completionMet': true,
      'cancellationMet': true,
      'ratingMet': true,
      'eligible': true,
    };
    if (path == '/providers/me/rewards') {
      return {
        'data': {
          'weekStart': query?['weekStart'],
          'status': query?['weekStart'] == '2026-11-02' ? 'open' : 'settled',
          'programActive': true,
          'summary': rewardSummary,
          'milestones': [
            {'diamonds': 75, 'amount': 20000},
            {'diamonds': 150, 'amount': 30000},
            {'diamonds': 225, 'amount': 50000},
          ],
        },
      };
    }
    if (path == '/providers/me/rewards/history') {
      return {
        'data': {
          'items': [
            {'weekStart': '2026-10-26', 'summary': rewardSummary},
          ],
          'nextBefore': null,
        },
      };
    }
    if (path == '/dashboard/earnings') {
      return {
        'data': {
          'completedOrders': {'count': 1, 'amount': 80000},
          'earningsByDay': [
            {'day': '2026-11-02', 'amount': 80000},
          ],
          'recentTransactions': {
            'items': [
              if (query?['page'] == 1)
                _entry('earning', 'provider_earning', 100000)
              else
                _entry('fee', 'platform_fee', 20000),
            ],
            'pagination': {'page': query?['page'], 'totalPages': 2},
          },
        },
      };
    }
    if (path == '/wallets/me') {
      return {
        'data': {'balance': 500000, 'pendingBalance': 50000},
      };
    }
    if (path == '/wallets/me/summary') {
      return {
        'data': {'totalEarnings': 80000, 'totalWithdrawals': 100000},
      };
    }
    if (path == '/bank-accounts') {
      return {
        'data': [
          {
            'id': 'bank',
            'bankName': 'Vietcombank',
            'accountNumber': '1234567890',
            'accountHolderName': 'NGUYEN AN',
            'isDefault': true,
          },
        ],
      };
    }
    if (path == '/withdrawals' && method == 'POST') {
      return withdrawal == null ? {'data': {}} : await withdrawal!.future;
    }
    if (path == '/wallets/me/deposit') {
      return {
        'data': {
          'checkoutUrl': 'https://pay.payos.vn/test',
          'transaction': {'gatewayOrderCode': '123'},
        },
      };
    }
    if (path.endsWith('/sync')) {
      return {'data': _entry('deposit', 'deposit', 100000, status: 'pending')};
    }
    return {
      'data': {
        'items': [if (query?['page'] == 2) _entry('page2', 'deposit', 100000)],
        'pagination': {'page': query?['page'] ?? 1, 'totalPages': 2},
      },
    };
  }
}

Future<GoRouter> _show(
  WidgetTester tester,
  _Api api, {
  double textScale = 1,
  bool asTab = false,
  Future<bool> Function(Uri)? launch,
}) async {
  FlutterSecureStorage.setMockInitialValues({});
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 850);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(api.close);
  final auth = AuthController(AuthRepository(api), api)
    ..status = AuthStatus.authenticated
    ..user = const AppUser(
      id: 'provider',
      fullName: 'Nguyễn An',
      email: 'an@example.test',
      role: UserRole.provider,
      providerOnboardingStatus: 'APPROVED',
    );
  final router = GoRouter(
    initialLocation: '/provider/income',
    routes: [
      GoRoute(
        path: '/provider',
        builder: (_, _) => const Scaffold(body: Text('Trang chủ bên ngoài')),
      ),
      GoRoute(
        path: '/provider/income',
        builder: (_, _) => ProviderIncomeScreen(asTab: asTab),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authControllerProvider.overrideWith((ref) => auth),
        realtimeConnectionProvider.overrideWithValue(null),
        providerFinanceNowProvider.overrideWithValue(
          () => DateTime.parse('2026-11-02T03:00:00Z'),
        ),
        providerFinanceLaunchUrlProvider.overrideWithValue(
          launch ?? (_) async => true,
        ),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

Future<void> _wallet(WidgetTester tester) async {
  await tester.tap(find.text('Ví').last);
  await tester.pumpAndSettle();
}

Future<void> _pickRangeDate(
  WidgetTester tester,
  String field,
  String value,
) async {
  final target = find.byKey(ValueKey(field));
  await tester.ensureVisible(target);
  await tester.tap(target);
  await tester.pumpAndSettle();
  await tester.tap(find.byIcon(Icons.edit_outlined));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField), value);
  await tester.tap(find.text('Chọn'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Tiền thưởng mở chính sách và lịch sử trong app', (tester) async {
    await _show(tester, _Api(), asTab: true);
    await tester.tap(find.text('Tiền thưởng'));
    await tester.pumpAndSettle();

    expect(find.text('Tuần này · 02/11 – 08/11'), findsOneWidget);
    expect(find.text('160 / 225'), findsOneWidget);
    expect(find.byIcon(Symbols.diamond), findsWidgets);
    expect(find.text('(71%)'), findsOneWidget);
    expect(find.text('50.000 ₫'), findsOneWidget);
    expect(find.text('Đạt 2/3 mốc thưởng'), findsOneWidget);
    expect(find.text('Còn 65 💎 để nhận thêm +50.000 ₫'), findsOneWidget);
    await tester.tap(find.text('Đổi tuần'));
    await tester.pumpAndSettle();
    expect(find.text('Chọn tuần thưởng'), findsOneWidget);
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) => widget is IconButton && widget.tooltip == 'Tháng sau',
            ),
          )
          .onPressed,
      isNull,
    );
    await tester.tap(find.text('26/10/2026 – 01/11/2026'));
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(find.text('Tuần này · 02/11 – 08/11'), findsOneWidget);
    await tester.tap(find.text('Đổi tuần'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('26/10/2026 – 01/11/2026'));
    await tester.tap(find.text('Áp dụng'));
    await tester.pumpAndSettle();
    expect(find.text('Tuần đã chọn · 26/10 – 01/11'), findsOneWidget);
    expect(find.text('Đã cộng tiền thưởng vào Ví Handigo.'), findsOneWidget);

    final policy = find.text('Xem chính sách thưởng');
    await tester.scrollUntilVisible(policy.hitTestable(), 120);
    await tester.pumpAndSettle();
    await tester.tap(policy);
    await tester.pumpAndSettle();
    expect(find.text('Chính sách thưởng'), findsOneWidget);
    expect(find.text('Đơn cần báo giá'), findsOneWidget);

    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    final history = find.text('Lịch sử thưởng theo tuần');
    await tester.scrollUntilVisible(history.hitTestable(), 120);
    await tester.pumpAndSettle();
    await tester.tap(history);
    await tester.pumpAndSettle();
    expect(
      find.text('160 kim cương · Đã cộng 50.000 ₫ vào ví'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Thu nhập và Ví dùng chung kiểu thẻ, chuyển mục giữ bộ lọc', (
    tester,
  ) async {
    await _show(tester, _Api(), asTab: true, textScale: 2);
    expect(find.byType(SegmentedButton<int>), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    await tester.tap(find.text('Tháng này'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Thu nhập dịch vụ sau phí'),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.byType(AccountFinancialStatCard), findsOneWidget);
    await tester.tap(find.text('Ví'));
    await tester.pumpAndSettle();
    expect(find.text('Ví Handigo'), findsOneWidget);
    expect(find.text('Số dư khả dụng'), findsOneWidget);
    expect(find.byType(AccountFinancialStatCard), findsWidgets);
    await tester.tap(find.text('Thu nhập').last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Tháng này'),
      -150,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      tester
          .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Tháng này'))
          .selected,
      isTrue,
    );
    expect(tester.takeException(), isNull);
  });

  test('Khoảng ngày dùng múi giờ Việt Nam, tuần từ thứ hai và đủ tháng', () {
    final now = DateTime.parse('2026-11-01T18:30:00Z');
    final today = ProviderIncomeRange.forPeriod(
      ProviderIncomePeriod.today,
      now,
    );
    expect(today.fromDate, '2026-11-02');
    final week = ProviderIncomeRange.forPeriod(ProviderIncomePeriod.week, now);
    expect((week.fromDate, week.toDate), ('2026-11-02', '2026-11-08'));
    final month = ProviderIncomeRange.forPeriod(
      ProviderIncomePeriod.month,
      DateTime.parse('2024-02-15T00:00:00Z'),
    );
    expect((month.fromDate, month.toDate), ('2024-02-01', '2024-02-29'));
  });

  test(
    'Thu nhập trừ phí, loại nạp ví và phí hệ thống; biểu đồ theo giờ Việt Nam',
    () {
      final summary = ProviderIncomeSummary.fromJson(
        {
          'completedOrders': {'count': 1, 'amount': 80000},
          'earningsByDay': [],
        },
        [
          ProviderFinanceEntry.fromJson(
            _entry('earning', 'provider_earning', 100000),
          ),
          ProviderFinanceEntry.fromJson(_entry('fee', 'platform_fee', 20000)),
          ProviderFinanceEntry.fromJson(_entry('deposit', 'deposit', 500000)),
          ProviderFinanceEntry.fromJson(
            _entry('failed', 'provider_earning', 90000, status: 'failed'),
          ),
          ProviderFinanceEntry.fromJson(
            _entry(
              'system',
              'platform_fee',
              10000,
              metadata: {'systemRevenueOnly': true},
            ),
          ),
        ],
      );
      expect(summary.entries.length, 2);
      expect(summary.groups.single.amount, 80000);
      final chart = summary.chart(
        ProviderIncomeRange.forPeriod(
          ProviderIncomePeriod.today,
          DateTime.parse('2026-11-02T03:00:00Z'),
        ),
      );
      expect(chart[1].amount, 80000);
      expect(chart.fold<double>(0, (sum, item) => sum + item.amount), 80000);
    },
  );

  test('Lọc năm đủ 12 tháng và khoảng thời gian bao gồm đủ hai đầu mốc', () {
    final now = DateTime.parse('2026-11-02T03:00:00Z');
    final year = ProviderIncomeRange.forPeriod(
      ProviderIncomePeriod.year,
      now,
      selectedYear: 2024,
    );
    expect((year.fromDate, year.toDate), ('2024-01-01', '2024-12-31'));
    final range = ProviderIncomeRange.forPeriod(
      ProviderIncomePeriod.customRange,
      now,
      selectedStartDate: DateTime(2024, 2, 29),
      selectedEndDate: DateTime(2024, 3, 2),
    );
    expect((range.fromDate, range.toDate), ('2024-02-29', '2024-03-02'));
    final summary = ProviderIncomeSummary.fromJson({
      'completedOrders': {'count': 0, 'amount': 0},
      'earningsByDay': [
        {'day': '2024-02-01', 'amount': 100000},
        {'day': '2024-02-29', 'amount': -20000},
        {'day': '2024-12-31', 'amount': 50000},
        {'day': '2025-02-01', 'amount': 999999},
      ],
    }, []);
    final chart = summary.chart(year);
    expect(chart.length, 12);
    expect(chart[1].amount, 80000);
    expect(chart[11].amount, 50000);
    expect(summary.chart(range).length, 3);
    expect(summary.chart(range).first.amount, -20000);
    final day = ProviderIncomeRange.forPeriod(
      ProviderIncomePeriod.customRange,
      now,
      selectedStartDate: DateTime(2024, 2, 29),
      selectedEndDate: DateTime(2024, 2, 29),
    );
    expect(summary.chart(day).length, 24);
  });

  test(
    'Repository lấy đủ các trang quyết toán và truyền đúng bộ lọc API',
    () async {
      final api = _Api();
      addTearDown(api.close);
      final repo = ProviderRepository(api);
      final result = await repo.income(
        ProviderIncomeRange.forPeriod(
          ProviderIncomePeriod.today,
          DateTime.parse('2026-11-02T03:00:00Z'),
        ),
      );
      expect(result.groups.single.amount, 80000);
      expect(api.calls.length, 2);
      expect(api.calls.first.query?['fromDate'], '2026-11-02');
      await repo.financeHistory(page: 2, type: 'deposit');
      expect(api.calls.last.query, {
        'page': 2,
        'limit': 20,
        'groupSettlements': 'true',
        'type': 'deposit',
      });
    },
  );

  testWidgets(
    'Mặc định hôm nay, đổi kỳ, ví giữ số dư hiện tại, mở trực tiếp có thể quay lại',
    (tester) async {
      final api = _Api();
      final router = await _show(tester, api);
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Hôm nay'))
            .selected,
        isTrue,
      );
      expect(find.text('Thu nhập hôm nay'), findsOneWidget);
      await tester.tap(find.text('Tuần này'));
      await tester.pumpAndSettle();
      expect(
        api.calls
            .where((call) => call.path == '/dashboard/earnings')
            .last
            .query?['toDate'],
        '2026-11-08',
      );
      await _wallet(tester);
      expect(find.textContaining('500.000'), findsOneWidget);
      expect(
        find.text('Số dư hiện tại của ví, không phụ thuộc bộ lọc thu nhập.'),
        findsOneWidget,
      );
      await tester.tap(find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, '/provider');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Chọn năm và khoảng thời gian truyền đúng bộ lọc; hủy giữ nguyên kỳ',
    (tester) async {
      final api = _Api();
      await _show(tester, api);
      expect(find.textContaining('đơn hoàn tất theo bộ lọc'), findsNothing);
      await tester.tap(find.text('Theo năm'));
      await tester.pumpAndSettle();
      final requestsBeforeYearApply = api.calls.length;
      await tester.tap(
        find.descendant(
          of: find.byType(YearPicker),
          matching: find.text('2025'),
        ),
      );
      await tester.pumpAndSettle();
      expect(api.calls.length, requestsBeforeYearApply);
      await tester.tap(find.text('Áp dụng'));
      await tester.pumpAndSettle();
      var query = api.calls
          .where((call) => call.path == '/dashboard/earnings')
          .last
          .query!;
      expect(
        (query['fromDate'], query['toDate']),
        ('2025-01-01', '2025-12-31'),
      );
      expect(find.text('Thu nhập theo tháng'), findsOneWidget);
      await tester.tap(find.text('Khoảng thời gian'));
      await tester.pumpAndSettle();
      final requestsBeforeApply = api.calls.length;
      await _pickRangeDate(tester, 'income-range-start', '11/01/2026');
      await _pickRangeDate(tester, 'income-range-end', '11/05/2026');
      expect(api.calls.length, requestsBeforeApply);
      await tester.tap(find.text('Áp dụng'));
      await tester.pumpAndSettle();
      query = api.calls
          .where((call) => call.path == '/dashboard/earnings')
          .last
          .query!;
      expect(
        (query['fromDate'], query['toDate']),
        ('2026-11-01', '2026-11-05'),
      );
      expect(find.text('Thu nhập theo ngày'), findsOneWidget);
      final requests = api.calls.length;
      await tester.tap(find.text('Khoảng thời gian'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Đóng'));
      await tester.pumpAndSettle();
      expect(api.calls.length, requests);
      expect(find.text('Thu nhập trong khoảng đã chọn'), findsOneWidget);
      expect(find.text('01/11/2026 – 05/11/2026'), findsOneWidget);
      await tester.tap(find.text('Theo năm'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(find.text('Thu nhập trong khoảng đã chọn'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Chọn nhanh chỉ áp dụng khi xác nhận, hủy giữ kỳ hiện tại', (
    tester,
  ) async {
    final api = _Api();
    await _show(tester, api, asTab: true);
    for (final (label, from, to) in const [
      ('7 ngày qua', '2026-10-27', '2026-11-02'),
      ('30 ngày qua', '2026-10-04', '2026-11-02'),
      ('Tháng trước', '2026-10-01', '2026-10-31'),
    ]) {
      await tester.tap(find.text('Khoảng thời gian'));
      await tester.pumpAndSettle();
      final requests = api.calls.length;
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      expect(api.calls.length, requests);
      await tester.tap(find.text('Áp dụng'));
      await tester.pumpAndSettle();
      final query = api.calls
          .where((call) => call.path == '/dashboard/earnings')
          .last
          .query!;
      expect((query['fromDate'], query['toDate']), (from, to));
    }
    await tester.tap(find.text('Khoảng thời gian'));
    await tester.pumpAndSettle();
    final requests = api.calls.length;
    await tester.tap(find.text('7 ngày qua'));
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(api.calls.length, requests);
    expect(find.text('01/10/2026 – 31/10/2026'), findsOneWidget);
  });

  testWidgets('Sheet ngày chặn khoảng đảo ngược và cuộn được khi chữ lớn', (
    tester,
  ) async {
    final api = _Api();
    await _show(tester, api, asTab: true, textScale: 2);
    await tester.tap(find.text('Khoảng thời gian'));
    await tester.pumpAndSettle();
    await _pickRangeDate(tester, 'income-range-start', '11/03/2026');
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Áp dụng'))
          .onPressed,
      isNull,
    );
    await _pickRangeDate(tester, 'income-range-end', '11/03/2026');
    await tester.tap(find.text('Áp dụng'));
    await tester.pumpAndSettle();
    final query = api.calls
        .where((call) => call.path == '/dashboard/earnings')
        .last
        .query!;
    expect((query['fromDate'], query['toDate']), ('2026-11-03', '2026-11-03'));
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Rút tiền kiểm tra số dư, hủy không gửi và chặn gửi lặp khi đang xử lý',
    (tester) async {
      final api = _Api()..withdrawal = Completer<Map<String, dynamic>>();
      await _show(tester, api);
      await _wallet(tester);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Yêu cầu rút tiền'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '600000');
      await tester.tap(find.text('Tiếp tục'));
      await tester.pumpAndSettle();
      expect(find.text('Số tiền vượt quá số dư khả dụng.'), findsOneWidget);
      expect(api.posts, 0);
      await tester.enterText(find.byType(TextFormField), '100000');
      await tester.tap(find.text('Tiếp tục'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(api.posts, 0);
      await tester.tap(find.text('Tiếp tục'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận'));
      await tester.pump();
      expect(api.posts, 1);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Đang xử lý…'),
            )
            .onPressed,
        isNull,
      );
      expect(api.calls.last.data, {
        'amount': 100000.0,
        'bankAccountId': 'bank',
      });
      api.withdrawal!.complete({'data': {}});
      await tester.pumpAndSettle();
      expect(find.text('Ví Handigo'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Thử mở lại PayOS không tạo giao dịch mới; chờ xác nhận không báo thành công',
    (tester) async {
      final api = _Api();
      var launches = 0;
      await _show(
        tester,
        api,
        launch: (_) async {
          launches++;
          return false;
        },
      );
      await _wallet(tester);
      await tester.tap(find.text('Nạp ví'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '100000');
      await tester.tap(find.text('Tiếp tục'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      for (var i = 0; i < 2; i++) {
        await tester.tap(find.text('Mở thanh toán PayOS'));
        await tester.pumpAndSettle();
      }
      expect(launches, 2);
      expect(api.posts, 1);
      await tester.tap(find.text('Kiểm tra thanh toán'));
      await tester.pumpAndSettle();
      expect(find.text('Nạp ví thành công.'), findsNothing);
      expect(find.textContaining('Hệ thống chưa xác nhận'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Lịch sử giao dịch phân trang và chọn bộ lọc mới quay về trang đầu',
    (tester) async {
      final api = _Api();
      await _show(tester, api);
      await _wallet(tester);
      await tester.scrollUntilVisible(
        find.text('Giao dịch gần đây'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Xem tất cả').first);
      await tester.pumpAndSettle();
      expect(find.text('Lịch sử giao dịch'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      await tester.tap(find.text('Trang sau'));
      await tester.pumpAndSettle();
      expect(find.text('2 / 2'), findsOneWidget);
      expect(api.calls.last.query?['page'], 2);
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nạp ví').last);
      await tester.pumpAndSettle();
      expect(api.calls.last.query?['page'], 1);
      expect(api.calls.last.query?['type'], 'deposit');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Mở ngân hàng từ Ví ở màn hình riêng và quay lại giữ tab Ví', (
    tester,
  ) async {
    await _show(tester, _Api());
    await _wallet(tester);
    await tester.tap(find.text('Tài khoản ngân hàng'));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.textContaining('Vietcombank'), findsOneWidget);
    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    expect(find.text('Ví Handigo'), findsOneWidget);
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      1,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Màn hình nhỏ với cỡ chữ lớn không tràn bố cục', (tester) async {
    await _show(tester, _Api(), textScale: 2);
    expect(tester.takeException(), isNull);
    await _wallet(tester);
    expect(tester.takeException(), isNull);
  });
}
