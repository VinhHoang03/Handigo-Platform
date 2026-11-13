import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

// Không cần nạp SDK hoặc key trên thiết bị. Tách renderer để kiểm thử ghim.
final mapReadyProvider = FutureProvider<bool>((ref) async => true);
final mapViewBuilderProvider = Provider<Widget Function(FlutterMap)>(
  (ref) =>
      (map) => map,
);

class MapSurface extends ConsumerWidget {
  const MapSurface({required this.map, super.key});
  final FlutterMap map;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ready = ref.watch(mapReadyProvider);
    if (ready.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (ready.asData?.value == true) {
      return ref.watch(mapViewBuilderProvider)(map);
    }
    return Center(
      child: TextButton(
        onPressed: () => ref.invalidate(mapReadyProvider),
        child: const Text('Bản đồ chưa sẵn sàng. Nhấn để thử lại.'),
      ),
    );
  }
}

const mapPrimaryTileUrl = String.fromEnvironment(
  'MAP_TILE_URL',
  defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
);

// Truyền `--dart-define=MAP_TILE_FALLBACK_URL=` (rỗng) để tắt nguồn dự phòng.
const mapFallbackTileUrl = String.fromEnvironment(
  'MAP_TILE_FALLBACK_URL',
  defaultValue:
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
);

class MapTiles extends StatefulWidget {
  const MapTiles({this.tileProvider, super.key});
  final TileProvider? tileProvider;
  @override
  State<MapTiles> createState() => _MapTilesState();
}

class _MapTilesState extends State<MapTiles> {
  static const primaryTileUrl = mapPrimaryTileUrl;
  static const fallbackTileUrl = mapFallbackTileUrl;
  bool failed = false;
  bool receivedTile = false, errorQueued = false, timedOut = false;
  // Nguồn chính có thể bị chặn/chập chờn theo mạng (lỗi TLS, timeout), nên
  // chuyển cả lớp sang nguồn dự phòng để bản đồ không bị trộn hai kiểu tile.
  bool usingFallback = false;
  String? diagnostic;
  Timer? loadingTimer;
  int revision = 0;

  String get tileUrl => usingFallback ? fallbackTileUrl : primaryTileUrl;
  bool get canUseFallback =>
      !usingFallback &&
      fallbackTileUrl.isNotEmpty &&
      fallbackTileUrl != primaryTileUrl;

  @override
  void initState() {
    super.initState();
    watchLoading();
  }

  void watchLoading() {
    loadingTimer?.cancel();
    receivedTile = false;
    timedOut = false;
    loadingTimer = Timer(const Duration(seconds: 12), () {
      if (mounted && !receivedTile) {
        report('TILE_TIMEOUT');
        if (canUseFallback) {
          switchToFallback();
          return;
        }
        setState(() {
          failed = true;
          timedOut = true;
        });
      }
    });
  }

  void switchToFallback() {
    if (kDebugMode) {
      final host = Uri.tryParse(fallbackTileUrl)?.host ?? 'nguồn không hợp lệ';
      debugPrint('[Bản đồ nền] Chuyển sang nguồn dự phòng: $host');
    }
    setState(() {
      usingFallback = true;
      failed = false;
      errorQueued = false;
      diagnostic = null;
      revision++;
    });
    watchLoading();
  }

  void report(String code) {
    // Không ghi URL đầy đủ vì nguồn tile tùy chỉnh có thể chứa key.
    final host = Uri.tryParse(tileUrl)?.host ?? 'nguồn không hợp lệ';
    diagnostic = '$code · $host';
    if (kDebugMode) {
      debugPrint('[Bản đồ nền][$code] Nguồn: $host');
    }
  }

  void tileLoaded() {
    if (receivedTile) return;
    receivedTile = true;
    loadingTimer?.cancel();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          if (timedOut) {
            failed = false;
            diagnostic = null;
          }
        });
      }
    });
  }

  @override
  void dispose() {
    loadingTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      TileLayer(
        key: ValueKey(revision),
        urlTemplate: tileUrl,
        tileProvider: widget.tileProvider,
        userAgentPackageName: 'com.handigo.handigo_app',
        maxNativeZoom: 19,
        tileBuilder: (context, child, tile) {
          if (tile.imageInfo != null) tileLoaded();
          return child;
        },
        errorTileCallback: (_, error, _) {
          if (!errorQueued) {
            errorQueued = true;
            loadingTimer?.cancel();
            report(
              error is NetworkImageLoadException
                  ? 'TILE_HTTP_${error.statusCode}'
                  : 'TILE_LOAD_FAILED',
            );
            final fallback = canUseFallback;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              if (fallback) {
                switchToFallback();
              } else {
                setState(() => failed = true);
              }
            });
          }
        },
      ),
      if (!receivedTile && !failed)
        const Center(
          child: IgnorePointer(
            child: Card(
              child: Padding(
                padding: EdgeInsets.all(12),
                child: Text('Đang tải bản đồ nền...'),
              ),
            ),
          ),
        ),
      if (failed)
        Positioned(
          top: 8,
          left: 8,
          right: 8,
          child: Material(
            borderRadius: BorderRadius.circular(8),
            child: TextButton.icon(
              icon: const Icon(Icons.refresh),
              label: Text(
                'Không tải được bản đồ nền. Nhấn để thử lại.'
                '${kDebugMode && diagnostic != null ? '\n$diagnostic' : ''}',
              ),
              onPressed: () => setState(() {
                // Thử lại từ nguồn chính; lỗi tiếp sẽ tự chuyển dự phòng.
                usingFallback = false;
                failed = false;
                errorQueued = false;
                diagnostic = null;
                revision++;
                watchLoading();
              }),
            ),
          ),
        ),
    ],
  );
}

Widget mapAttribution() => Align(
  alignment: Alignment.bottomRight,
  child: Material(
    color: Colors.white.withValues(alpha: .9),
    child: InkWell(
      onTap: () =>
          launchUrl(Uri.parse('https://www.openstreetmap.org/copyright')),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Text(
          mapFallbackTileUrl.contains('cartocdn.com')
              ? '© OpenStreetMap contributors © CARTO'
              : '© OpenStreetMap contributors',
          style: const TextStyle(fontSize: 11, color: Colors.black87),
        ),
      ),
    ),
  ),
);
