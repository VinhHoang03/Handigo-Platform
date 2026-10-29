import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/chat/data/chat_repository.dart';
import 'package:handigo_app/features/chat/domain/chat_models.dart';
import 'package:handigo_app/features/chat/presentation/chat_screens.dart';
import 'package:handigo_app/features/chat/presentation/order_chat_button.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/shared/widgets/app_feedback.dart';

class _Repository extends ChatRepository {
  _Repository(super.api);
  int calls = 0;
  bool fail = false;
  @override
  Future<Conversation> conversationForOrder(String id) async {
    calls++;
    if (fail) throw const ApiException('Không kết nối được máy chủ.');
    return Conversation(
      id: 'chat',
      orderId: id,
      orderCode: 'ORD-001',
      title: 'Thợ An',
    );
  }
}

Future<(_Repository, GoRouter)> _show(WidgetTester tester, Widget child) async {
  final api = ApiClient(Dio(), CookieJar());
  final repository = _Repository(api);
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (_, _) => Scaffold(body: child),
      ),
      GoRoute(
        path: '/customer/chat/order/:id',
        builder: (_, state) =>
            Scaffold(body: Text('Đã mở ${(state.extra as Conversation).id}')),
      ),
      GoRoute(
        path: '/provider/chat/order/:id',
        builder: (_, state) =>
            Scaffold(body: Text('Đã mở ${(state.extra as Conversation).id}')),
      ),
    ],
  );
  addTearDown(api.close);
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [chatRepositoryProvider.overrideWithValue(repository)],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  return (repository, router);
}

void main() {
  for (final status in ['created', 'cancelled']) {
    testWidgets(
      'Nút nhắn tin đơn $status hiện và bấm báo lý do tại danh sách',
      (tester) async {
        final (repository, router) = await _show(
          tester,
          OrderSummaryCard(
            order: OrderSummary(
              id: 'order',
              code: 'ORD-001',
              serviceName: 'Vệ sinh điều hòa',
              status: status,
            ),
          ),
        );
        expect(
          tester
              .widget<OutlinedButton>(
                find.widgetWithText(OutlinedButton, 'Nhắn tin'),
              )
              .onPressed,
          isNotNull,
        );
        await tester.tap(find.text('Nhắn tin'));
        await tester.pumpAndSettle();
        expect(
          find.text(
            status == 'created'
                ? 'Chưa có thợ nhận đơn nên chưa thể nhắn tin.'
                : 'Đơn đã hủy nên không thể nhắn tin.',
          ),
          findsOneWidget,
        );
        expect(repository.calls, 0);
        expect(router.routeInformationProvider.value.uri.path, '/');
        AppToast.dismiss(tester.element(find.byType(OrderSummaryCard)));
        await tester.pumpAndSettle();
      },
    );
  }

  testWidgets('Kết nối lỗi chỉ hiện toast, giữ nguyên trang và cho thử lại', (
    tester,
  ) async {
    final (repository, router) = await _show(
      tester,
      const OrderChatButton(
        orderId: 'order',
        status: 'accepted',
        hasProvider: true,
      ),
    );
    repository.fail = true;
    await tester.tap(find.text('Nhắn tin'));
    await tester.pumpAndSettle();
    expect(
      find.text('Chưa kết nối được tin nhắn. Bạn thử lại nhé.'),
      findsOneWidget,
    );
    expect(router.routeInformationProvider.value.uri.path, '/');
    repository.fail = false;
    await tester.tap(find.text('Nhắn tin'));
    await tester.pumpAndSettle();
    expect(find.text('Đã mở chat'), findsOneWidget);
    expect(repository.calls, 2);
    AppToast.dismiss(tester.element(find.text('Đã mở chat')));
    await tester.pumpAndSettle();
  });

  for (final providerView in [false, true]) {
    testWidgets(
      'Mở đúng cuộc trò chuyện cho ${providerView ? 'thợ' : 'khách'}',
      (tester) async {
        final (repository, _) = await _show(
          tester,
          OrderChatButton(
            orderId: 'order',
            status: 'completed',
            hasProvider: true,
            providerView: providerView,
          ),
        );
        await tester.tap(find.text('Nhắn tin'));
        await tester.pumpAndSettle();
        expect(find.text('Đã mở chat'), findsOneWidget);
        expect(repository.calls, 1);
        expect(
          GoRouterState.of(tester.element(find.text('Đã mở chat'))).uri.path,
          '/${providerView ? 'provider' : 'customer'}/chat/order/order',
        );
        expect(tester.takeException(), isNull);
      },
    );
  }
}
