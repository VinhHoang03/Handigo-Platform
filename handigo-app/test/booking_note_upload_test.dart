import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
// Dùng giao diện nền tảng có sẵn của ImagePicker để giả lập bộ chọn ảnh.
// ignore: depend_on_referenced_packages
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart'
    as picker;
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/service_catalog/data/service_catalog_repository.dart';
import 'package:handigo_app/features/service_catalog/presentation/booking_note_input.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';

class _Picker extends picker.ImagePickerPlatform {
  picker.ImagePickerOptions? options;
  int calls = 0;
  @override
  Future<XFile?> getImageFromSource({
    required picker.ImageSource source,
    picker.ImagePickerOptions options = const picker.ImagePickerOptions(),
  }) async {
    calls++;
    this.options = options;
    return XFile.fromData(
      base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      ),
      name: 'anh.png',
      mimeType: 'image/png',
    );
  }
}

class _Repository implements ServiceCatalogRepository {
  Completer<String> result = Completer<String>();
  void Function(int sent, int total)? progress;
  int calls = 0;
  @override
  Future<String> uploadAttachment(
    XFile file, {
    void Function(int sent, int total)? onSendProgress,
  }) {
    calls++;
    progress = onSendProgress;
    return result.future;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets(
    'Xem trước ảnh, tiến trình, thử lại và bỏ ảnh chưa được chấp nhận',
    (tester) async {
      final previousPicker = picker.ImagePickerPlatform.instance;
      final imagePicker = _Picker();
      picker.ImagePickerPlatform.instance = imagePicker;
      addTearDown(() => picker.ImagePickerPlatform.instance = previousPicker);
      final repository = _Repository();
      final container = ProviderContainer(
        overrides: [
          serviceCatalogRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      final uploading = <bool>[];
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Scaffold(
              body: BookingNoteInput(
                controller: controller,
                onUploadingChanged: uploading.add,
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.byTooltip('Thêm ảnh sự cố (0/4)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chọn từ thư viện'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(imagePicker.options?.maxWidth, 1280);
      expect(imagePicker.options?.maxHeight, 1280);
      expect(imagePicker.options?.imageQuality, 80);
      expect(find.byType(Image), findsOneWidget);
      expect(find.text('Đang tải ảnh…'), findsOneWidget);
      expect(container.read(bookingDraftProvider).attachments, isEmpty);
      repository.progress!(1, 2);
      await tester.pump();
      expect(find.text('Đang tải ảnh 50%'), findsOneWidget);
      repository.progress!(2, 2);
      await tester.pump();
      expect(find.text('Đang kiểm tra và lưu ảnh…'), findsOneWidget);
      repository.result.completeError(const ApiException('Ảnh không phù hợp.'));
      await tester.pumpAndSettle();
      expect(find.text('Ảnh không phù hợp.'), findsOneWidget);
      expect(container.read(bookingDraftProvider).attachments, isEmpty);
      expect(uploading, [true, false]);
      repository.result = Completer<String>();
      expect(find.text('Thử lại'), findsNothing);
      expect(find.text('Bỏ ảnh'), findsNothing);
      await tester.tap(find.byTooltip('Thử lại tải ảnh'));
      await tester.pump();
      expect(repository.calls, 2);
      expect(imagePicker.calls, 1);
      repository.result.completeError(const ApiException('Mất kết nối.'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Bỏ ảnh chưa tải'));
      await tester.pumpAndSettle();
      expect(find.byType(Image), findsNothing);
      expect(find.text('Mất kết nối.'), findsNothing);
      expect(container.read(bookingDraftProvider).attachments, isEmpty);
      repository.result = Completer<String>();
      await tester.tap(find.byTooltip('Thêm ảnh sự cố (0/4)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chọn từ thư viện'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      repository.result.complete('https://example.com/anh.png');
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).attachments, [
        'https://example.com/anh.png',
      ]);
      expect(find.text('Đang tải ảnh…'), findsNothing);
      await tester.tap(find.byTooltip('Xóa ảnh sự cố 1'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).attachments, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
}
