import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/provider/presentation/quotation_voice_sheet.dart';

const _channel = MethodChannel('plugin.csdcorp.com/speech_to_text');

void _emit(WidgetTester tester, String method, dynamic data) {
  tester.binding.channelBuffers.push(
    _channel.name,
    const StandardMethodCodec().encodeMethodCall(MethodCall(method, data)),
    (_) {},
  );
}

void main() {
  testWidgets(
    'Micro báo giá yêu cầu tiếng Việt và giữ nguyên câu trước khi xác nhận',
    (tester) async {
      Map<dynamic, dynamic>? options;
      String? submitted;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_channel, (
        call,
      ) async {
        if (call.method == 'initialize') return true;
        if (call.method == 'listen') {
          options = call.arguments as Map;
          return true;
        }
        return null;
      });
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          _channel,
          null,
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () async {
                  submitted = await showModalBottomSheet<String>(
                    context: context,
                    isScrollControlled: true,
                    builder: (_) => const QuotationVoiceSheet(),
                  );
                },
                child: const Text('Mở báo giá'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Mở báo giá'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Bắt đầu ghi âm'));
      await tester.pumpAndSettle();
      expect(options?['localeId'], 'vi-VN');
      expect(options?['listenMode'], ListenMode.dictation.index);
      _emit(tester, 'notifyStatus', 'listening');
      _emit(
        tester,
        'textRecognition',
        jsonEncode({
          'alternates': [
            {'recognizedWords': 'thay dây điện giá 200k', 'confidence': 1.0},
          ],
          'resultType': 2,
        }),
      );
      await tester.pump();
      expect(
        tester
            .widget<TextField>(
              find.widgetWithText(TextField, 'Nội dung báo giá'),
            )
            .controller!
            .text,
        'thay dây điện giá 200k',
      );
      expect(submitted, isNull);
      await tester.tap(find.text('Điền vào báo giá'));
      await tester.pumpAndSettle();
      expect(submitted, 'thay dây điện giá 200k');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Mở micro lần sau vẫn báo đúng lỗi thiếu hỗ trợ tiếng Việt', (
    tester,
  ) async {
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(_channel, (
      call,
    ) async {
      return call.method == 'initialize' || call.method == 'listen'
          ? true
          : null;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        _channel,
        null,
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(body: QuotationVoiceSheet()),
      ),
    );
    await tester.tap(find.text('Bắt đầu ghi âm'));
    await tester.pumpAndSettle();
    _emit(
      tester,
      'notifyError',
      jsonEncode({
        'errorMsg': 'error_language_not_supported',
        'permanent': true,
      }),
    );
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Thiết bị chưa nhận dạng được tiếng Việt'),
      findsOneWidget,
    );
    expect(find.text('Bắt đầu ghi âm'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Điền vào báo giá'),
          )
          .onPressed,
      isNull,
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
