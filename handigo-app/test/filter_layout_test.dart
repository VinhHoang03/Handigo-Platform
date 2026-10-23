import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/chat/domain/chat_models.dart';
import 'package:handigo_app/features/chat/presentation/chat_screens.dart';
import 'package:handigo_app/features/notifications/domain/notification_models.dart';
import 'package:handigo_app/features/notifications/presentation/notification_screens.dart';

void main() {
  for (final dark in [false, true]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('Bộ lọc thông báo đổi nhóm, tối $dark, cỡ chữ $scale', (
        tester,
      ) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(320, 800);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              notificationListProvider.overrideWith(
                (ref) async => const PagedResult(
                  items: [
                    AppNotification(
                      id: 'order',
                      title: 'Đơn mới',
                      content: 'Bạn có đơn mới',
                      type: 'ORDER',
                      isRead: true,
                    ),
                    AppNotification(
                      id: 'payment',
                      title: 'Đã thanh toán',
                      content: 'Thanh toán thành công',
                      type: 'PAYMENT',
                      isRead: true,
                    ),
                  ],
                  page: 1,
                  totalPages: 1,
                ),
              ),
            ],
            child: MaterialApp(
              theme: dark ? AppTheme.dark : AppTheme.light,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
              home: const NotificationCenterScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Đơn mới'), findsOneWidget);
        expect(find.text('Đã thanh toán'), findsOneWidget);
        final payment = find.widgetWithText(ChoiceChip, 'Thanh toán');
        await tester.ensureVisible(payment);
        await tester.tap(payment);
        await tester.pumpAndSettle();
        expect(find.text('Đơn mới'), findsNothing);
        expect(find.text('Đã thanh toán'), findsOneWidget);
        expect(tester.getSize(payment).height, greaterThanOrEqualTo(48));
        expect(tester.takeException(), isNull);
      });

      testWidgets('Bộ lọc tin nhắn không cắt chữ, tối $dark, cỡ chữ $scale', (
        tester,
      ) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              conversationListProvider.overrideWith(
                (ref) async => const PagedResult<Conversation>(
                  items: [],
                  page: 1,
                  totalPages: 0,
                ),
              ),
            ],
            child: MaterialApp(
              theme: dark ? AppTheme.dark : AppTheme.light,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
              home: const ConversationListScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final support = find.widgetWithText(ChoiceChip, 'Hỗ trợ');
        await tester.ensureVisible(support);
        await tester.tap(support);
        await tester.pumpAndSettle();
        expect(tester.widget<ChoiceChip>(support).selected, isTrue);
        expect(tester.getSize(support).height, greaterThanOrEqualTo(48));
        expect(find.text('Bạn chưa có cuộc trò chuyện nào.'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  }
}
