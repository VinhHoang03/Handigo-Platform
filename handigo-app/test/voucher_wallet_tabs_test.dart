import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/account/domain/account_models.dart';
import 'package:handigo_app/features/account/presentation/account_screens.dart';
import 'package:handigo_app/features/home/data/customer_home_repository.dart';
import 'package:handigo_app/features/home/domain/customer_home_data.dart';
import 'package:handigo_app/features/home/presentation/customer_home_provider.dart';

const _offer = HomeRewardOffer(
  id: 'offer',
  termsVersion: 'v1',
  name: 'Ưu đãi đổi điểm',
  points: 100,
  discountType: 'AMOUNT',
  discountValue: 10000,
  minOrderAmount: 100000,
  maxDiscountAmount: 10000,
  applicableOrderType: 'fixed_price',
);

class _Rewards implements CustomerHomeRepository {
  int balance = 150, redemptions = 0;
  String? request;
  @override
  Future<void> redeemReward(HomeRewardOffer offer, String requestId) async {
    expect(offer.id, 'offer');
    request = requestId;
    redemptions++;
    balance -= offer.points;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'Kho voucher chia đúng dữ liệu ba tab, chữ $scale trên màn nhỏ',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(320, 800);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        var historyReads = 0;
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              customerHomeRewardsProvider.overrideWith(
                (ref) async =>
                    const HomeRewards(balance: 150, offers: [_offer]),
              ),
              accountOwnedVouchersProvider.overrideWith(
                (ref, page) async => PagedResult(
                  page: page,
                  totalPages: 1,
                  items: const [
                    VoucherItem(
                      code: 'RIENG',
                      name: 'Voucher cá nhân',
                      discountValue: 10000,
                    ),
                  ],
                ),
              ),
              accountPublicVouchersProvider.overrideWith(
                (ref) async => const [
                  VoucherItem(
                    code: 'WELCOME10',
                    name: 'Ưu đãi công khai',
                    discountType: 'PERCENT',
                    discountValue: 10,
                    minOrderAmount: 100000,
                    maxDiscountAmount: 20000,
                  ),
                ],
              ),
              accountVoucherUsageProvider.overrideWith((ref, page) async {
                historyReads++;
                return PagedResult(
                  page: page,
                  totalPages: 1,
                  items: const [
                    VoucherUsageItem(
                      name: 'Voucher đã dùng',
                      code: 'DADUNG',
                      discountAmount: 5000,
                      status: 'used',
                      usedAt: '2026-11-01T08:00:00Z',
                    ),
                  ],
                );
              }),
            ],
            child: MaterialApp(
              theme: AppTheme.light,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
              home: const VoucherScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('150 điểm'), findsOneWidget);
        expect(find.text('Voucher cá nhân'), findsOneWidget);
        expect(find.text('Ưu đãi công khai'), findsNothing);
        expect(historyReads, 0);
        await tester.ensureVisible(find.text('Voucher hiện có'));
        await tester.tap(find.text('Voucher hiện có'));
        await tester.pumpAndSettle();
        expect(find.text('100 điểm để đổi'), findsOneWidget);
        expect(find.text('Voucher cá nhân'), findsNothing);
        await tester.scrollUntilVisible(
          find.text('Mã WELCOME10'),
          200,
          scrollable: find.byWidgetPredicate(
            (widget) =>
                widget is Scrollable &&
                widget.axisDirection == AxisDirection.down,
          ),
        );
        expect(find.text('Không cần đổi điểm'), findsOneWidget);
        expect(find.textContaining('Đơn tối thiểu'), findsWidgets);
        expect(find.textContaining('Giảm tối đa'), findsWidgets);
        await tester.ensureVisible(find.text('Lịch sử sử dụng'));
        await tester.tap(find.text('Lịch sử sử dụng'));
        await tester.pumpAndSettle();
        expect(find.text('Voucher đã dùng'), findsOneWidget);
        expect(find.text('Mã DADUNG'), findsOneWidget);
        expect(find.textContaining('Ngày dùng'), findsOneWidget);
        expect(historyReads, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Đổi voucher cập nhật số điểm và voucher của tôi', (
    tester,
  ) async {
    final rewards = _Rewards();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerHomeRepositoryProvider.overrideWithValue(rewards),
          customerHomeRewardsProvider.overrideWith(
            (ref) async =>
                HomeRewards(balance: rewards.balance, offers: const [_offer]),
          ),
          accountOwnedVouchersProvider.overrideWith(
            (ref, page) async => PagedResult(
              page: page,
              totalPages: 1,
              items: [
                if (rewards.redemptions > 0)
                  const VoucherItem(
                    code: 'MOIDOI',
                    name: 'Voucher mới đổi',
                    discountValue: 10000,
                  ),
              ],
            ),
          ),
          accountPublicVouchersProvider.overrideWith((ref) async => []),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const VoucherScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Voucher hiện có'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Đổi voucher'));
    await tester.tap(find.text('Đổi voucher'));
    await tester.pumpAndSettle();
    expect(find.text('Đổi voucher Ưu đãi đổi điểm'), findsOneWidget);
    await tester.tap(find.text('Xác nhận đổi'));
    await tester.pumpAndSettle();
    expect(rewards.redemptions, 1);
    expect(rewards.request, isNotEmpty);
    expect(find.text('50 điểm'), findsOneWidget);
    expect(find.text('Chưa đủ điểm'), findsOneWidget);
    await tester.ensureVisible(find.text('Voucher của tôi'));
    await tester.tap(find.text('Voucher của tôi'));
    await tester.pumpAndSettle();
    expect(find.text('Voucher mới đổi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
