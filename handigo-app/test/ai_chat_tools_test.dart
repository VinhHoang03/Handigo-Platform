import 'dart:convert';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/ai_chat/data/ai_chat_repository.dart';
import 'package:handigo_app/features/ai_chat/presentation/ai_chat_controller.dart';
import 'package:handigo_app/features/ai_chat/presentation/ai_chat_sheet.dart';

class _Repository extends AiChatRepository {
  _Repository(super.api);
  bool failSend = false, failHistory = false;
  final requests = <Map<String, dynamic>>[];
  @override
  Future<Map<String, dynamic>?> latest() async => null;
  @override
  Future<Map<String, dynamic>> send(Map<String, dynamic> request) async {
    requests.add(request);
    if (failSend) {
      failSend = false;
      throw const ApiException('Mất kết nối');
    }
    return {
      'sessionId': request['sessionId'],
      'messages': [
        {'sender': 'user', 'content': request['message']},
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> history(int page) async {
    if (failHistory) {
      failHistory = false;
      throw const ApiException('Không thể tải lịch sử.');
    }
    return {
      'items': [
        {
          'sessionId': 'saved-$page',
          'title': 'Yêu cầu vệ sinh $page',
          'updatedAt': '2026-10-22T08:00:00Z',
        },
      ],
      'pagination': {'page': page, 'totalPages': 2},
    };
  }

  @override
  Future<Map<String, dynamic>> getSession(String id) async => {
    'sessionId': id,
    'messages': [
      {'sender': 'assistant', 'content': 'Nội dung cuộc trò chuyện đã lưu'},
    ],
  };
}

_Repository _repository() {
  final api = ApiClient(Dio(), CookieJar());
  addTearDown(api.close);
  return _Repository(api);
}

Future<void> _show(WidgetTester tester, _Repository repository) async {
  FlutterSecureStorage.setMockInitialValues({});
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 800);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        aiChatControllerProvider.overrideWith(
          (ref) => AiChatController(repository),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(body: AiChatSheet()),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'Nút tác vụ ở tiêu đề, nút nhập chỉ xuống hàng khi focus và giữ nội dung',
    (tester) async {
      await _show(tester, _repository());
      final field = find.byType(TextField);
      final send = find.byTooltip('Gửi tin nhắn');
      expect(
        tester.getCenter(find.byTooltip('Tác vụ mới')).dy,
        tester.getCenter(find.byTooltip('Lịch sử trò chuyện')).dy,
      );
      expect(tester.getCenter(send).dy, tester.getCenter(field).dy);
      await tester.tap(field);
      await tester.pumpAndSettle();
      expect(
        tester.getCenter(send).dy,
        greaterThan(tester.getBottomLeft(field).dy),
      );
      await tester.enterText(field, 'Giữ nội dung đang nhập');
      await tester.pump();
      await tester.tap(find.text('Trợ lý Handigo'));
      await tester.pumpAndSettle();
      expect(tester.getCenter(send).dy, tester.getCenter(field).dy);
      expect(
        tester.widget<TextField>(field).controller!.text,
        'Giữ nội dung đang nhập',
      );
      expect(tester.takeException(), isNull);
    },
  );
  test(
    'Upload ảnh AI đúng phiên, xác thực và trường multipart; chặn file không hợp lệ',
    () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
      final api = ApiClient(dio, CookieJar());
      addTearDown(api.close);
      api.setToken('test-token');
      final repository = AiChatRepository(api);
      var uploads = 0;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            uploads++;
            expect(request.path, '/ai/sessions/current/attachments');
            expect(request.headers['Authorization'], 'Bearer test-token');
            expect((request.data as FormData).files.single.key, 'image');
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'data': {'url': 'https://example.test/anh.png'},
                },
              ),
            );
          },
        ),
      );
      await expectLater(
        repository.uploadAttachment(
          'current',
          XFile.fromData(
            Uint8List(5 * 1024 * 1024 + 1),
            name: 'anh.png',
            mimeType: 'image/png',
          ),
        ),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        repository.uploadAttachment(
          'current',
          XFile.fromData(Uint8List(1), name: 'tep.txt', mimeType: 'text/plain'),
        ),
        throwsA(isA<ApiException>()),
      );
      expect(uploads, 0);
      expect(
        await repository.uploadAttachment(
          'current',
          XFile.fromData(
            Uint8List.fromList([137, 80, 78, 71]),
            name: 'anh.png',
            mimeType: 'image/png',
          ),
        ),
        'https://example.test/anh.png',
      );
      expect(uploads, 1);
    },
  );

  test(
    'Thử lại giữ ảnh và mã yêu cầu, không đổi phiên khi còn yêu cầu lỗi',
    () async {
      final repository = _repository();
      final controller = AiChatController(repository);
      addTearDown(controller.dispose);
      await Future<void>.delayed(Duration.zero);
      final images = ['https://example.test/anh.png'];
      repository.failSend = true;
      await controller.send('Ảnh hiện trạng', attachments: images);
      images.clear();
      expect(await controller.selectSession('saved-1'), isFalse);
      await controller.retry();
      expect(repository.requests.last['customerAttachments'], [
        'https://example.test/anh.png',
      ]);
      expect(
        repository.requests.first['requestId'],
        repository.requests.last['requestId'],
      );
      expect(await controller.selectSession('saved-1'), isTrue);
      expect(controller.sessionId, 'saved-1');
    },
  );

  testWidgets(
    'Mở lịch sử, tải lại lỗi, đổi trang và tiếp tục cuộc trò chuyện',
    (tester) async {
      final repository = _repository()..failHistory = true;
      await _show(tester, repository);
      expect(find.byTooltip('Đính kèm ảnh hiện trạng'), findsOneWidget);
      expect(find.byTooltip('Nhập bằng giọng nói'), findsOneWidget);
      final upload = tester.getCenter(
        find.byTooltip('Đính kèm ảnh hiện trạng'),
      );
      expect(tester.getCenter(find.byTooltip('Gửi tin nhắn')).dy, upload.dy);
      expect(
        tester.getCenter(find.byTooltip('Nhập bằng giọng nói')).dy,
        upload.dy,
      );
      await tester.tap(find.byTooltip('Lịch sử trò chuyện'));
      await tester.pumpAndSettle();
      expect(find.text('Không thể tải lịch sử.'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(find.text('Yêu cầu vệ sinh 1'), findsOneWidget);
      await tester.tap(find.byTooltip('Trang sau'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yêu cầu vệ sinh 2'));
      await tester.pumpAndSettle();
      expect(find.text('Nội dung cuộc trò chuyện đã lưu'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Tiếp tục');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi tin nhắn'));
      await tester.pumpAndSettle();
      expect(repository.requests.single['sessionId'], 'saved-2');
      expect(tester.takeException(), isNull);
    },
  );

  const voiceChannel = MethodChannel('plugin.csdcorp.com/speech_to_text');
  testWidgets('Từ chối quyền micro vẫn nhập được bằng bàn phím', (
    tester,
  ) async {
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      voiceChannel,
      (call) async => false,
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        voiceChannel,
        null,
      ),
    );
    await _show(tester, _repository());
    await tester.tap(find.byTooltip('Nhập bằng giọng nói'));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Vui lòng cấp quyền micro và nhận dạng giọng nói để sử dụng tính năng này.',
      ),
      findsOneWidget,
    );
    expect(tester.widget<TextField>(find.byType(TextField)).readOnly, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Giọng nói điền vào ô nhập, chỉ gửi sau khi bấm Gửi', (
    tester,
  ) async {
    final repository = _repository();
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      voiceChannel,
      (call) async {
        if (call.method == 'initialize' || call.method == 'listen') return true;
        if (call.method == 'locales') return ['vi_VN:Tiếng Việt'];
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        voiceChannel,
        null,
      ),
    );
    await _show(tester, repository);
    await tester.tap(find.byTooltip('Nhập bằng giọng nói'));
    await tester.pumpAndSettle();
    tester.binding.channelBuffers.push(
      voiceChannel.name,
      const StandardMethodCodec().encodeMethodCall(
        MethodCall(
          'textRecognition',
          jsonEncode({
            'alternates': [
              {
                'recognizedWords': 'Tôi cần vệ sinh máy lạnh',
                'confidence': 1.0,
              },
            ],
            'resultType': 0,
          }),
        ),
      ),
      (_) {},
    );
    await tester.pump();
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      'Tôi cần vệ sinh máy lạnh',
    );
    expect(repository.requests, isEmpty);
    await tester.tap(find.byTooltip('Dừng nhập giọng nói'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Gửi tin nhắn'));
    await tester.pumpAndSettle();
    expect(repository.requests.single['message'], 'Tôi cần vệ sinh máy lạnh');
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
