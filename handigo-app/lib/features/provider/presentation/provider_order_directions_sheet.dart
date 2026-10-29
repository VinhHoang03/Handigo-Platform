import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_exception.dart';
import '../../orders/domain/order_summary.dart';

class ProviderDirections {
  const ProviderDirections({
    required this.points,
    required this.distanceMeters,
    required this.durationSeconds,
  });
  final List<LatLng> points;
  final double distanceMeters, durationSeconds;

  factory ProviderDirections.fromJson(Map<String, dynamic> data) {
    final routes =
        (data['routes'] as List? ?? [])
            .whereType<Map>()
            .where(
              (route) =>
                  route['distance'] is num &&
                  (route['distance'] as num).isFinite &&
                  (route['distance'] as num) >= 0 &&
                  route['duration'] is num &&
                  (route['duration'] as num).isFinite &&
                  (route['duration'] as num) >= 0 &&
                  route['geometry'] is Map &&
                  route['geometry']['type'] == 'LineString' &&
                  route['geometry']['coordinates'] is List,
            )
            .toList()
          ..sort(
            (a, b) => (a['distance'] as num).compareTo(b['distance'] as num),
          );
    for (final route in routes) {
      final coordinates = route['geometry']['coordinates'] as List;
      if (coordinates.length < 2 ||
          coordinates.length > 10000 ||
          coordinates.any(
            (point) =>
                point is! List ||
                point.length < 2 ||
                point[0] is! num ||
                point[1] is! num ||
                !(point[0] as num).isFinite ||
                !(point[1] as num).isFinite ||
                (point[0] as num).abs() > 180 ||
                (point[1] as num).abs() > 90,
          )) {
        continue;
      }
      return ProviderDirections(
        points: coordinates
            .map(
              (point) => LatLng(
                (point[1] as num).toDouble(),
                (point[0] as num).toDouble(),
              ),
            )
            .toList(),
        distanceMeters: (route['distance'] as num).toDouble(),
        durationSeconds: (route['duration'] as num).toDouble(),
      );
    }
    throw const ApiException('Chưa tìm được đường đến địa chỉ này.');
  }
}

final providerOrderDirectionsProvider = FutureProvider.autoDispose
    .family<ProviderDirections, OrderDetail>((ref, order) async {
      final latitude = order.addressLatitude;
      final longitude = order.addressLongitude;
      if (latitude == null ||
          longitude == null ||
          !latitude.isFinite ||
          !longitude.isFinite ||
          latitude.abs() > 90 ||
          longitude.abs() > 180) {
        throw const ApiException('Địa chỉ đơn chưa có tọa độ để chỉ đường.');
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw const ApiException('Bạn cần bật vị trí để xem chỉ đường.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const ApiException('Bạn cần cấp quyền vị trí để xem chỉ đường.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      if (!ref.mounted) throw const ApiException('Đã đóng chỉ đường.');
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
        ),
      );
      ref.onDispose(() => dio.close(force: true));
      final response = await dio.get<Map<String, dynamic>>(
        'https://router.project-osrm.org/route/v1/driving/${position.longitude},${position.latitude};$longitude,$latitude',
        queryParameters: {
          'overview': 'full',
          'geometries': 'geojson',
          'alternatives': 'true',
          'steps': false,
        },
      );
      return ProviderDirections.fromJson(response.data ?? {});
    }, retry: (_, _) => null);

class ProviderOrderDirectionsSheet extends ConsumerWidget {
  const ProviderOrderDirectionsSheet({required this.order, super.key});
  final OrderDetail order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final route = ref.watch(providerOrderDirectionsProvider(order));
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .72,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Chỉ đường đến khách hàng',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              IconButton(
                tooltip: 'Đóng chỉ đường',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          Text(order.addressLabel ?? 'Địa chỉ thực hiện dịch vụ'),
          const SizedBox(height: 12),
          Expanded(
            child: route.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      error is ApiException
                          ? error.message
                          : 'Chưa tải được chỉ đường. Bạn thử lại nhé.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () => ref.invalidate(
                        providerOrderDirectionsProvider(order),
                      ),
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
              data: (value) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: FlutterMap(
                        key: ValueKey(value),
                        options: MapOptions(
                          initialCenter: value.points.first,
                          initialZoom: 14,
                          initialCameraFit: value.points.toSet().length > 1
                              ? CameraFit.bounds(
                                  bounds: LatLngBounds.fromPoints(value.points),
                                  padding: const EdgeInsets.all(40),
                                )
                              : null,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.handigo.handigo_app',
                          ),
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: value.points,
                                color: Theme.of(context).colorScheme.primary,
                                strokeWidth: 5,
                              ),
                            ],
                          ),
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: value.points.first,
                                child: const Tooltip(
                                  message: 'Vị trí hiện tại của bạn',
                                  child: Icon(
                                    Icons.my_location,
                                    size: 32,
                                    color: Colors.blue,
                                  ),
                                ),
                              ),
                              Marker(
                                point: value.points.last,
                                child: const Tooltip(
                                  message: 'Địa chỉ khách hàng',
                                  child: Icon(
                                    Icons.location_on,
                                    size: 36,
                                    color: Colors.red,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          RichAttributionWidget(
                            attributions: [
                              TextSourceAttribution(
                                'OpenStreetMap contributors',
                                onTap: () => launchUrl(
                                  Uri.parse(
                                    'https://www.openstreetmap.org/copyright',
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${(value.distanceMeters / 1000).toStringAsFixed(1)} km · Khoảng ${(value.durationSeconds / 60).ceil()} phút',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const Text(
                    'Từ vị trí hiện tại của bạn đến địa chỉ khách hàng.',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
