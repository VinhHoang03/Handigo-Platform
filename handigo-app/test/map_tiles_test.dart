import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/shared/widgets/map_surface.dart';
import 'package:latlong2/latlong.dart';

class _Tiles extends TileProvider {
  _Tiles(this.image);
  final ImageProvider image;
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      image;
}

void main() {
  testWidgets('Lớp tile phải phủ kín vùng bản đồ', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            height: 300,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: LatLng(16, 108),
                initialZoom: 14,
              ),
              children: [MapTiles()],
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    expect(tester.getSize(find.byType(TileLayer)), const Size(400, 300));
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });

  testWidgets(
    'Ảnh tile tải được thì renderer thực sự nhận ảnh và bỏ trạng thái chờ',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              height: 300,
              child: FlutterMap(
                options: const MapOptions(
                  initialCenter: LatLng(16, 108),
                  initialZoom: 14,
                ),
                children: [
                  MapTiles(
                    tileProvider: _Tiles(
                      const AssetImage('assets/brand/handigo-logo.png'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 150)),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump();
      expect(
        tester
            .widgetList<RawImage>(find.byType(RawImage))
            .any((image) => image.image != null),
        isTrue,
      );
      expect(find.text('Đang tải bản đồ nền...'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
  );

  testWidgets('Lỗi nguồn tile hiện đúng lớp lỗi và không lộ URL hoặc key', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            height: 300,
            child: FlutterMap(
              options: const MapOptions(
                initialCenter: LatLng(16, 108),
                initialZoom: 14,
              ),
              children: [
                MapTiles(
                  tileProvider: _Tiles(
                    const AssetImage('khong-ton-tai?key=fixture-secret'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 150)),
    );
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('TILE_LOAD_FAILED'), findsOneWidget);
    expect(find.textContaining('fixture-secret'), findsNothing);
    expect(find.textContaining('Google'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });
}
