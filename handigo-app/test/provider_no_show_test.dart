import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
// Tái sử dụng giao diện kiểm thử có sẵn của image_picker.
// ignore: depend_on_referenced_packages
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart'
    as picker;
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/provider/presentation/provider_no_show_screen.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_detail_screen.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  bool eligible = true, failContact = false;
  String? reportStatus;
  int checks = 0, reports = 0;
  final uploads = <String>[];
  Map<String, dynamic>? payload;
  Completer<void>? pending;
  Map<String, dynamic> get order => {
    'id': 'order',
    'orderCode': 'HD-001',
    'status': reportStatus == 'approved' ? 'cancelled' : 'accepted',
    'paymentMethod': 'cash',
    'paymentStatus': 'unpaid',
    'orderType': 'immediate',
    'providerId': {'_id': 'provider'},
    'arrival': {'providerId': 'provider', 'arrivedAt': '2026-11-03T00:00:00Z'},
    'serviceId': {'name': 'Vệ sinh máy lạnh', 'serviceType': 'fixed_price'},
    if (reportStatus != null) 'customerNoShow': {'status': reportStatus},
  };
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(authenticated, isTrue);
    if (path.endsWith('/eligibility')) {
      expect(path, '/orders/order/customer-no-show/eligibility');
      checks++;
      if (!eligible) throw const ApiException('Cần chờ thêm sau khi đến nơi.');
      return {
        'data': {'eligible': true, 'compensationAmount': 5000},
      };
    }
    if (path == '/orders/order/customer-no-show') {
      expect(method, 'POST');
      expect(receiveTimeout, const Duration(seconds: 85));
      reports++;
      payload = data;
      await pending?.future;
      reportStatus = 'pending';
      return {'data': order};
    }
    expect(path, '/orders/order');
    return {'data': order};
  }

  @override
  Future<dynamic> uploadImages(
    String path,
    List<XFile> files, {
    String field = 'images',
    Map<String, String> data = const {},
    Duration? receiveTimeout,
  }) async {
    expect(path, '/orders/order/customer-no-show/evidence');
    expect(field, 'image');
    expect(files.length, 1);
    expect(receiveTimeout, const Duration(seconds: 85));
    final kind = data['kind']!;
    uploads.add(kind);
    if (kind == 'contact' && failContact) {
      throw const ApiException('Ảnh liên hệ chưa tải được.');
    }
    return {
      'id': uploads.length.toString().padLeft(24, '0'),
      'kind': kind,
      'url': 'https://example.test/image.png',
    };
  }
}

class _Picker extends picker.ImagePickerPlatform {
  final images = <XFile>[];
  @override
  Future<XFile?> getImageFromSource({
    required picker.ImageSource source,
    picker.ImagePickerOptions options = const picker.ImagePickerOptions(),
  }) async => images.removeAt(0);
}

class _LargeImage extends XFile {
  _LargeImage() : super('anh-qua-lon.png');
  @override
  Future<int> length() async => 6 * 1024 * 1024;
}

XFile _image(int seed, {String mime = 'image/png'}) => XFile.fromData(
  Uint8List.fromList([
    ...base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ),
    seed,
  ]),
  name: 'bang-chung-$seed.png',
  mimeType: mime,
);

class _Harness {
  final api = _Api();
  final pickerStub = _Picker();
  bool? sent;
  Future<void> show(
    WidgetTester tester, {
    bool detail = false,
    double scale = 1,
  }) async {
    final previous = picker.ImagePickerPlatform.instance;
    picker.ImagePickerPlatform.instance = pickerStub;
    addTearDown(() => picker.ImagePickerPlatform.instance = previous);
    addTearDown(api.close);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          authControllerProvider.overrideWith(
            (ref) => AuthController(AuthRepository(api), api)
              ..user = const AppUser(
                id: 'user',
                fullName: 'Nguyễn An',
                email: 'an@example.test',
                role: UserRole.provider,
                providerOnboardingStatus: 'APPROVED',
              )
              ..status = AuthStatus.authenticated,
          ),
          orderQuotationProvider('order').overrideWith((ref) async => null),
        ],
        child: MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child!,
          ),
          home: detail
              ? const ProviderOrderDetailScreen(orderId: 'order')
              : Builder(
                  builder: (context) => Scaffold(
                    body: TextButton(
                      onPressed: () async {
                        sent = await Navigator.push<bool>(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                const ProviderNoShowScreen(orderId: 'order'),
                          ),
                        );
                      },
                      child: const Text('Mở báo cáo'),
                    ),
                  ),
                ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    if (!detail) await tap(tester, find.text('Mở báo cáo'));
  }

  Future<void> pick(
    WidgetTester tester,
    String kind,
    int seed, {
    String mime = 'image/png',
  }) async {
    pickerStub.images.add(_image(seed, mime: mime));
    await tap(tester, find.byKey(ValueKey('no-show-gallery-$kind')));
  }
}

Future<void> tap(WidgetTester tester, Finder finder) async {
  if (finder.evaluate().isEmpty) {
    await tester.drag(find.byType(ListView).first, const Offset(0, 1600));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      finder,
      180,
      scrollable: find.byType(Scrollable).first,
    );
  }
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'Gửi từ chi tiết đơn cập nhật trạng thái chờ duyệt và khóa bắt đầu',
    (tester) async {
      final h = _Harness();
      await h.show(tester, detail: true);
      await tap(tester, find.text('Không liên hệ được khách'));
      await tester.enterText(
        find.byType(TextFormField),
        'Đã gọi nhiều lần nhưng khách không nghe máy.',
      );
      await h.pick(tester, 'arrival', 1);
      await h.pick(tester, 'contact', 2);
      await tap(tester, find.byType(CheckboxListTile));
      await tap(tester, find.text('Gửi báo cáo'));
      expect(h.api.reports, 1);
      expect(find.byType(ProviderNoShowScreen), findsNothing);
      expect(find.text('Không liên hệ được khách'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Bắt đầu thực hiện'),
            )
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Kiểm tra thời gian chờ trước khi mở form; không tự gửi báo cáo',
    (tester) async {
      final h = _Harness()..api.eligible = false;
      await h.show(tester, detail: true);
      await tap(tester, find.text('Không liên hệ được khách'));
      expect(find.text('Cần chờ thêm sau khi đến nơi.'), findsOneWidget);
      expect(find.byType(ProviderNoShowScreen), findsNothing);
      expect(h.api.reports, 0);
      h.api.eligible = true;
      await tap(tester, find.text('Không liên hệ được khách'));
      expect(find.byType(ProviderNoShowScreen), findsOneWidget);
      expect(h.api.reports, 0);
      await tester.tap(find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Không gửi khi thiếu mô tả, ảnh hoặc xác nhận liên hệ', (
    tester,
  ) async {
    final h = _Harness();
    await h.show(tester, scale: 2);
    await tap(tester, find.text('Gửi báo cáo'));
    expect(find.text('Vui lòng mô tả ít nhất 10 ký tự.'), findsOneWidget);
    await tester.enterText(
      find.byType(TextFormField),
      'Đã gọi nhiều lần nhưng khách không nghe máy.',
    );
    await tap(tester, find.text('Gửi báo cáo'));
    expect(h.api.uploads, isEmpty);
    expect(h.api.reports, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Thử lại giữ ảnh đã tải; gửi đúng hai nhóm và chống gửi lặp', (
    tester,
  ) async {
    final h = _Harness()..api.failContact = true;
    await h.show(tester);
    await tester.enterText(
      find.byType(TextFormField),
      'Đã gọi nhiều lần nhưng khách không nghe máy.',
    );
    await h.pick(tester, 'arrival', 1);
    await h.pick(tester, 'contact', 2);
    await tap(tester, find.byType(CheckboxListTile));
    await tap(tester, find.text('Gửi báo cáo'));
    expect(h.api.uploads, ['arrival', 'contact']);
    expect(h.api.reports, 0);
    h.api.failContact = false;
    h.api.pending = Completer<void>();
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(h.api.uploads, ['arrival', 'contact', 'contact']);
    expect(h.api.reports, 1);
    expect(h.api.payload, {
      'description': 'Đã gọi nhiều lần nhưng khách không nghe máy.',
      'contactedCustomer': true,
      'arrivalEvidenceIds': ['1'.padLeft(24, '0')],
      'contactEvidenceIds': ['3'.padLeft(24, '0')],
    });
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Đang xử lý…'),
          )
          .onPressed,
      isNull,
    );
    h.api.pending!.complete();
    await tester.pumpAndSettle();
    expect(h.sent, isTrue);
    expect(find.text('Mở báo cáo'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Giới hạn 4 ảnh mỗi nhóm và 5 ảnh tổng cộng; từ chối ảnh trùng hoặc sai loại',
    (tester) async {
      final h = _Harness();
      await h.show(tester);
      await h.pick(tester, 'arrival', 1);
      await h.pick(tester, 'contact', 1);
      expect(
        find.text('Ảnh này đã được chọn. Vui lòng chọn ảnh khác.'),
        findsOneWidget,
      );
      await h.pick(tester, 'contact', 2, mime: 'application/pdf');
      expect(
        find.text('Vui lòng chọn ảnh JPG, PNG hoặc WebP.'),
        findsOneWidget,
      );
      h.pickerStub.images.add(_LargeImage());
      await tap(tester, find.byKey(const ValueKey('no-show-gallery-contact')));
      expect(find.text('Mỗi ảnh không được vượt quá 5 MB.'), findsOneWidget);
      for (var index = 2; index <= 4; index++) {
        await h.pick(tester, 'arrival', index);
      }
      expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const ValueKey('no-show-gallery-arrival')),
            )
            .onPressed,
        isNull,
      );
      await h.pick(tester, 'contact', 5);
      expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const ValueKey('no-show-gallery-contact')),
            )
            .onPressed,
        isNull,
      );
      expect(h.api.uploads, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  for (final status in ['pending', 'approved', 'rejected']) {
    testWidgets(
      'Trạng thái báo cáo $status lấy từ server và không cho gửi lại',
      (tester) async {
        final h = _Harness()..api.reportStatus = status;
        await h.show(tester, detail: true);
        expect(find.text('Không liên hệ được khách'), findsNothing);
        final start = find.widgetWithText(FilledButton, 'Bắt đầu thực hiện');
        if (status == 'pending') {
          expect(tester.widget<FilledButton>(start).onPressed, isNull);
        }
        if (status == 'rejected') {
          expect(tester.widget<FilledButton>(start).onPressed, isNotNull);
        }
        if (status == 'approved') expect(start, findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  test(
    'Báo cáo chờ duyệt khóa báo giá và bắt đầu dù dữ liệu thanh toán hợp lệ',
    () {
      final order = OrderDetail.fromJson({
        'id': 'order',
        'status': 'accepted',
        'inspectionRequired': true,
        'paymentMethod': 'cash',
        'depositPaidAt': '2026-11-03T00:00:00Z',
        'customerNoShow': {'status': 'pending'},
      });
      expect(order.canEditQuotation, isFalse);
      expect(
        order.canStart(
          const RepairQuotation(id: 'q', status: 'saved', finalAmount: 100000),
        ),
        isFalse,
      );
    },
  );
}
