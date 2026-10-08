import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/booking_schedule_selector.dart';
import 'package:handigo_app/features/service_catalog/presentation/booking_note_input.dart';
import 'package:handigo_app/features/service_catalog/data/service_catalog_repository.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/domain/service_option.dart';
import 'package:handigo_app/features/service_catalog/domain/service_review.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_screens.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_reviews_screen.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_option_selector.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/shared/widgets/service_images.dart';

const detail = ServiceDetail(
  service: Service(
    id: '1',
    name: 'Vệ sinh máy lạnh',
    description: 'Làm sạch thiết bị tại nhà.',
    serviceType: 'fixed_price',
    fixedPrice: 180000,
    totalFeedbacks: 8,
    averageRating: 4.5,
    processSteps: [
      ServiceProcessStep(
        title: 'Kiểm tra thiết bị',
        description: 'Kiểm tra vận hành trước khi vệ sinh.',
      ),
      ServiceProcessStep(
        title: 'Nghiệm thu',
        description: 'Kiểm tra và bàn giao.',
      ),
    ],
  ),
  options: [
    ServiceOption(id: 'option-1', name: 'Vệ sinh tiêu chuẩn', price: 180000),
  ],
);
final reviews = [
  for (var index = 1; index <= 6; index++)
    ServiceReview(
      id: '$index',
      customerName: 'Khách $index',
      rating: index == 1
          ? 2
          : index == 2
          ? 4
          : 5,
      comment: 'Nội dung đánh giá $index',
      createdAt: DateTime(2026, 10, index),
    ),
];
final previewKey = GlobalKey();

class _BookingRepository implements ServiceCatalogRepository {
  @override
  Future<List<Address>> addresses() async => [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> capturePreview(WidgetTester tester, String name) async {
  if (!const bool.fromEnvironment('DETAIL_PREVIEW')) return;
  await tester.runAsync(() async {
    final boundary =
        previewKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await File(
      '.dart_tool/$name.png',
    ).writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

Future<void> showScreen(
  WidgetTester tester, {
  bool full = false,
  bool booking = false,
  double scale = 1,
  Size size = const Size(390, 844),
  ServiceDetail value = detail,
  void Function(ServiceReviewQuery)? onQuery,
  bool error = false,
  List<ServiceReview>? items,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (_, _) => full
            ? const ServiceReviewsScreen(serviceId: '1')
            : const ServiceDetailScreen(serviceId: '1'),
      ),
      GoRoute(
        path: '/customer/services/:id/reviews',
        builder: (_, _) => const ServiceReviewsScreen(serviceId: '1'),
      ),
      GoRoute(
        path: '/customer/bookings/new/:id',
        builder: (_, _) => booking
            ? BookingScreen(detail: value)
            : const Scaffold(body: Text('Trang đặt lịch')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        serviceCatalogRepositoryProvider.overrideWithValue(_BookingRepository()),
        serviceDetailProvider('1').overrideWith((ref) async => value),
        serviceReviewsProvider.overrideWith((ref, query) async {
          onQuery?.call(query);
          if (error) throw StateError('Lỗi thử nghiệm');
          return PagedResult(
            items: items ?? reviews,
            page: query.page,
            totalPages: query.positiveOnly ? 1 : 2,
          );
        }),
      ],
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: RepaintBoundary(key: previewKey, child: child!),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Thiếu địa chỉ hiện toast warning phía trên thay banner trong form', (tester) async {
    await showScreen(tester, booking: true);
    await tester.tap(find.widgetWithText(FilledButton, 'Đặt lịch dịch vụ ngay'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vệ sinh tiêu chuẩn'));
    await tester.pump();
    final next = find.text('Tiếp tục sang Thanh toán');
    await tester.scrollUntilVisible(next, 250,
      scrollable: find.descendant(of: find.byType(ListView).last, matching: find.byType(Scrollable)).first);
    await tester.tap(next);
    await tester.pump();
    expect(find.text('Vui lòng chọn địa chỉ thực hiện.'), findsOneWidget);
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    final message = find.text('Vui lòng chọn địa chỉ thực hiện.');
    expect(tester.getTopLeft(message).dy, lessThan(100));
    final container = ProviderScope.containerOf(tester.element(find.byType(BookingScreen)));
    expect(container.read(bookingDraftProvider).selectedOptionIds, ['option-1']);
    await tester.tap(find.byTooltip('Đóng thông báo'));
    await tester.pump();
    expect(message, findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Ghi chú chứa ảnh vuông, xem và xóa ảnh, tự giãn theo nội dung', (tester) async {
    final controller = TextEditingController(text: 'Ghi chú đã nhập');
    addTearDown(controller.dispose);
    await tester.pumpWidget(ProviderScope(child: MaterialApp(theme: AppTheme.light,
      home: Scaffold(body: SingleChildScrollView(child: BookingNoteInput(controller: controller))))));
    final container = ProviderScope.containerOf(tester.element(find.byType(BookingNoteInput)));
    container.read(bookingDraftProvider.notifier).setAttachments(['https://example.com/incident.jpg']);
    await tester.pump();
    final image = find.byType(Image).first;
    expect(tester.getSize(image).width, tester.getSize(image).height);
    expect(tester.getTopLeft(image).dy, lessThan(tester.getTopLeft(find.byType(TextField)).dy));
    await tester.tap(image);
    await tester.pumpAndSettle();
    expect(find.byType(InteractiveViewer), findsOneWidget);
    await tester.tap(find.byTooltip('Đóng ảnh'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Xóa ảnh sự cố 1'));
    await tester.pump();
    expect(container.read(bookingDraftProvider).attachments, isEmpty);
    expect(controller.text, 'Ghi chú đã nhập');
    final smallHeight = tester.getSize(find.byType(BookingNoteInput)).height;
    await tester.enterText(find.byType(TextField), 'Dòng một\nDòng hai\nDòng ba\nDòng bốn');
    await tester.pump();
    expect(tester.getSize(find.byType(BookingNoteInput)).height, greaterThan(smallHeight));
    expect(container.read(bookingDraftProvider).problemDescription, controller.text);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Chọn nhanh 5 ngày, cuộn giờ phút và đổi ngày vẫn giữ giờ', (tester) async {
    await tester.pumpWidget(ProviderScope(child: MaterialApp(theme: AppTheme.light,
      home: const Scaffold(body: SizedBox(width: 320, child: SingleChildScrollView(child: BookingScheduleSelector()))))));
    expect(find.byType(OutlinedButton), findsNWidgets(7));
    await tester.tap(find.byType(OutlinedButton).at(2));
    await tester.pump();
    final container = ProviderScope.containerOf(tester.element(find.byType(BookingScheduleSelector)));
    final firstDate = container.read(bookingDraftProvider).scheduledAt!;
    await tester.tap(find.byIcon(Icons.access_time_rounded));
    await tester.pumpAndSettle();
    final wheels = tester.widgetList<ListWheelScrollView>(find.byType(ListWheelScrollView)).toList();
    (wheels[0].controller! as FixedExtentScrollController).jumpToItem(6);
    (wheels[1].controller! as FixedExtentScrollController).jumpToItem(30);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn 14:30'));
    await tester.pumpAndSettle();
    expect(container.read(bookingDraftProvider).scheduledAt!.hour, 14);
    expect(container.read(bookingDraftProvider).scheduledAt!.minute, 30);
    await tester.tap(find.byType(OutlinedButton).at(3));
    await tester.pump();
    final changed = container.read(bookingDraftProvider).scheduledAt!;
    expect(changed.day, firstDate.add(const Duration(days: 1)).day);
    expect(changed.hour, 14);
    expect(changed.minute, 30);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Nhóm bắt buộc có sao đỏ, option tự giãn và chọn đúng kiểu', (tester) async {
    const description = 'Kiểm tra và vệ sinh toàn bộ thiết bị, làm sạch từng bộ phận, kiểm tra vận hành và hướng dẫn khách hàng sử dụng sau khi hoàn tất công việc tại nhà.';
    await tester.pumpWidget(ProviderScope(child: MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(body: SizedBox(width: 320, child: SingleChildScrollView(
        child: ServiceOptionSelector(detail: ServiceDetail(service: detail.service, options: const [
          ServiceOption(id: 'single', name: 'Gói tiêu chuẩn', price: 180000,
            groupId: 'required', selectionGroup: 'Diện tích', selectionMode: 'single',
            isRequired: true, description: description),
          ServiceOption(id: 'multiple', name: 'Vệ sinh thêm', price: 50000,
            groupId: 'extra', selectionGroup: 'Bổ sung'),
        ])),
      ))),
    )));
    expect(find.text(description), findsOneWidget);
    expect(find.textContaining('Không bắt buộc'), findsNothing);
    expect(find.textContaining('Chọn một'), findsNothing);
    expect(find.textContaining('Chọn nhiều'), findsNothing);
    final title = tester.widget<Text>(find.byWidgetPredicate((widget) =>
        widget is Text && widget.textSpan?.toPlainText(includeSemanticsLabels: false) == 'Diện tích *'));
    final star = (title.textSpan! as TextSpan).children!.last as TextSpan;
    expect(star.style!.color, Colors.red);
    expect(find.byIcon(Icons.radio_button_unchecked), findsOneWidget);
    expect(find.byIcon(Icons.check_box_outline_blank), findsOneWidget);
    final cards = find.byType(Card);
    expect(tester.getSize(cards.first).height, greaterThan(tester.getSize(cards.last).height));
    await tester.tap(find.text('Gói tiêu chuẩn'));
    await tester.tap(find.text('Vệ sinh thêm'));
    await tester.pump();
    expect(find.byIcon(Icons.radio_button_checked), findsOneWidget);
    expect(find.byIcon(Icons.check_box), findsOneWidget);
    final selectedCard = tester.widget<Card>(cards.first);
    final border = (selectedCard.shape! as RoundedRectangleBorder).side;
    expect(border.color, AppTheme.light.colorScheme.primary);
    expect(border.width, 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Chọn gói trong sheet 65%, bỏ thẻ dịch vụ và mở lại được', (tester) async {
    await showScreen(tester, booking: true);
    await tester.tap(find.widgetWithText(FilledButton, 'Đặt lịch dịch vụ ngay'));
    await tester.pumpAndSettle();
    expect(find.text('Dịch vụ đã chọn'), findsNothing);
    expect(find.text('Vệ sinh tiêu chuẩn'), findsOneWidget);
    final sheet = tester.widget<BottomSheet>(find.byType(BottomSheet));
    expect(sheet.constraints!.maxHeight, closeTo(844 * .65, .1));
    await tester.tap(find.text('Vệ sinh tiêu chuẩn'));
    await tester.pumpAndSettle();
    final note = find.widgetWithText(TextField, 'Ghi chú gì đó cho thợ');
    await tester.scrollUntilVisible(note, 250,
        scrollable: find.descendant(of: find.byType(ListView).last, matching: find.byType(Scrollable)).first);
    await tester.enterText(note, 'Gọi trước khi đến');
    final voucher = find.widgetWithText(TextField, 'Mã voucher (không bắt buộc)');
    await tester.ensureVisible(voucher);
    await tester.enterText(voucher, 'handigo10');
    tester.testTextInput.hide();
    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Đặt lịch dịch vụ ngay'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.check_box), findsOneWidget);
    expect(find.byType(BottomSheet), findsOneWidget);
    expect(find.text('Gọi trước khi đến'), findsOneWidget);
    expect(find.text('HANDIGO10'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('Đọc quy trình thật và tương thích dịch vụ cũ', () {
    final base = {'_id': '1', 'name': 'Dịch vụ', 'serviceType': 'fixed_price'};
    expect(Service.fromJson(base).processSteps, isEmpty);
    expect(
      Service.fromJson({
        ...base,
        'processSteps': [
          {'title': ' Kiểm tra ', 'description': ' Thực hiện '},
          {'title': ' '},
        ],
      }).processSteps.single.title,
      'Kiểm tra',
    );
    expect(AppTheme.light.textTheme.bodyMedium?.fontFamily, 'Inter');
    expect(AppTheme.dark.textTheme.titleMedium?.fontFamily, 'Hanken Grotesk');
  });

  testWidgets(
    'Không có nút trở về trên ảnh, bỏ chọn gói, quy trình lấy từ dữ liệu',
    (tester) async {
      await showScreen(tester);
      expect(find.byIcon(Icons.arrow_back), findsNothing);
      expect(find.text('Chọn gói dịch vụ'), findsNothing);
      await tester.scrollUntilVisible(find.text('Quy trình thực hiện'), 200);
      expect(find.text('Kiểm tra thiết bị'), findsOneWidget);
      expect(find.text('Nghiệm thu'), findsOneWidget);
      final circle = tester.widget<CircleAvatar>(
        find.byType(CircleAvatar).first,
      );
      expect(circle.backgroundColor, AppTheme.light.colorScheme.primary);
      expect(circle.foregroundColor, Colors.white);
      await capturePreview(tester, 'service-detail-preview');
      await tester.tap(
        find.widgetWithText(FilledButton, 'Đặt lịch dịch vụ ngay'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Chọn gói dịch vụ'), findsOneWidget);
      expect(find.text('Đặt dịch vụ'), findsOneWidget);
      expect(find.byType(BottomSheet), findsOneWidget);
    },
  );

  testWidgets(
    'Ẩn quy trình rỗng và giới hạn 4 đánh giá tốt, xem tất cả chuyển trang',
    (tester) async {
      await showScreen(
        tester,
        value: const ServiceDetail(
          service: Service(
            id: '1',
            name: 'Dịch vụ',
            description: '',
            serviceType: 'fixed_price',
          ),
          options: [],
        ),
      );
      await tester.scrollUntilVisible(find.text('Đánh giá thực tế'), 200);
      expect(find.text('Quy trình thực hiện'), findsNothing);
      expect(find.byType(ServiceReviewCard), findsNWidgets(4));
      expect(find.text('Khách 1'), findsNothing);
      expect(find.text('Khách 2'), findsNothing);
      final cards = tester
          .widgetList<ServiceReviewCard>(find.byType(ServiceReviewCard))
          .toList();
      expect(cards.first.review.id, '6');
      await tester.tap(find.text('Xem tất cả ›'));
      await tester.pumpAndSettle();
      expect(find.text('Đánh giá dịch vụ'), findsOneWidget);
      expect(find.text('Khách 1'), findsOneWidget);
      await capturePreview(tester, 'service-reviews-preview');
    },
  );

  testWidgets('Lọc sao, ảnh, tìm kiếm, gói và phân trang gửi đúng truy vấn', (
    tester,
  ) async {
    final queries = <ServiceReviewQuery>[];
    await showScreen(tester, full: true, onQuery: queries.add, items: []);
    await tester.tap(find.text('4 sao'));
    await tester.pumpAndSettle();
    expect(queries.last.rating, 4);
    await tester.tap(find.text('Có hình ảnh'));
    await tester.pumpAndSettle();
    expect(queries.last.hasImages, isTrue);
    await tester.enterText(find.byType(TextField), 'sạch');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(queries.last.keyword, 'sạch');
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vệ sinh tiêu chuẩn').last);
    await tester.pumpAndSettle();
    expect(queries.last.optionId, 'option-1');
    await tester.scrollUntilVisible(
      find.byTooltip('Trang tiếp theo'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byTooltip('Trang tiếp theo'));
    await tester.pumpAndSettle();
    expect(queries.last.page, 2);
    await tester.scrollUntilVisible(
      find.text('Có hình ảnh'),
      -250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Có hình ảnh'));
    await tester.pumpAndSettle();
    expect(queries.last.page, 1);
    expect(find.text('Không có đánh giá phù hợp.'), findsOneWidget);
  });

  testWidgets('Đánh giá lỗi có tải lại', (tester) async {
    await showScreen(tester, full: true, error: true);
    await tester.scrollUntilVisible(
      find.text('Không thể tải đánh giá.'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Không thể tải đánh giá.'), findsOneWidget);
  });

  testWidgets('Cover đi trước gallery, loại ảnh trùng và đếm khi vuốt', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            child: ServiceImageGallery(
              coverImage: 'https://example.com/cover.png',
              images: [
                'https://example.com/gallery.png',
                'https://example.com/cover.png',
              ],
              name: 'Dịch vụ',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('1/2'), findsOneWidget);
    expect(
      tester
          .widgetList<ServiceCoverImage>(find.byType(ServiceCoverImage))
          .first
          .url,
      'https://example.com/cover.png',
    );
    await tester.drag(find.byType(PageView), const Offset(-320, 0));
    await tester.pumpAndSettle();
    expect(find.text('2/2'), findsOneWidget);
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ServiceImageGallery(
            coverImage: 'https://example.com/new.png',
            images: [],
            name: 'Dịch vụ',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('1/1'), findsOneWidget);
  });

  for (final size in [const Size(320, 640), const Size(390, 844)]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('Chi tiết và đánh giá không tràn $size, chữ $scale', (
        tester,
      ) async {
        await showScreen(tester, size: size, scale: scale);
        await tester.scrollUntilVisible(find.text('Đánh giá thực tế'), 200);
        expect(tester.takeException(), isNull);
        final button = tester.getRect(
          find.widgetWithText(FilledButton, 'Đặt lịch dịch vụ ngay'),
        );
        expect(button.right, closeTo(size.width - 26, 1));
        await showScreen(tester, full: true, size: size, scale: scale);
        await tester.scrollUntilVisible(
          find.byType(ServiceReviewCard).first,
          200,
          scrollable: find.byType(Scrollable).first,
        );
        expect(tester.takeException(), isNull);
      });
    }
  }
}
