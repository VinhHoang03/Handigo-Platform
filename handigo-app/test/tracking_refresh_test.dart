import 'dart:async';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/core/network/realtime_connection.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/orders/presentation/tracking_screen.dart';
import 'package:handigo_app/shared/widgets/map_surface.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async => throw const ApiException('Chưa có tuyến đường.');
}

void main() {
  testWidgets(
    'Đối soát realtime giữ nguyên bản đồ khi chi tiết đơn đang tải lại',
    (tester) async {
      final api = _Api();
      addTearDown(api.close);
      const order = OrderDetail(
        id: 'order',
        code: 'HD-001',
        serviceName: 'Sửa điều hòa',
        status: 'accepted',
        paymentStatus: 'unpaid',
        paymentMethod: 'cash',
        providerId: 'provider',
        addressLatitude: 10.7,
        addressLongitude: 106.7,
      );
      Completer<OrderDetail>? pending;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            realtimeConnectionProvider.overrideWithValue(null),
            authControllerProvider.overrideWith(
              (ref) => AuthController(AuthRepository(api), api)
                ..user = const AppUser(
                  id: 'customer',
                  fullName: 'Khách',
                  email: 'customer@example.test',
                  role: UserRole.customer,
                )
                ..status = AuthStatus.authenticated,
            ),
            orderDetailProvider(
              'order',
            ).overrideWith((ref) => pending?.future ?? Future.value(order)),
            mapViewBuilderProvider.overrideWithValue(
              (map) => FlutterMap(
                mapController: map.mapController,
                options: map.options,
                children: const [],
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: OrderTrackingScreen(orderId: 'order', embedded: true),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final controller = tester
          .widget<MapSurface>(find.byType(MapSurface))
          .map
          .mapController;
      final container = ProviderScope.containerOf(
        tester.element(find.byType(OrderTrackingScreen)),
      );
      for (var i = 0; i < 3; i++) {
        pending = Completer<OrderDetail>();
        container.invalidate(orderDetailProvider('order'));
        await tester.pump();
        expect(find.byType(MapSurface), findsOneWidget);
        expect(
          tester.widget<MapSurface>(find.byType(MapSurface)).map.mapController,
          same(controller),
        );
      pending.complete(order);
        await tester.pumpAndSettle();
      }
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
}
