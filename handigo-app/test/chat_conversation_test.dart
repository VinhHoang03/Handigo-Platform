import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/core/network/realtime_connection.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/chat/data/chat_repository.dart';
import 'package:handigo_app/features/chat/domain/chat_models.dart';
import 'package:handigo_app/features/chat/presentation/chat_screens.dart';

const greeting =
    'Chào bạn, tôi là Nguyễn Văn An, thợ đã nhận đơn ORD-001 của bạn. Tôi sẽ đến đúng lịch hẹn.';

class _Repository extends ChatRepository {
  _Repository(super.api);
  final sent = <String>[];
  @override
  Future<void> seen(String id) async {}
  @override
  Future<PagedResult<ChatMessage>> messages(String id, String userId) async =>
      PagedResult(
        items: [
          const ChatMessage(
            id: 'welcome',
            content: greeting,
            isMine: false,
            messageType: 'text',
          ),
          for (var i = 0; i < sent.length; i++)
            ChatMessage(
              id: 'reply-$i',
              content: sent[i],
              isMine: true,
              messageType: 'text',
            ),
        ],
        page: 1,
        totalPages: 1,
      );
  @override
  Future<void> send(String id, String content) async {
    sent.add(content);
  }
}

void main() {
  testWidgets(
    'Hội thoại giữ lời chào, bỏ nút dịch vụ và gọi điện, vẫn gửi trả lời được',
    (tester) async {
      final api = ApiClient(Dio(), CookieJar());
      addTearDown(api.close);
      final repository = _Repository(api);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            realtimeConnectionProvider.overrideWithValue(null),
            chatRepositoryProvider.overrideWithValue(repository),
            authControllerProvider.overrideWith(
              (ref) => AuthController(AuthRepository(api), api)
                ..user = const AppUser(
                  id: 'customer',
                  fullName: 'Khách hàng',
                  email: 'customer@example.test',
                  role: UserRole.customer,
                )
                ..status = AuthStatus.authenticated,
            ),
          ],
          child: const MaterialApp(
            home: ChatScreen(
              conversationId: 'conversation',
              title: 'Nguyễn Văn An',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text(greeting), findsOneWidget);
      expect(find.text('Trao đổi về đơn dịch vụ'), findsNothing);
      expect(find.byTooltip('Gọi điện'), findsNothing);
      expect(find.byIcon(Icons.phone_outlined), findsNothing);
      await tester.enterText(
        find.byType(TextField),
        'Cảm ơn anh, hẹn gặp anh.',
      );
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pumpAndSettle();
      expect(repository.sent, ['Cảm ơn anh, hẹn gặp anh.']);
      expect(find.text('Cảm ơn anh, hẹn gặp anh.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
