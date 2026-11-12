import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
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
  bool activeOrder = true;
  bool failLoading = false;
  bool hasGreeting = true;
  int messageLoads = 0;
  @override
  Future<bool> canSend(String id) async => activeOrder;
  @override
  Future<void> seen(String id) async {}
  @override
  Future<PagedResult<ChatMessage>> messages(String id, String userId) async {
    messageLoads++;
    if (failLoading) throw const ApiException('Mất kết nối.');
    return PagedResult(
      items: [
        if (hasGreeting)
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
  }

  @override
  Future<void> send(String id, String content) async {
    sent.add(content);
  }
}

Future<_Repository> _showChat(
  WidgetTester tester, {
  bool failLoading = false,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 800);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  final api = ApiClient(Dio(), CookieJar());
  addTearDown(api.close);
  final repository = _Repository(api)..failLoading = failLoading;
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
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
  return repository;
}

void main() {
  test(
    'Tin nhắn đọc avatar người gửi và hỗ trợ dữ liệu chỉ có mã người gửi',
    () {
      final message = ChatMessage.fromJson({
        '_id': 'message',
        'senderId': {
          '_id': 'provider',
          'avatar': 'https://example.test/avatar.jpg',
        },
        'content': greeting,
      }, 'customer');
      expect(message.senderAvatar, 'https://example.test/avatar.jpg');
      expect(message.isMine, isFalse);
      expect(
        ChatMessage.fromJson({
          '_id': 'message',
          'senderId': 'customer',
        }, 'customer').senderAvatar,
        isNull,
      );
    },
  );

  testWidgets(
    'Hội thoại giữ lời chào, bỏ nút dịch vụ và gọi điện, vẫn gửi trả lời được',
    (tester) async {
      final repository = await _showChat(tester);
      expect(find.text(greeting), findsOneWidget);
      final avatar = find
          .ancestor(
            of: find.byIcon(Icons.person_outline),
            matching: find.byType(SizedBox),
          )
          .first;
      final bubble = find
          .ancestor(of: find.text(greeting), matching: find.byType(Container))
          .first;
      final avatarRect = tester.getRect(avatar);
      final bubbleRect = tester.getRect(bubble);
      expect(avatarRect.size, const Size(32, 32));
      expect(bubbleRect.left - avatarRect.right, 8);
      expect(avatarRect.bottom, bubbleRect.bottom);
      expect(bubbleRect.right, lessThanOrEqualTo(304));
      expect(find.text('Trao đổi về đơn dịch vụ'), findsNothing);
      expect(find.byTooltip('Gọi điện'), findsNothing);
      expect(find.byIcon(Icons.phone_outlined), findsNothing);
      await tester.enterText(
        find.byType(TextField),
        'Cảm ơn anh, hẹn gặp anh.',
      );
      await tester.pump();
      expect(repository.messageLoads, 1);
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pumpAndSettle();
      expect(repository.sent, ['Cảm ơn anh, hẹn gặp anh.']);
      expect(find.text('Cảm ơn anh, hẹn gặp anh.'), findsOneWidget);
      expect(find.byIcon(Icons.person_outline), findsOneWidget);

      repository.activeOrder = false;
      await tester.pump(const Duration(seconds: 15));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      expect(find.byTooltip('Đính kèm'), findsNothing);
      expect(find.byIcon(Icons.send_rounded), findsNothing);
      expect(find.text(greeting), findsOneWidget);

      repository.activeOrder = true;
      await tester.pump(const Duration(seconds: 15));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      expect(repository.messageLoads, 2);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Có thể tải lại hội thoại và gửi tin nhắn đầu tiên', (
    tester,
  ) async {
    final repository = await _showChat(tester, failLoading: true);
    expect(find.text('Không thể tải tin nhắn.'), findsOneWidget);
    repository
      ..failLoading = false
      ..hasGreeting = false;
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(
      find.text('Chưa có tin nhắn. Hãy gửi lời chào để bắt đầu.'),
      findsOneWidget,
    );
    expect(find.byTooltip('Tùy chọn'), findsNothing);
    expect(find.byTooltip('Đính kèm'), findsNothing);

    await tester.enterText(find.byType(TextField), 'Chào anh!');
    await tester.pump();
    await tester.tap(find.byTooltip('Gửi tin nhắn'));
    await tester.pumpAndSettle();
    expect(find.text('Chào anh!'), findsOneWidget);
    expect(repository.messageLoads, 3);
    expect(tester.takeException(), isNull);
  });
}
