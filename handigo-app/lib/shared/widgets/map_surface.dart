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

class MapTiles extends StatefulWidget {
  const MapTiles({this.tileProvider, super.key});
  final TileProvider? tileProvider;
  @override
  State<MapTiles> createState() => _MapTilesState();
}

class _MapTilesState extends State<MapTiles> {
  static const tileUrl = String.fromEnvironment(
    'MAP_TILE_URL',
    defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );
  bool failed = false;
  bool receivedTile = false, errorQueued = false, timedOut = false;
  String? diagnostic;
  Timer? loadingTimer;
  int revision = 0;

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
        setState(() {
          failed = true;
          timedOut = true;
        });
        report('TILE_TIMEOUT');
      }
    });
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
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => failed = true);
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
      child: const Padding(
        padding: EdgeInsets.all(4),
        child: Text(
          '© OpenStreetMap contributors',
          style: TextStyle(fontSize: 11, color: Colors.black87),
        ),
      ),
    ),
  ),
);
