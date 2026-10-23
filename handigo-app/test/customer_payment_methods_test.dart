import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/account/data/account_repository.dart';
import 'package:handigo_app/features/account/domain/account_models.dart';
import 'package:handigo_app/features/account/presentation/account_screens.dart';

class _Repository extends AccountRepository {
  _Repository(super.api);
  final banks = <Map<String, dynamic>>[];
  Map<String, dynamic>? saved;
  int walletReads = 0, paymentReads = 0;

  @override
  Future<List<Map<String, dynamic>>> bankAccounts() async => List.of(banks);
  @override
  Future<void> createBankAccount(Map<String, dynamic> data) async {
    saved = data;
    banks.add({...data, '_id': 'bank-test', 'isDefault': true});
  }

  @override
  Future<WalletInfo> wallet() async => const WalletInfo(balance: 250000);
  @override
  Future<PagedResult<WalletTransactionItem>> walletTransactions({
    int page = 1,
  }) async {
    walletReads++;
    return PagedResult(
      items: [
        WalletTransactionItem(
          id: '$page',
          type: 'deposit',
          amount: 100000,
          direction: 'in',
          description: 'Giao dịch ví trang $page',
          status: 'completed',
        ),
      ],
      page: page,
      totalPages: 2,
    );
  }

  @override
  Future<PagedResult<PaymentHistoryItem>> paymentHistory({int page = 1}) async {
    paymentReads++;
    return PagedResult(
      items: const [
        PaymentHistoryItem(
          id: 'payment-test',
          amount: 150000,
          method: 'payos',
          status: 'paid',
        ),
      ],
      page: page,
      totalPages: 1,
    );
  }
}

void main() {
  late _Repository repository;
  setUp(() {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    repository = _Repository(api);
  });

  Future<void> showWallet(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/customer/wallet',
      routes: [
        GoRoute(
          path: '/customer/wallet',
          builder: (_, _) => const WalletScreen(),
        ),
        GoRoute(
          path: '/customer/wallet/history',
          builder: (_, _) => const CustomerPaymentHistoryScreen(),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [accountRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('Chỉ tải lịch sử khi bấm và có phân trang, nguồn thanh toán', (
    tester,
  ) async {
    await showWallet(tester);
    expect(find.text('Phương thức đã lưu'), findsOneWidget);
    expect(repository.walletReads, 0);
    expect(repository.paymentReads, 0);
    expect(find.text('Lịch sử giao dịch'), findsNothing);
    await tester.tap(find.text('Lịch sử'));
    await tester.pumpAndSettle();
    expect(repository.walletReads, 1);
    expect(repository.paymentReads, 0);
    expect(find.text('Giao dịch ví trang 1'), findsOneWidget);
    await tester.tap(find.byTooltip('Trang sau'));
    await tester.pumpAndSettle();
    expect(find.text('Giao dịch ví trang 2'), findsOneWidget);
    await tester.tap(find.text('Thanh toán đơn'));
    await tester.pumpAndSettle();
    expect(repository.paymentReads, 1);
    expect(find.text('Chuyển khoản ngân hàng'), findsOneWidget);
    expect(find.text('Thành công'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Thêm ngân hàng thủ công có validation và cập nhật danh sách', (
    tester,
  ) async {
    await showWallet(tester);
    await tester.tap(find.byTooltip('Thêm phương thức thanh toán'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lưu'));
    await tester.pumpAndSettle();
    expect(repository.saved, isNull);
    final fields = find.byType(TextFormField);
    for (final entry in [
      'Ngân hàng thử nghiệm',
      'TEST',
      '12345678',
      'KHACH HANG',
    ].asMap().entries) {
      await tester.enterText(fields.at(entry.key), entry.value);
    }
    await tester.tap(find.text('Lưu'));
    await tester.pumpAndSettle();
    expect(repository.saved?['bankCode'], 'TEST');
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.text('Ngân hàng thử nghiệm'), findsOneWidget);
    expect(find.textContaining('•••• 5678'), findsOneWidget);
    expect(find.textContaining('12345678'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Tài khoản gộp ngôn ngữ, giao diện và bỏ các mục dư', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          accountProfileProvider.overrideWith(
            (ref) async => <String, dynamic>{},
          ),
          accountAddressesProvider.overrideWith((ref) async => <AddressItem>[]),
          accountWalletProvider.overrideWith((ref) async => const WalletInfo()),
          accountVouchersProvider.overrideWith((ref) async => <VoucherItem>[]),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const AccountOverviewScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Thông tin cá nhân'), findsNothing);
    await tester.scrollUntilVisible(find.text('Ngôn ngữ & giao diện'), 200);
    expect(find.text('Chưa triển khai'), findsOneWidget);
    expect(find.text('Ngôn ngữ'), findsNothing);
    expect(find.text('Giao diện'), findsNothing);
    await tester.scrollUntilVisible(find.text('Đăng xuất'), 200);
    expect(find.text('Tiện ích trong tầm tay'), findsNothing);
    expect(find.textContaining('Phiên bản'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Phương thức thanh toán vừa màn hình nhỏ khi tăng cỡ chữ', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    repository.banks.add({
      'bankName': 'Ngân hàng thử nghiệm',
      'accountNumber': '12345678',
      'accountHolderName': 'KHACH HANG',
      'isDefault': true,
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: [accountRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp(
          theme: AppTheme.light,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
          home: const WalletScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Ngân hàng thử nghiệm'), 200);
    expect(tester.takeException(), isNull);
  });
}
