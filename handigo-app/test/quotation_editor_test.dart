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
      for (final label in [
        'Thời lượng sửa chữa (phút)',
        'Giảm giá (đ)',
        'Ghi chú khảo sát',
        'Đề xuất xử lý',
      ]) {
        expect(find.text(label), findsNothing);
      }
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
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) =>
                  widget is IconButton && widget.tooltip == 'Giảm số lượng',
            ),
          )
          .onPressed,
      isNull,
    );
    await tap(tester, find.byTooltip('Tăng số lượng'));
    await tap(tester, find.byTooltip('Tăng số lượng'));
    await tap(tester, find.byTooltip('Giảm số lượng'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Đơn giá (đ)'),
      '100000',
    );
    await tester.pump();
    expect(find.text('200.000 đ'), findsOneWidget);
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
  testWidgets('Số lượng giới hạn 1–1000 và đóng form giữ hạng mục cũ', (
    tester,
  ) async {
    await open(tester, _Repository(), scale: 2);
    await tap(tester, find.text('Thay tụ điện'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Số lượng'),
      '1000',
    );
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) =>
                  widget is IconButton && widget.tooltip == 'Tăng số lượng',
            ),
          )
          .onPressed,
      isNull,
    );
    await tap(tester, find.byTooltip('Giảm số lượng'));
    expect(
      tester
          .widget<TextFormField>(find.widgetWithText(TextFormField, 'Số lượng'))
          .controller!
          .text,
      '999',
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Số lượng'), '0');
    await tap(tester, find.text('Xác nhận hạng mục'));
    expect(find.text('Nhập số nguyên từ 1 đến 1000.'), findsOneWidget);
    await tap(tester, find.byTooltip('Đóng form hạng mục'));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 400));
    expect(
      find.textContaining('Số lượng 2 × 180.000 đ = 360.000 đ'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets('Nhập số hạng mục tạo ba phần riêng và lưu đúng từng dòng', (
    tester,
  ) async {
    final repository = _Repository();
    await open(tester, repository, initial: null);
    await tap(tester, find.text('Thêm hạng mục báo giá'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Số hạng mục báo giá'),
      '3',
    );
    await tester.pumpAndSettle();
    expect(
      find.widgetWithText(TextFormField, 'Tên hạng mục'),
      findsNWidgets(3),
    );
    expect(find.text('Hạng mục 3'), findsOneWidget);
    await tap(tester, find.text('Xác nhận 3 hạng mục'));
    expect(find.text('Nhập tên hạng mục.'), findsNWidgets(3));
    expect(repository.saved, isNull);
    const titles = ['Thay gas', 'Thay vỏ', 'Dây điện'];
    for (var i = 0; i < titles.length; i++) {
      for (final entry in [
        ('Tên hạng mục', titles[i]),
        ('Số lượng', '${i + 1}'),
        ('Đơn giá (đ)', '${(i + 1) * 100000}'),
      ]) {
        final field = find.widgetWithText(TextFormField, entry.$1).at(i);
        await tester.ensureVisible(field);
        await tester.enterText(field, entry.$2);
        await tester.pumpAndSettle();
      }
    }
    await tap(tester, find.text('Xác nhận 3 hạng mục'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Hạng mục báo giá (3)'), findsOneWidget);
    await tap(tester, find.text('Lưu báo giá'));
    final savedItems = repository.saved!['items'] as List;
    expect(savedItems.map((item) => item['title']), titles);
    expect(savedItems.map((item) => item['quantity']), [1, 2, 3]);
    expect(savedItems.map((item) => item['unitPrice']), [
      100000,
      200000,
      300000,
    ]);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Đổi số phần giữ bản nháp và hủy không thêm hạng mục', (
    tester,
  ) async {
    await open(tester, _Repository());
    await tap(tester, find.text('Thêm hạng mục báo giá'));
    final count = find.widgetWithText(TextFormField, 'Số hạng mục báo giá');
    await tester.enterText(count, '3');
    await tester.pumpAndSettle();
    final thirdTitle = find.widgetWithText(TextFormField, 'Tên hạng mục').at(2);
    await tester.ensureVisible(thirdTitle);
    await tester.enterText(thirdTitle, 'Dây điện');
    await tester.ensureVisible(count);
    await tester.enterText(count, '2');
    await tester.pumpAndSettle();
    expect(
      find.widgetWithText(TextFormField, 'Tên hạng mục'),
      findsNWidgets(2),
    );
    await tester.enterText(count, '3');
    await tester.pumpAndSettle();
    expect(find.text('Dây điện'), findsOneWidget);
    await tester.enterText(count, '100');
    await tester.pumpAndSettle();
    expect(find.text('Nhập số nguyên từ 1 đến 99.'), findsOneWidget);
    await tap(tester, find.byTooltip('Đóng form hạng mục'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Hạng mục báo giá (1)'), findsOneWidget);
    expect(find.text('Thay tụ điện'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'Báo giá cập nhật từ xa giữ bản nháp và phiên bản lúc bắt đầu sửa',
    (tester) async {
      final repository = _Repository();
      await open(tester, repository);
      await voice(tester);
      await open(
        tester,
        repository,
        initial: const RepairQuotation(
          id: 'quote',
          revision: 4,
          status: 'saved',
          finalAmount: 500000,
          items: [
            QuotationItem(
              title: 'Vật tư từ thiết bị khác',
              quantity: 1,
              unitPrice: 500000,
            ),
          ],
        ),
      );
      expect(find.text('Vật tư từ thiết bị khác'), findsNothing);
      expect(
        find.textContaining('Số lượng 2 × 200.000 đ = 400.000 đ'),
        findsOneWidget,
      );
      await tap(tester, find.text('Lưu báo giá'));
      expect(repository.current!.revision, 3);
    },
  );

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
  testWidgets(
    'Báo giá đã lưu thu gọn, chỉ mở form khi chỉnh sửa và đóng sau khi lưu thành công',
    (tester) async {
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
        providerId: 'provider',
        arrivalProviderId: 'provider',
        arrivedAt: DateTime(2026, 10, 23),
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
      expect(find.byType(QuotationEditorScreen), findsNothing);
      expect(find.text('Lưu báo giá'), findsNothing);
      expect(find.text('Cập nhật thời gian hoàn tất'), findsNothing);
      await tester.scrollUntilVisible(
        find.text('Chỉnh sửa'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      expect(
        tester.getTopLeft(find.text('Chỉnh sửa')).dy,
        greaterThan(
          tester.getTopLeft(find.textContaining('Tổng báo giá:').last).dy,
        ),
      );
      await tap(tester, find.text('Chỉnh sửa'));
      await tester.scrollUntilVisible(
        find.byTooltip('Quét ảnh bằng AI'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.byType(QuotationEditorScreen), findsOneWidget);
      expect(find.text('Lập báo giá sửa chữa'), findsNothing);
      expect(find.text('Chỉnh sửa báo giá'), findsNothing);
      expect(find.text('Hạng mục báo giá (1)'), findsOneWidget);
      await voice(tester);
      await tap(tester, find.text('Hủy chỉnh sửa'));
      expect(repository.saved, isNull);
      expect(find.byType(QuotationEditorScreen), findsNothing);
      await tap(tester, find.text('Chỉnh sửa'));
      await tester.scrollUntilVisible(
        find.byTooltip('Quét ảnh bằng AI'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        find.textContaining('Số lượng 2 × 180.000 đ = 360.000 đ'),
        findsOneWidget,
      );
      repository.fail = true;
      await tap(tester, find.text('Lưu báo giá'));
      expect(find.text('Chưa thể lưu báo giá.'), findsOneWidget);
      expect(find.byType(QuotationEditorScreen), findsOneWidget);
      repository.fail = false;
      await tap(tester, find.text('Lưu báo giá'));
      expect(repository.saved, isNotNull);
      expect(find.byType(QuotationEditorScreen), findsNothing);
      expect(find.text('Lưu báo giá'), findsNothing);
      expect(find.text('Chỉnh sửa'), findsOneWidget);
      expect(find.byType(ProviderOrderDetailScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
