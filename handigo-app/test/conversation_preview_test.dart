import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/chat/domain/chat_models.dart';
import 'package:handigo_app/features/chat/presentation/chat_screens.dart';

void main() {
  test('Nhận diện người gửi khi API trả senderId là đối tượng', () {
    final item = Conversation.fromJson({
      '_id': 'chat',
      'orderId': 'order',
      'lastMessage': {
        'content': 'Xin chào',
        'senderId': {'_id': 'me'},
      },
    });
    expect(item.lastMessageSenderId, 'me');
  });

  for (final scale in [1.0, 2.0]) {
    testWidgets('Hiển thị Bạn cho tin tự gửi, card gọn với cỡ chữ $scale', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 800);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final api = ApiClient(Dio(), CookieJar());
      addTearDown(api.close);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              (ref) => AuthController(AuthRepository(api), api)
                ..user = const AppUser(
                  id: 'me',
                  fullName: 'Khách hàng',
                  email: 'customer@example.test',
                  role: UserRole.customer,
                )
                ..status = AuthStatus.authenticated,
            ),
            conversationListProvider.overrideWith(
              (ref) async => const PagedResult(
                items: [
                  Conversation(
                    id: 'mine',
                    orderId: '',
                    orderCode: '',
                    title: 'Người nhận',
                    lastMessage: 'Tôi sẽ đến',
                    lastMessageSenderId: 'me',
                  ),
                  Conversation(
                    id: 'other',
                    orderId: 'order',
                    orderCode: 'HD001',
                    title: 'Người gửi khác',
                    lastMessage: 'Đã nhận tin',
                    lastMessageSenderId: 'other',
                  ),
                ],
                page: 1,
                totalPages: 1,
              ),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
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
      expect(find.text('Bạn: Tôi sẽ đến'), findsOneWidget);
      expect(find.text('Đã nhận tin'), findsOneWidget);
      expect(find.text('Bạn: Đã nhận tin'), findsNothing);
      expect(find.text('#HD001'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
