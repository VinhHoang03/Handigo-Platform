import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/shared/widgets/map_surface.dart';
import 'package:handigo_app/shared/widgets/route_map.dart';
import 'package:latlong2/latlong.dart';

void main() {
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
