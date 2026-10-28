import 'dart:async';
import 'package:handigo_app/shared/widgets/rating_stars.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_followup_panel.dart';

const order = OrderDetail(
  id: 'order',
  code: 'ORD-1',
  serviceName: 'Vệ sinh điều hòa',
  status: 'completed',
  paymentStatus: 'paid',
  paymentMethod: 'wallet',
);

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  bool fail = false, allowed = true;
  int calls = 0;
  Map<String, dynamic>? payload, feedback;
  Completer<void>? pending;
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(path, '/feedback');
    expect(method, 'POST');
    expect(authenticated, isTrue);
    calls++;
    if (pending != null) await pending!.future;
    if (fail) throw const ApiException('Chưa thể gửi đánh giá.');
    payload = data;
    feedback = {'id': 'feedback', ...data!};
    allowed = false;
    return {'data': feedback};
  }
}

void main() {
  Future<void> open(WidgetTester tester, _Api api) async {
    addTearDown(api.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          orderFeedbackContextProvider.overrideWith(
            (ref, id) async => {
              'canReview': api.allowed,
              'feedback': api.feedback,
              'reason': 'Đã gửi đánh giá.',
            },
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: OrderFollowupPanel(order: order),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'Hiện 5 sao, chọn mới mở nhận xét và gửi được khi không có nhận xét',
    (tester) async {
      final api = _Api();
      await open(tester, api);
      expect(find.byIcon(Icons.star_outline_rounded), findsNWidgets(5));
      expect(find.text('Viết đánh giá'), findsNothing);
      expect(find.byType(TextField), findsNothing);
      expect(find.text('Gửi đánh giá'), findsNothing);
      await tester.tap(find.byTooltip('4 sao'));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.star_rounded), findsNWidgets(4));
      expect(find.byType(TextField), findsOneWidget);
      await tester.tap(find.text('Gửi đánh giá'));
      await tester.pumpAndSettle();
      expect(api.payload!['rating'], 4);
      expect(api.payload!['orderId'], 'order');
      expect(api.payload!['comment'], '');
      expect(api.payload!['images'], isEmpty);
      expect(find.text('4 / 5 sao'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Lỗi giữ sao và nhận xét, cho sửa sao và gửi lại', (
    tester,
  ) async {
    final api = _Api()..fail = true;
    await open(tester, api);
    await tester.tap(find.byTooltip('2 sao'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Cần đến đúng giờ hơn.');
    await tester.tap(find.text('Gửi đánh giá'));
    await tester.pumpAndSettle();
    expect(find.text('Chưa thể gửi đánh giá.'), findsOneWidget);
    expect(find.byIcon(Icons.star_rounded), findsNWidgets(2));
    expect(find.text('Cần đến đúng giờ hơn.'), findsOneWidget);
    api.fail = false;
    await tester.tap(find.byTooltip('3 sao'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gửi đánh giá'));
    await tester.pumpAndSettle();
    expect(api.payload!['rating'], 3);
    expect(api.payload!['comment'], 'Cần đến đúng giờ hơn.');
    expect(tester.takeException(), isNull);
  });
  testWidgets('Đang gửi khóa sao và nút gửi, tránh gửi lặp', (tester) async {
    final api = _Api()..pending = Completer<void>();
    await open(tester, api);
    await tester.tap(find.byTooltip('5 sao'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gửi đánh giá'));
    await tester.pump();
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    expect(
      tester.widget<RatingStars>(find.byType(RatingStars)).onChanged,
      isNull,
    );
    expect(api.calls, 1);
    api.pending!.complete();
    await tester.pumpAndSettle();
    expect(find.text('5 / 5 sao'), findsOneWidget);
  });
  testWidgets('Chưa đủ điều kiện thì không cho chọn sao', (tester) async {
    final api = _Api()..allowed = false;
    await open(tester, api);
    expect(find.byIcon(Icons.star_outline_rounded), findsNothing);
    expect(find.text('Gửi đánh giá'), findsNothing);
    expect(api.calls, 0);
  });
  for (final rating in [1.5, 4.5]) {
    testWidgets('Lưu chính xác nửa sao: $rating', (tester) async {
      final api = _Api();
      await open(tester, api);
      final star = find.byTooltip('${rating.ceil()} sao');
      await tester.tapAt(tester.getTopLeft(star) + const Offset(10, 24));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.star_half_rounded), findsOneWidget);
      expect(
        tester.widget<RatingStars>(find.byType(RatingStars)).value,
        rating,
      );
      await tester.tap(find.text('Gửi đánh giá'));
      await tester.pumpAndSettle();
      expect(api.payload!['rating'], rating);
      expect(tester.takeException(), isNull);
    });
  }
}
