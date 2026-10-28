import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/realtime_connection.dart';
import '../../../core/network/api_exception.dart';
import '../../auth/domain/app_user.dart';
import 'order_screens.dart';

class OrderTrackingScreen extends ConsumerStatefulWidget {
  const OrderTrackingScreen({
    required this.orderId,
    this.embedded = false,
    super.key,
  });
  final String orderId;
  final bool embedded;
  @override
  ConsumerState<OrderTrackingScreen> createState() =>
      _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends ConsumerState<OrderTrackingScreen>
    with WidgetsBindingObserver {
  final _mapController = MapController();
  bool _mapReady = false;
  StreamSubscription<dynamic>? events;
  StreamSubscription<Position>? positions;
  Timer? timer;
  Map<String, dynamic>? coordinates;
  Map<String, dynamic>? route;
  String? error;
  DateTime? updatedAt, sentAt;
  bool loading = false, active = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(() {
      if (!mounted) return;
      final connection = ref.read(realtimeConnectionProvider);
      events = connection?.events.listen((event) {
        if (event.name == 'connect') join();
        if (event.name == 'order:location' &&
            event.data is Map &&
            event.data['orderId'] == widget.orderId)
          join();
      });
      join();
      timer = Timer.periodic(const Duration(seconds: 20), (_) {
        if (active) join();
      });
    });
  }

  void join() {
    final order = ref.read(orderDetailProvider(widget.orderId)).asData?.value;
    if (order != null && !order.canTrack) return;
    final connection = ref.read(realtimeConnectionProvider);
    if (connection?.connected != true) {
      loadRoute();
      return;
    }
    connection!.emit(
      'order:tracking:join',
      {'orderId': widget.orderId},
      ack: (response) {
        if (!mounted || response is! Map) return;
        if (response['success'] == true && response['data'] is Map) {
          setState(() {
            coordinates = Map<String, dynamic>.from(response['data'] as Map);
            updatedAt = DateTime.now();
          });
          _fitMap();
          loadRoute();
        } else {
          setState(
            () => error = '${response['message'] ?? 'Chưa có dữ liệu vị trí.'}',
          );
        }
      },
    );
  }

  Future<void> loadRoute() async {
    if (loading || !mounted || !active) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final response = await ref
          .read(apiClientProvider)
          .request(
            '/orders/${widget.orderId}/tracking-route',
            authenticated: true,
          );
      final data = response['data'];
      if (data is! Map ||
          data['geometry'] is! Map ||
          data['distanceMeters'] is! num ||
          data['durationSeconds'] is! num)
        throw const FormatException();
      final points = ((data['geometry'] as Map)['coordinates'] as List?) ?? [];
      if (points.length < 2 ||
          points.any(
            (point) =>
                point is! List ||
                point.length < 2 ||
                point[0] is! num ||
                point[1] is! num ||
                !(point[0] as num).isFinite ||
                !(point[1] as num).isFinite ||
                (point[0] as num).abs() > 180 ||
                (point[1] as num).abs() > 90,
          ))
        throw const FormatException();
      if (mounted)
        setState(() {
          route = Map<String, dynamic>.from(data);
          updatedAt = DateTime.now();
        });
      _fitMap();
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể tải tuyến đường. Vui lòng thử lại.',
        );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> shareLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled())
        throw const ApiException('Vui lòng bật vị trí trên thiết bị.');
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied)
        permission = await Geolocator.requestPermission();
      if ([
        LocationPermission.denied,
        LocationPermission.deniedForever,
      ].contains(permission))
        throw const ApiException(
          'Chưa được cấp quyền vị trí. Bạn vẫn có thể xem thông tin đơn hàng.',
        );
      await positions?.cancel();
      positions =
          Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 20,
            ),
          ).listen(
            (position) {
              final order = ref
                  .read(orderDetailProvider(widget.orderId))
                  .asData
                  ?.value;
              if (!active ||
                  order?.canTrack != true ||
                  (sentAt != null &&
                      DateTime.now().difference(sentAt!).inSeconds < 5))
                return;
              sentAt = DateTime.now();
              ref
                  .read(realtimeConnectionProvider)
                  ?.emit(
                    'order:location:update',
                    {
                      'orderId': widget.orderId,
                      'latitude': position.latitude,
                      'longitude': position.longitude,
                    },
                    ack: (response) {
                      if (mounted &&
                          response is Map &&
                          response['success'] != true)
                        setState(() => error = '${response['message']}');
                    },
                  );
            },
            onError: (_) {
              if (mounted)
                setState(
                  () => error = 'Mất tín hiệu vị trí. Vui lòng thử lại.',
                );
            },
          );
      if (mounted) setState(() {});
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể chia sẻ vị trí.',
        );
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    active = state == AppLifecycleState.resumed;
    if (active)
      join();
    else {
      positions?.cancel();
      positions = null;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _mapController.dispose();
    timer?.cancel();
    events?.cancel();
    positions?.cancel();
    super.dispose();
  }

  LatLng? _coordinate(dynamic value) {
    if (value is! Map ||
        value['latitude'] is! num ||
        value['longitude'] is! num)
      return null;
    final lat = (value['latitude'] as num).toDouble();
    final lng = (value['longitude'] as num).toDouble();
    return lat.isFinite && lng.isFinite && lat.abs() <= 90 && lng.abs() <= 180
        ? LatLng(lat, lng)
        : null;
  }

  List<LatLng> get _routePoints => route == null
      ? []
      : ((route!['geometry'] as Map)['coordinates'] as List)
            .map(
              (point) => LatLng(
                (point[1] as num).toDouble(),
                (point[0] as num).toDouble(),
              ),
            )
            .toList();

  LatLng? get _destination {
    final order = ref.read(orderDetailProvider(widget.orderId)).asData?.value;
    return _coordinate({
      'latitude': order?.addressLatitude,
      'longitude': order?.addressLongitude,
    });
  }

  List<LatLng> get _displayPoints {
    final points = _routePoints;
    if (points.isNotEmpty) return points;
    final provider = _coordinate(coordinates?['provider']);
    final destination = _destination;
    return [provider, destination].whereType<LatLng>().toList();
  }

  void _fitMap() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_mapReady) return;
      final points = _displayPoints.toSet().toList();
      if (points.length > 1) {
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: LatLngBounds.fromPoints(points),
            padding: const EdgeInsets.all(32),
          ),
        );
      } else if (points.isNotEmpty) {
        _mapController.move(points.first, 14);
      }
    });
  }

  Widget _buildMap(
    List<LatLng> points, {
    bool hasRoute = true,
    bool providerKnown = true,
    bool destinationKnown = true,
  }) => SizedBox(
    height: 320,
    child: FlutterMap(
      key: ValueKey(widget.orderId),
      mapController: _mapController,
      options: MapOptions(
        onMapReady: () => _mapReady = true,
        initialCenter: points.first,
        initialZoom: 14,
        initialCameraFit: points.toSet().length > 1
            ? CameraFit.bounds(
                bounds: LatLngBounds.fromPoints(points),
                padding: const EdgeInsets.all(32),
              )
            : null,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.handigo.handigo_app',
        ),
        if (hasRoute)
          PolylineLayer(
            polylines: [
              Polyline(
                points: points,
                color: Theme.of(context).colorScheme.primary,
                strokeWidth: 5,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            if (providerKnown)
              Marker(
                point: points.first,
                child: const Tooltip(
                  message: 'Vị trí chuyên gia',
                  child: Icon(Icons.handyman, size: 36, color: Colors.blue),
                ),
              ),
            if (destinationKnown)
              Marker(
                point: points.last,
                child: const Tooltip(
                  message: 'Địa chỉ dịch vụ',
                  child: Icon(Icons.location_on, size: 36, color: Colors.red),
                ),
              ),
          ],
        ),
        RichAttributionWidget(
          attributions: [
            TextSourceAttribution(
              'OpenStreetMap contributors',
              onTap: () => launchUrl(
                Uri.parse('https://www.openstreetmap.org/copyright'),
              ),
            ),
          ],
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final order = ref.watch(orderDetailProvider(widget.orderId)).asData?.value;
    if (order != null && !order.canTrack && positions != null) {
      positions?.cancel();
      positions = null;
    }
    final points = _routePoints;
    if (widget.embedded) {
      final display = _displayPoints;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (display.isNotEmpty)
            _buildMap(
              display,
              hasRoute: points.isNotEmpty,
              providerKnown:
                  points.isNotEmpty ||
                  _coordinate(coordinates?['provider']) != null,
              destinationKnown: points.isNotEmpty || _destination != null,
            )
          else
            SizedBox(
              height: 240,
              child: ColoredBox(
                color: Theme.of(context).colorScheme.surfaceContainerLow,
                child: Center(
                  child: loading
                      ? const CircularProgressIndicator()
                      : const Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'Đang chờ vị trí chuyên gia và địa chỉ dịch vụ.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                ),
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                error!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          if (route != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                'Quãng đường: ${((route!['distanceMeters'] as num) / 1000).toStringAsFixed(1)} km · Dự kiến: ${((route!['durationSeconds'] as num) / 60).ceil()} phút',
              ),
            ),
        ],
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Theo dõi đơn hàng')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            order == null
                ? 'Đang tải thông tin đơn...'
                : 'Đơn ${order.code} · ${orderStatusLabel(order.status)}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (order?.addressLabel != null) Text(order!.addressLabel!),
          if (order != null && !order.canTrack)
            const Text(
              'Đơn chưa có thợ hoặc đã kết thúc. Không có theo dõi vị trí trực tiếp.',
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if (loading) const LinearProgressIndicator(),
          if (points.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildMap(points),
            Text(
              'Quãng đường: ${((route!['distanceMeters'] as num) / 1000).toStringAsFixed(1)} km · Dự kiến di chuyển: ${((route!['durationSeconds'] as num) / 60).ceil()} phút',
            ),
          ],
          if (updatedAt != null)
            Text(
              'Tải dữ liệu lúc ${TimeOfDay.fromDateTime(updatedAt!).format(context)}. Tuyến đường không thể hiện phần trăm hoàn thành công việc.',
            ),
          OutlinedButton(
            onPressed: loading ? null : join,
            child: const Text('Cập nhật vị trí và tuyến đường'),
          ),
          if (ref.watch(authControllerProvider).user?.role ==
                  UserRole.provider &&
              order?.canTrack == true)
            FilledButton(
              onPressed: positions == null ? shareLocation : null,
              child: Text(
                positions == null
                    ? 'Chia sẻ vị trí khi mở màn này'
                    : 'Đang chia sẻ vị trí',
              ),
            ),
          if (order != null)
            for (final event in order.statusHistory)
              ListTile(
                leading: const Icon(Icons.history),
                title: Text(orderStatusLabel(event.status)),
                subtitle: Text(event.createdAt?.toLocal().toString() ?? ''),
              ),
        ],
      ),
    );
  }
}
