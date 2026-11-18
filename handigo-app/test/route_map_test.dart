import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/shared/widgets/map_surface.dart';
import 'package:handigo_app/shared/widgets/route_map.dart';
import 'package:latlong2/latlong.dart';

void main() {
  testWidgets(
    'Thu nhỏ bản đồ không nhân đôi ghim thợ và khách sang thế giới bên cạnh',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mapViewBuilderProvider.overrideWithValue(
              (map) => FlutterMap(
                mapController: map.mapController,
                options: map.options,
                children: map.children
                    .where((child) => child is! MapTiles)
                    .toList(),
              ),
            ),
          ],
          child: const MaterialApp(
            home: SizedBox(
              width: 800,
              height: 400,
              child: RouteMap(
                points: [LatLng(16, 108), LatLng(16.01, 108.01)],
                origin: LatLng(16, 108),
                destination: LatLng(16.01, 108.01),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final controller = tester
          .widget<MapSurface>(find.byType(MapSurface))
          .map
          .mapController!;
      controller.move(const LatLng(0, 0), 0);
      await tester.pumpAndSettle();
      expect(find.byTooltip('Vị trí kỹ thuật viên'), findsOneWidget);
      expect(find.byTooltip('Địa chỉ thực hiện dịch vụ'), findsOneWidget);
      expect(controller.camera.crs.replicatesWorldLongitude, isFalse);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'GPS realtime không kéo lại camera khi người dùng đang kéo hoặc zoom',
    (tester) async {
      final points = ValueNotifier(const [
        LatLng(16, 108),
        LatLng(16.01, 108.01),
      ]);
      addTearDown(points.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mapViewBuilderProvider.overrideWithValue(
              (map) => FlutterMap(
                mapController: map.mapController,
                options: map.options,
                children: const [],
              ),
            ),
          ],
          child: MaterialApp(
            home: SizedBox(
              width: 400,
              height: 300,
              child: ValueListenableBuilder<List<LatLng>>(
                valueListenable: points,
                builder: (_, value, _) => RouteMap(points: value),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.drag(find.byType(FlutterMap), const Offset(80, 40));
      await tester.pumpAndSettle();
      final controller = tester
          .widget<MapSurface>(find.byType(MapSurface))
          .map
          .mapController!;
      final center = controller.camera.center;
      final zoom = controller.camera.zoom;
      points.value = const [LatLng(16.0001, 108.0001), LatLng(16.01, 108.01)];
      await tester.pumpAndSettle();
      expect(controller.camera.center, center);
      expect(controller.camera.zoom, zoom);
      expect(
        tester.widget<MapSurface>(find.byType(MapSurface)).map.mapController,
        same(controller),
      );
      await tester.pumpWidget(const SizedBox());
    },
  );

  Future<void> open(WidgetTester tester, {required bool hasRoute}) =>
      tester.pumpWidget(
        ProviderScope(
          overrides: [
            mapViewBuilderProvider.overrideWithValue(
              (map) => const SizedBox.expand(),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: RouteMap(
                points: const [LatLng(16.01, 108.01), LatLng(16.02, 108.02)],
                origin: const LatLng(16, 108),
                destination: const LatLng(16.03, 108.03),
                hasRoute: hasRoute,
              ),
            ),
          ),
        ),
      );
  testWidgets('Ghim giữ tọa độ thật, không bị dịch sang đầu tuyến', (
    tester,
  ) async {
    await open(tester, hasRoute: true);
    await tester.pumpAndSettle();
    final map = tester.widget<MapSurface>(find.byType(MapSurface)).map;
    final markers = map.children.whereType<MarkerLayer>().single.markers;
    expect(markers.first.point.latitude, 16);
    expect(markers.last.point.latitude, 16.03);
    final line = map.children
        .whereType<PolylineLayer>()
        .single
        .polylines
        .single;
    expect(line.points.first.latitude, 16.01);
  });
  testWidgets('Không có tuyến thì chỉ hiện ghim và không vẽ đường thẳng', (
    tester,
  ) async {
    await open(tester, hasRoute: false);
    await tester.pumpAndSettle();
    final map = tester.widget<MapSurface>(find.byType(MapSurface)).map;
    expect(map.children.whereType<PolylineLayer>(), isEmpty);
    expect(map.children.whereType<MarkerLayer>().single.markers.length, 2);
  });
  testWidgets('Đóng mở bản đồ nhiều lần với renderer Flutter thật', (
    tester,
  ) async {
    for (var i = 0; i < 3; i++) {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            mapViewBuilderProvider.overrideWithValue(
              (map) => FlutterMap(
                mapController: map.mapController,
                options: map.options,
                children: const [],
              ),
            ),
          ],
          child: MaterialApp(
            home: SizedBox(
              width: 400,
              height: 300,
              child: const RouteMap(
                points: [LatLng(16, 108), LatLng(16.1, 108.1)],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });
}
