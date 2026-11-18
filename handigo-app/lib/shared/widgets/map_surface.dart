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
  defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
);

String mapTileFailureCode(Object error) {
  if (error is NetworkImageLoadException) {
    return 'TILE_HTTP_${error.statusCode}';
  }
  final message = error.toString().toLowerCase();
  final status = RegExp(
    r'status(?:code|\s+code)?\s*[:=]?\s*([45]\d{2})',
  ).firstMatch(message);
  if (status != null) return 'TILE_HTTP_${status.group(1)}';
  if (message.contains('failed host lookup') ||
      message.contains('name_not_resolved') ||
      message.contains('getaddrinfo')) {
    return 'TILE_DNS';
  }
  if (message.contains('handshakeexception') ||
      message.contains('certificate_verify_failed') ||
      message.contains('tls handshake')) {
    return 'TILE_TLS';
  }
  if (message.contains('connection reset') ||
      message.contains('connection was reset') ||
      message.contains('connection refused')) {
    return 'TILE_CONNECTION';
  }
  if (message.contains('failed to fetch')) return 'TILE_FETCH';
  return 'TILE_LOAD_FAILED';
}

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
  bool receivedTile = false, statusQueued = false;
  MapCamera? camera;
  final tiles = <TileCoordinates, TileImage>{};
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
    loadingTimer = Timer(const Duration(seconds: 12), () {
      if (mounted && !receivedTile) {
        report('TILE_TIMEOUT');
        if (canUseFallback) {
          switchToFallback();
          return;
        }
        setState(() {
          failed = true;
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
      tiles.clear();
      diagnostic = null;
      revision++;
    });
    watchLoading();
  }

  void report(String code) {
    // Không ghi URL đầy đủ vì nguồn tile tùy chỉnh có thể chứa key.
    final host = Uri.tryParse(tileUrl)?.host ?? 'nguồn không hợp lệ';
    final value = '$code · $host';
    if (diagnostic == value) return;
    diagnostic = value;
    if (kDebugMode) {
      debugPrint('[Bản đồ nền][$code] Nguồn: $host');
    }
  }

  bool isVisible(TileCoordinates coordinates) {
    final current = camera;
    if (current == null || coordinates.z != current.zoom.round().clamp(0, 19)) {
      return false;
    }
    final scale = current.getZoomScale(coordinates.z.toDouble(), current.zoom);
    final bounds = Rect.fromCenter(
      center: current.projectAtZoom(current.center, coordinates.z.toDouble()),
      width: current.size.width * scale,
      height: current.size.height * scale,
    );
    return bounds.overlaps(
      Rect.fromLTWH(coordinates.x * 256.0, coordinates.y * 256.0, 256, 256),
    );
  }

  void observeTile(TileImage tile) {
    if (!isVisible(tile.coordinates)) return;
    tiles[tile.coordinates] = tile;
    updateStatus();
  }

  void updateStatus() {
    if (statusQueued) return;
    statusQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      statusQueued = false;
      if (!mounted) return;
      tiles.removeWhere((coordinates, _) => !isVisible(coordinates));
      final loaded = tiles.values.any(
        (tile) => tile.imageInfo != null && !tile.loadError,
      );
      final allFailed =
          tiles.isNotEmpty && tiles.values.every((tile) => tile.loadError);
      if (loaded) {
        loadingTimer?.cancel();
        if (!receivedTile || failed || diagnostic != null) {
          setState(() {
            receivedTile = true;
            failed = false;
            diagnostic = null;
          });
        }
      } else if (allFailed) {
        loadingTimer?.cancel();
        if (canUseFallback) {
          switchToFallback();
        } else if (!failed) {
          setState(() => failed = true);
        }
      }
    });
  }

  @override
  void dispose() {
    loadingTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = MapCamera.of(context);
    final viewChanged =
        camera?.center != current.center ||
        camera?.zoom != current.zoom ||
        camera?.size != current.size ||
        camera?.rotation != current.rotation;
    camera = current;
    if (viewChanged) {
      // Chỉ xét ô ảnh trong vùng và mức zoom đang xem, bỏ lỗi của vùng cũ.
      tiles.removeWhere((coordinates, _) => !isVisible(coordinates));
      failed = false;
      diagnostic = null;
      watchLoading();
    }
    final currentRevision = revision;
    updateStatus();
    return Stack(
      children: [
        TileLayer(
          key: ValueKey(revision),
          urlTemplate: tileUrl,
          tileProvider: widget.tileProvider,
          userAgentPackageName: 'com.handigo.handigo_app',
          maxNativeZoom: 19,
          evictErrorTileStrategy: EvictErrorTileStrategy.notVisible,
          tileBuilder: (context, child, tile) {
            if (currentRevision == revision) observeTile(tile);
            return child;
          },
          errorTileCallback: (tile, error, _) {
            if (currentRevision == revision && isVisible(tile.coordinates)) {
              report(mapTileFailureCode(error));
              observeTile(tile);
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
                  '${diagnostic != null ? '\nMã lỗi: $diagnostic' : ''}',
                ),
                onPressed: () => setState(() {
                  // Thử lại từ nguồn chính; lỗi tiếp sẽ tự chuyển dự phòng.
                  usingFallback = false;
                  failed = false;
                  tiles.clear();
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
          mapPrimaryTileUrl.contains('cartocdn.com')
              ? '© OpenStreetMap contributors © CARTO'
              : '© OpenStreetMap contributors',
          style: const TextStyle(fontSize: 11, color: Colors.black87),
        ),
      ),
    ),
  ),
);
