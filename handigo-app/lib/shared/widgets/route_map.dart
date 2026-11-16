import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_svg/flutter_svg.dart';
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
                  color: _customerColor.withValues(alpha: .82),
                  strokeWidth: 5,
                  strokeCap: StrokeCap.round,
                  strokeJoin: StrokeJoin.round,
                ),
              ],
            ),
          MarkerLayer(
            markers: [
              if (widget.origin case final point?)
                Marker(
                  point: point,
                  width: 56,
                  height: 56,
                  child: const Tooltip(
                    message: 'Vị trí kỹ thuật viên',
                    child: _TechnicianMarker(),
                  ),
                ),
              if (widget.destination case final point?)
                Marker(
                  point: point,
                  width: 48,
                  height: 60,
                  alignment: Alignment.topCenter,
                  child: const Tooltip(
                    message: 'Địa chỉ thực hiện dịch vụ',
                    child: _ServiceAddressMarker(),
                  ),
                ),
            ],
          ),
          mapAttribution(),
        ],
      ),
    );
  }
}

// Màu và hình marker đồng bộ với web (leaflet-marker-factory.ts).
const _customerColor = Color(0xFF4F46E5);

const _serviceAddressSvg =
    '<svg width="48" height="60" viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">'
    '<path d="M24 58C19 49 3 35 3 24a21 21 0 1 1 42 0c0 11-16 25-21 34Z" fill="#4f46e5" stroke="white" stroke-width="3"/>'
    '<path d="m13 24 11-9 11 9M16 22v13h16V22M21 35v-9h6v9" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    '</svg>';

const _technicianSvg =
    '<svg viewBox="0 0 40 40" width="38" height="38" xmlns="http://www.w3.org/2000/svg">'
    '<path d="M8 35v-5c0-5 5-8 12-8s12 3 12 8v5" fill="#e0f2f1"/>'
    '<path d="m15 25 5 5 5-5M20 30v5" fill="none" stroke="#0f766e" stroke-width="2"/>'
    '<circle cx="20" cy="17" r="7" fill="#ffdbb5"/>'
    '<path d="M10 15a10 10 0 0 1 20 0Z" fill="#fbbf24"/>'
    '<path d="M20 4v9M8 15h24" stroke="#fef3c7" stroke-width="3" stroke-linecap="round"/>'
    '</svg>';

class _ServiceAddressMarker extends StatelessWidget {
  const _ServiceAddressMarker();
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      boxShadow: [BoxShadow(color: Color(0x55000000), blurRadius: 4)],
    ),
    child: SvgPicture.string(_serviceAddressSvg, width: 48, height: 60),
  );
}

class _TechnicianMarker extends StatelessWidget {
  const _TechnicianMarker();
  @override
  Widget build(BuildContext context) => Stack(
    alignment: Alignment.center,
    children: [
      Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFF10B981), width: 2),
        ),
      ),
      Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF047857),
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: const [
            BoxShadow(
              color: Color(0x44000000),
              blurRadius: 10,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Center(
          child: SvgPicture.string(_technicianSvg, width: 32, height: 32),
        ),
      ),
    ],
  );
}
