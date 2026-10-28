import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
// Tái sử dụng giao diện kiểm thử do image_picker đã cung cấp, không thêm dependency.
// ignore: depend_on_referenced_packages
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart'
    as picker;
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/provider/data/provider_repository.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_detail_screen.dart';
import 'package:handigo_app/features/provider/presentation/quotation_editor_screen.dart';

const order = OrderDetail(
  id: 'order',
  code: 'ORD-1',
  serviceName: 'Sửa điều hòa',
  status: 'accepted',
  paymentStatus: 'partially_paid',
  paymentMethod: 'cash',
  inspectionRequired: true,
);
const quotation = RepairQuotation(
  id: 'quote',
  revision: 3,
  status: 'saved',
  finalAmount: 360000,
  items: [
    QuotationItem(
      title: 'Thay tụ điện',
      quantity: 2,
      unitPrice: 180000,
      note: 'Giữ ghi chú cũ',
    ),
  ],
);

class _Repository extends ProviderRepository {
  _Repository() : super(ApiClient(Dio(), CookieJar()));
  Map<String, dynamic>? saved, snapshot;
  RepairQuotation? current;
  bool fail = false;
  @override
  Future<void> saveQuotation(
    String id,
    Map<String, dynamic> payload, {
    RepairQuotation? current,
  }) async {
    if (fail) throw const ApiException('Chưa thể lưu báo giá.');
    saved = payload;
    this.current = current;
  }

  @override
  Future<Map<String, dynamic>> assistQuotation(
    String id,
    Map<String, dynamic> data,
  ) async {
    snapshot = data;
    if (fail) throw const ApiException('AI tạm thời chưa sẵn sàng.');
    return {
      'revision': data['revision'],
      'message': 'Đã cập nhật đơn giá.',
      'updates': [
        {
          'rowId': 'row-0',
          'fields': {'unitPrice': 200000},
        },
      ],
      'warnings': <String>[],
    };
  }

  @override
  Future<List<QuotationItem>> scanQuotation(String id, XFile file) async => [
    const QuotationItem(title: 'Vật tư từ ảnh', quantity: 1, unitPrice: 50000),
  ];
}

class _Picker extends picker.ImagePickerPlatform {
  @override
  Future<XFile?> getImageFromSource({
    required picker.ImageSource source,
    picker.ImagePickerOptions options = const picker.ImagePickerOptions(),
  }) async => XFile('quotation.jpg');
}

void main() {
  Future<void> open(
    WidgetTester tester,
    _Repository repository, {
    RepairQuotation? initial = quotation,
    double scale = 1,
    Future<void> Function()? onSaved,
  }) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [providerRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: MediaQuery(
              data: MediaQueryData(
                size: const Size(390, 844),
                textScaler: TextScaler.linear(scale),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: QuotationEditorScreen(
                  order: order,
                  quotation: initial,
                  embedded: true,
                  onSaved: onSaved,
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> voice(WidgetTester tester) async {
    await tap(tester, find.byTooltip('Nhập báo giá bằng giọng nói AI'));
    await tester.enterText(
      find.widgetWithText(TextField, 'Nội dung báo giá'),
      'Đổi đơn giá tụ điện thành 200 nghìn',
    );
    await tester.pump();
    await tap(tester, find.text('Điền vào báo giá'));
  }

  for (final scale in [1.0, 2.0]) {
    testWidgets('Báo giá gọn hiển thị trực tiếp, tag sau tên, chữ $scale', (
      tester,
    ) async {
      await open(tester, _Repository(), scale: scale);
      expect(find.byType(Scaffold), findsOneWidget);
      expect(find.text('Thay tụ điện'), findsOneWidget);
      expect(find.text('Vật tư'), findsOneWidget);
      expect(
        find.textContaining('Số lượng 2 × 180.000 đ = 360.000 đ'),
        findsOneWidget,
      );
      expect(find.byTooltip('Quét ảnh bằng AI'), findsOneWidget);
      expect(find.byTooltip('Nhập báo giá bằng giọng nói AI'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('Thêm thủ công và lưu ngay tại chỗ, không đóng chi tiết đơn', (
    tester,
  ) async {
    final repository = _Repository();
    var saved = 0;
    await open(
      tester,
      repository,
      initial: null,
      onSaved: () async {
        saved++;
      },
    );
    await tap(tester, find.text('Thêm hạng mục báo giá'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Tên hạng mục'),
      'Công sửa chữa',
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Số lượng'), '2');
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Đơn giá (đ)'),
      '100000',
    );
    await tap(tester, find.text('Xác nhận hạng mục'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Công sửa chữa'), findsOneWidget);
    await tap(tester, find.text('Lưu báo giá'));
    expect(saved, 1);
    expect(repository.saved!['items'], [
      containsPair('title', 'Công sửa chữa'),
    ]);
    expect((repository.saved!['items'] as List).single['quantity'], 2);
    expect(find.byType(QuotationEditorScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('AI cập nhật đúng dòng, giữ số lượng, ghi chú và chưa tự lưu', (
    tester,
  ) async {
    final repository = _Repository();
    await open(tester, repository);
    await voice(tester);
    expect(repository.snapshot!['items'], [containsPair('rowId', 'row-0')]);
    expect(
      find.textContaining('Số lượng 2 × 200.000 đ = 400.000 đ'),
      findsOneWidget,
    );
    expect(repository.saved, isNull);
    await tap(tester, find.text('Lưu báo giá'));
    final item = (repository.saved!['items'] as List).single;
    expect(item['note'], 'Giữ ghi chú cũ');
    expect(item['quantity'], 2);
    expect(repository.current!.revision, 3);
    expect(tester.takeException(), isNull);
  });
  testWidgets('AI lỗi giữ nguyên bản nháp và vẫn có thể chỉnh sửa', (
    tester,
  ) async {
    final repository = _Repository()..fail = true;
    await open(tester, repository);
    await voice(tester);
    expect(find.text('AI tạm thời chưa sẵn sàng.'), findsOneWidget);
    expect(
      find.textContaining('Số lượng 2 × 180.000 đ = 360.000 đ'),
      findsOneWidget,
    );
    await tap(tester, find.byTooltip('Xóa hạng mục'));
    expect(find.text('Hạng mục báo giá (0)'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Quét ảnh bổ sung vào hạng mục hiện tại và không tự lưu', (
    tester,
  ) async {
    final previous = picker.ImagePickerPlatform.instance;
    picker.ImagePickerPlatform.instance = _Picker();
    addTearDown(() => picker.ImagePickerPlatform.instance = previous);
    final repository = _Repository();
    await open(tester, repository);
    await tap(tester, find.byTooltip('Quét ảnh bằng AI'));
    expect(find.text('Thay tụ điện'), findsOneWidget);
    expect(find.text('Vật tư từ ảnh'), findsOneWidget);
    expect(find.text('Hạng mục báo giá (2)'), findsOneWidget);
    expect(repository.saved, isNull);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Không lưu báo giá rỗng', (tester) async {
    final repository = _Repository();
    await open(tester, repository, initial: null);
    await tap(tester, find.text('Lưu báo giá'));
    expect(repository.saved, isNull);
    expect(
      find.text('Vui lòng thêm ít nhất một hạng mục báo giá.'),
      findsOneWidget,
    );
  });
  testWidgets('Chi tiết đơn có sẵn form báo giá khi đủ điều kiện', (
    tester,
  ) async {
    final repository = _Repository();
    final detail = OrderDetail(
      id: 'order',
      code: 'ORD-1',
      serviceName: 'Sửa điều hòa',
      status: 'accepted',
      paymentStatus: 'partially_paid',
      paymentMethod: 'cash',
      inspectionRequired: true,
      depositPaidAt: DateTime(2026, 10, 23),
      depositAmount: 50000,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          providerRepositoryProvider.overrideWithValue(repository),
          orderDetailProvider.overrideWith((ref, id) async => detail),
          orderQuotationProvider.overrideWith((ref, id) async => quotation),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const ProviderOrderDetailScreen(orderId: 'order'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byTooltip('Quét ảnh bằng AI'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.byType(QuotationEditorScreen), findsOneWidget);
    expect(find.text('Lập báo giá sửa chữa'), findsNothing);
    expect(find.text('Chỉnh sửa báo giá'), findsNothing);
    expect(find.text('Hạng mục báo giá (1)'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
