import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/features/account/presentation/customer_withdrawals.dart';
import 'package:handigo_app/features/home/domain/customer_home_data.dart';
import 'package:handigo_app/features/home/presentation/customer_home_provider.dart';
import 'package:handigo_app/features/home/presentation/customer_shell.dart';
import 'package:handigo_app/shared/widgets/linked_provider_avatar.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());

  final amounts = <Object?>[];

  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(authenticated, isTrue);
    if (method == 'POST') {
      expect(path, '/withdrawals');
      amounts.add(data!['amount']);
      return {};
    }
    if (path == '/withdrawals/me') {
      expect(query, {'page': 1, 'limit': 20});
      return {
        'data': {
          'items': [
            {
              'amount': 100000,
              'status': 'rejected',
              'adminNote': 'Thông tin nhận tiền chưa hợp lệ.',
            },
          ],
          'pagination': {'page': 1, 'totalPages': 1},
        },
      };
    }
    expect(path, '/providers/provider-1/public');
    return {
      'data': {
        'user': {'fullName': 'Thợ Minh'},
        'provider': {'experienceYears': 5, 'verified': true},
      },
    };
  }
}

void main() {
  testWidgets('Lịch sử rút tiền hiển thị trạng thái và ghi chú xử lý', (
    tester,
  ) async {
    final api = _Api();
    addTearDown(api.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: const MaterialApp(home: CustomerWithdrawalsScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Từ chối'), findsOneWidget);
    expect(
      find.textContaining('Thông tin nhận tiền chưa hợp lệ.'),
      findsOneWidget,
    );
  });

  testWidgets('Avatar mở hồ sơ công khai của đúng thợ', (tester) async {
    final api = _Api();
    addTearDown(api.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: const MaterialApp(
          home: Scaffold(
            body: LinkedProviderAvatar(
              name: 'Thợ Minh',
              providerId: 'provider-1',
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.byTooltip('Xem hồ sơ thợ'));
    await tester.pumpAndSettle();
    expect(find.text('Hồ sơ thợ'), findsOneWidget);
    expect(find.text('Kinh nghiệm 5 năm'), findsOneWidget);
  });

  testWidgets('Rút tiền chặn số tiền vượt số dư và gửi số tiền hợp lệ', (
    tester,
  ) async {
    final api = _Api();
    addTearDown(api.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () => showCustomerWithdrawal(context, 100000),
                child: const Text('Rút tiền'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Rút tiền'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '100001');
    await tester.pumpAndSettle();
    final submit = find.widgetWithText(FilledButton, 'Gửi yêu cầu');
    expect(tester.widget<FilledButton>(submit).onPressed, isNull);
    await tester.enterText(find.byType(TextField), '100000');
    await tester.pumpAndSettle();
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(api.amounts, [100000]);
  });

  testWidgets('Tin tức lọc theo chuyên mục', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerNewsProvider.overrideWith(
            (ref) async => const [
              HomeNewsArticle(
                slug: 'meo',
                title: 'Vệ sinh máy lạnh',
                excerpt: '',
                category: 'Mẹo hay',
                coverImage: '',
              ),
              HomeNewsArticle(
                slug: 'uu-dai',
                title: 'Khuyến mãi tháng này',
                excerpt: '',
                category: 'Ưu đãi',
                coverImage: '',
              ),
            ],
          ),
        ],
        child: const MaterialApp(home: CustomerNewsScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, 'Mẹo hay'));
    await tester.pumpAndSettle();
    expect(find.text('Vệ sinh máy lạnh'), findsOneWidget);
    expect(find.text('Khuyến mãi tháng này'), findsNothing);
  });
}
