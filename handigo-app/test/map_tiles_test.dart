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

/// Nguồn chính luôn lỗi, nguồn dự phòng trả ảnh hợp lệ.
class _PrimaryBrokenTiles extends TileProvider {
  final requested = <String>[];
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    requested.add(options.urlTemplate ?? '');
    return options.urlTemplate == mapFallbackTileUrl
        ? const AssetImage('assets/brand/handigo-logo.png')
        : const AssetImage('khong-ton-tai.png');
  }
}

class _MixedTiles extends TileProvider {
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      coordinates.x.isEven
      ? const AssetImage('khong-ton-tai.png')
      : const AssetImage('assets/brand/handigo-logo.png');
}

class _ZoomTiles extends TileProvider {
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      coordinates.z == 15
      ? const AssetImage('khong-ton-tai.png')
      : const AssetImage('assets/brand/handigo-logo.png');
}

class _PanTiles extends TileProvider {
  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      coordinates.x >= 13150
      ? const AssetImage('khong-ton-tai.png')
      : const AssetImage('assets/brand/handigo-logo.png');
}

void main() {
  test('Mã lỗi phân biệt HTTP, DNS, TLS và kết nối mà không lộ URL có key', () {
    final cases = {
      'HTTP request failed, statusCode: 429, uri=https://maps.test/a?key=fixture-secret':
          'TILE_HTTP_429',
      'status code: 403': 'TILE_HTTP_403',
      'SocketException: Failed host lookup: maps.test': 'TILE_DNS',
      'HandshakeException: CERTIFICATE_VERIFY_FAILED': 'TILE_TLS',
      'Connection reset by peer': 'TILE_CONNECTION',
      'ClientException: Failed to fetch, uri=https://maps.test/a?key=fixture-secret':
          'TILE_FETCH',
    };
    for (final entry in cases.entries) {
      expect(mapTileFailureCode(Exception(entry.key)), entry.value);
    }
  });

  Future<void> settleTiles(WidgetTester tester) async {
    for (var i = 0; i < 3; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 150)),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    }
  }

  testWidgets('Một số ô ảnh lỗi không báo hỏng toàn bộ bản đồ', (tester) async {
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
              children: [MapTiles(tileProvider: _MixedTiles())],
            ),
          ),
        ),
      ),
    );
    await settleTiles(tester);
    expect(
      tester
          .widgetList<RawImage>(find.byType(RawImage))
          .any((image) => image.image != null),
      isTrue,
    );
    expect(find.textContaining('Không tải được bản đồ nền'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Zoom lỗi rồi sang mức tải được phải tự xóa cảnh báo', (
    tester,
  ) async {
    final controller = MapController();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            height: 300,
            child: FlutterMap(
              mapController: controller,
              options: const MapOptions(
                initialCenter: LatLng(16, 108),
                initialZoom: 14,
              ),
              children: [MapTiles(tileProvider: _ZoomTiles())],
            ),
          ),
        ),
      ),
    );
    await settleTiles(tester);
    controller.move(const LatLng(16, 108), 15);
    await settleTiles(tester);
    expect(find.textContaining('Không tải được bản đồ nền'), findsOneWidget);
    controller.move(const LatLng(16, 108), 16);
    await settleTiles(tester);
    expect(find.textContaining('Không tải được bản đồ nền'), findsNothing);
    expect(find.text('Đang tải bản đồ nền...'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });

  testWidgets('Kéo sang vùng lỗi rồi quay lại phải tự phục hồi bản đồ', (
    tester,
  ) async {
    final controller = MapController();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            height: 300,
            child: FlutterMap(
              mapController: controller,
              options: const MapOptions(
                initialCenter: LatLng(16, 108),
                initialZoom: 14,
              ),
              children: [MapTiles(tileProvider: _PanTiles())],
            ),
          ),
        ),
      ),
    );
    await settleTiles(tester);
    controller.move(const LatLng(16, 110), 14);
    await settleTiles(tester);
    expect(find.textContaining('Không tải được bản đồ nền'), findsOneWidget);
    controller.move(const LatLng(16, 108), 14);
    await settleTiles(tester);
    expect(find.textContaining('Không tải được bản đồ nền'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });

  testWidgets(
    'Nguồn tile chính lỗi thì tự chuyển sang nguồn dự phòng',
    (tester) async {
      final tiles = _PrimaryBrokenTiles();
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
                children: [MapTiles(tileProvider: tiles)],
              ),
            ),
          ),
        ),
      );
      for (var i = 0; i < 3; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 150)),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
      }
      expect(tiles.requested, contains(mapPrimaryTileUrl));
      expect(tiles.requested, contains(mapFallbackTileUrl));
      expect(mapPrimaryTileUrl, isNot(mapFallbackTileUrl));
      expect(find.textContaining('Không tải được bản đồ nền'), findsNothing);
      expect(find.text('Đang tải bản đồ nền...'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
    skip: mapFallbackTileUrl.isEmpty || mapPrimaryTileUrl == mapFallbackTileUrl,
  );

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
    // Lần lỗi đầu chuyển sang nguồn dự phòng, lần lỗi sau mới hiện lớp lỗi.
    for (var i = 0; i < 2; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 150)),
      );
      await tester.pump();
      await tester.pump();
    }
    expect(find.textContaining('TILE_LOAD_FAILED'), findsOneWidget);
    expect(find.textContaining('fixture-secret'), findsNothing);
    expect(find.textContaining('Google'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
  });
}
