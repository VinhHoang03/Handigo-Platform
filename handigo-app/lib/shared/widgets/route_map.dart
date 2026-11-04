import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'map_surface.dart';

class RouteMap extends StatefulWidget {
  const RouteMap({
    required this.points,
    this.hasRoute = true,
    this.origin,
    this.destination,
    super.key,
  });
  final List<LatLng> points;
  final bool hasRoute;
  final LatLng? origin, destination;
  @override
  State<RouteMap> createState() => _RouteMapState();
}

class _RouteMapState extends State<RouteMap> {
  final controller = MapController();
  bool ready = false;
  List<LatLng> get bounds => [
    ...widget.points,
    ?widget.origin,
    ?widget.destination,
  ];
  void fit() {
    if (!mounted || !ready || bounds.isEmpty) return;
    if (bounds.every(
      (p) =>
          p.latitude == bounds.first.latitude &&
          p.longitude == bounds.first.longitude,
    )) {
      controller.move(bounds.first, 16);
    } else {
      controller.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(bounds),
          padding: const EdgeInsets.all(40),
          maxZoom: 18,
        ),
      );
    }
  }

  @override
  void didUpdateWidget(RouteMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!listEquals(oldWidget.points, widget.points) ||
        oldWidget.origin != widget.origin ||
        oldWidget.destination != widget.destination) {
      WidgetsBinding.instance.addPostFrameCallback((_) => fit());
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.points.isEmpty) {
      return const Center(child: Text('Chưa có vị trí để hiển thị.'));
    }
    return MapSurface(
      map: FlutterMap(
        mapController: controller,
        options: MapOptions(
          initialCenter: widget.points.first,
          initialZoom: 14,
          maxZoom: 19,
          onMapReady: () {
            ready = true;
            fit();
          },
        ),
        children: [
          const MapTiles(),
          if (widget.hasRoute && widget.points.length > 1)
            PolylineLayer(
              polylines: [
                Polyline(
                  points: widget.points,
                  color: Theme.of(context).colorScheme.primary,
                  strokeWidth: 5,
                ),
              ],
            ),
          MarkerLayer(
            markers: [
              if (widget.origin case final point?)
                Marker(
                  point: point,
                  width: 40,
                  height: 40,
                  child: const Tooltip(
                    message: 'Vị trí thợ',
                    child: Icon(
                      Icons.location_pin,
                      color: Colors.blue,
                      size: 40,
                    ),
                  ),
                  alignment: Alignment.topCenter,
                ),
              if (widget.destination case final point?)
                Marker(
                  point: point,
                  width: 40,
                  height: 40,
                  child: const Tooltip(
                    message: 'Địa chỉ dịch vụ',
                    child: Icon(
                      Icons.location_pin,
                      color: Colors.red,
                      size: 40,
                    ),
                  ),
                  alignment: Alignment.topCenter,
                ),
            ],
          ),
          mapAttribution(),
        ],
      ),
    );
  }
}
