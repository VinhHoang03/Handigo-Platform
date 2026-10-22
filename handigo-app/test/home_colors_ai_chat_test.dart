import 'dart:io';
import 'dart:ui' as ui;
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/ai_chat/data/ai_chat_repository.dart';
import 'package:handigo_app/features/ai_chat/presentation/ai_chat_controller.dart';
import 'package:handigo_app/features/ai_chat/presentation/ai_chat_sheet.dart';
import 'package:handigo_app/features/home/domain/customer_home_data.dart';
import 'package:handigo_app/features/home/presentation/customer_shell.dart';
import 'package:handigo_app/features/services/domain/service_category.dart';

class _AiRepository extends AiChatRepository {
  _AiRepository() : super(ApiClient(Dio(), CookieJar()));
  final requests = <Map<String, dynamic>>[];
  bool failNext = false;
  @override
  Future<Map<String, dynamic>?> latest() async => null;
  @override
  Future<Map<String, dynamic>> reset(String sessionId) async => {
    'sessionId': sessionId,
    'messages': <Map<String, dynamic>>[],
  };
  @override
  Future<Map<String, dynamic>> send(Map<String, dynamic> request) async {
    requests.add(Map.of(request));
    if (failNext) {
      failNext = false;
      throw const ApiException('Mất kết nối');
    }
    return {
      'sessionId': request['sessionId'],
      'messages': [
        {'sender': 'user', 'content': request['message']},
        {'sender': 'assistant', 'content': 'Tôi có thể giúp bạn tìm dịch vụ.'},
      ],
    };
  }
}

void main() {
  for (final theme in [AppTheme.light, AppTheme.dark]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets(
        'Chat giống web: gợi ý và tác vụ mới, ${theme.brightness.name}, chữ $scale',
        (tester) async {
          FlutterSecureStorage.setMockInitialValues({});
          tester.view.devicePixelRatio = 1;
          tester.view.physicalSize = const Size(390, 844);
          addTearDown(tester.view.resetDevicePixelRatio);
          addTearDown(tester.view.resetPhysicalSize);
          final repository = _AiRepository();
          final previewKey = GlobalKey();
          await tester.pumpWidget(
            ProviderScope(
              overrides: [
                aiChatControllerProvider.overrideWith(
                  (ref) => AiChatController(repository),
                ),
              ],
              child: RepaintBoundary(
                key: previewKey,
                child: MaterialApp(
                  theme: theme,
                  builder: (context, child) => MediaQuery(
                    data: MediaQuery.of(
                      context,
                    ).copyWith(textScaler: TextScaler.linear(scale)),
                    child: child!,
                  ),
                  home: Scaffold(
                    body: Builder(
                      builder: (context) => TextButton(
                        onPressed: () => showAiChatSheet(context),
                        child: const Text('Mở AI'),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
          await tester.tap(find.text('Mở AI'));
          await tester.pumpAndSettle();
          expect(find.text('Bạn cần giúp gì cho ngôi nhà?'), findsOneWidget);
          expect(tester.takeException(), isNull);
          Future<void> save(String name) async {
            if (!const bool.fromEnvironment('AI_CHAT_PREVIEW') ||
                scale != 1 ||
                theme.brightness != Brightness.light) {
              return;
            }
            final boundary =
                previewKey.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary;
            boundary.markNeedsPaint();
            await tester.pump();
            await tester.runAsync(() async {
              final image = await boundary.toImage(pixelRatio: 2);
              final bytes = await image.toByteData(
                format: ui.ImageByteFormat.png,
              );
              await File(
                '.dart_tool/ai-chat-$name.png',
              ).writeAsBytes(bytes!.buffer.asUint8List());
              image.dispose();
            });
          }

          await save('welcome');
          await tester.ensureVisible(find.text('Tìm dịch vụ phù hợp'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Tìm dịch vụ phù hợp'));
          await tester.pumpAndSettle();
          expect(
            repository.requests.single['message'],
            'Giúp tôi chọn dịch vụ tại nhà.',
          );
          expect(find.text('Tôi có thể giúp bạn tìm dịch vụ.'), findsOneWidget);
          expect(find.text('Bạn'), findsOneWidget);
          expect(tester.takeException(), isNull);
          await save('conversation');
          await tester.tap(find.byTooltip('Tác vụ mới'));
          await tester.pumpAndSettle();
          expect(find.text('Bạn cần giúp gì cho ngôi nhà?'), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
  testWidgets('Icon trang chủ dùng màu danh mục từ API', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    final category = ServiceCategory.fromJson({
      '_id': 'category-1',
      'name': 'Điện',
      'slug': 'dien',
      'icon': 'lucide:bolt',
      'iconColor': '#00687a',
    });
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: CustomerHomeContent(
              data: CustomerHomeData(
                categories: [category],
                services: const [],
                providers: const [],
                unreadNotificationCount: 0,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final icon = tester.widget<Icon>(
      find.byIcon(Icons.electrical_services_outlined),
    );
    expect(icon.color, const Color(0xff00687a));
    expect(tester.takeException(), isNull);
  });

  test(
    'Thử lại yêu cầu AI giữ nguyên mã để không tạo thao tác trùng',
    () async {
      final repository = _AiRepository();
      final controller = AiChatController(repository);
      addTearDown(controller.dispose);
      await Future<void>.delayed(Duration.zero);
      repository.failNext = true;
      await controller.send('Tìm dịch vụ vệ sinh');
      expect(controller.error, 'Mất kết nối');
      expect(controller.canSend, isFalse);
      await controller.send('Không được gửi thêm khi chưa xử lý lỗi');
      expect(repository.requests, hasLength(1));
      await controller.retry();
      expect(repository.requests, hasLength(2));
      expect(repository.requests[1], repository.requests[0]);
      expect(controller.error, isNull);
      expect(controller.messages.last['sender'], 'assistant');
    },
  );

  for (final theme in [AppTheme.light, AppTheme.dark]) {
    testWidgets(
      'Chat AI gửi được tin và không tràn khi mở bàn phím (${theme.brightness.name})',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(360, 640);
        tester.view.viewInsets = const FakeViewPadding(bottom: 260);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetViewInsets);
        final repository = _AiRepository();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              aiChatControllerProvider.overrideWith(
                (ref) => AiChatController(repository),
              ),
            ],
            child: MaterialApp(
              theme: theme,
              home: Scaffold(
                body: Builder(
                  builder: (context) => Center(
                    child: TextButton(
                      onPressed: () => showAiChatSheet(context),
                      child: const Text('Mở AI'),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Mở AI'));
        await tester.pumpAndSettle();
        expect(find.text('Trợ lý Handigo'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.enterText(find.byType(TextField), 'Tìm dịch vụ vệ sinh');
        await tester.pump();
        await tester.tap(find.byTooltip('Gửi tin nhắn'));
        await tester.pumpAndSettle();
        expect(find.text('Tôi có thể giúp bạn tìm dịch vụ.'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
