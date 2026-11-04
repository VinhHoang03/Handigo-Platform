import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/utils/address_format.dart';
import '../../../shared/widgets/map_surface.dart';

class _LocationCache {
  LatLng? point;
  DateTime? updatedAt;
  final addresses = <String, Map<String, String>>{};
  final pending = <String, Future<Map<String, String>>>{};
  LatLng? get recent =>
      updatedAt != null &&
          DateTime.now().difference(updatedAt!) < const Duration(minutes: 2)
      ? point
      : null;
}

// Chỉ giữ trong bộ nhớ của phiên app, không lưu vị trí xuống thiết bị.
final _locationCacheProvider = Provider((ref) => _LocationCache());

class AddBookingAddressSheet extends ConsumerStatefulWidget {
  const AddBookingAddressSheet({super.key});
  @override
  ConsumerState<AddBookingAddressSheet> createState() =>
      _AddBookingAddressSheetState();
}

class _AddBookingAddressSheetState
    extends ConsumerState<AddBookingAddressSheet> {
  final _map = MapController();
  bool _mapMounted = false;
  LatLng? _cameraTarget;
  bool _programmaticMove = false, _cameraMoving = false;
  int _interaction = 0;
  LatLng? _point;
  Map<String, String>? _address;
  bool _locating = false, _resolving = false, _saving = false;
  bool _quietResolution = false;
  int _request = 0;
  Timer? _cameraDebounce;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(
      ref
          .read(mapReadyProvider.future)
          .then((ready) {
            if (mounted && ready) return _locate(choose: false);
          })
          .catchError((Object _) {}),
    );
  }

  void _center(LatLng point, {bool fit = false, bool animate = true}) {
    _cameraTarget = point;
    if (!_mapMounted) return;
    _programmaticMove = true;
    _map.move(point, fit ? 16 : 18);
    _programmaticMove = false;
  }

  void _cameraStarted() {
    if (_programmaticMove || _saving) return;
    ++_interaction;
    ++_request;
    setState(() {
      _cameraMoving = true;
      _resolving = false;
      _address = null;
      _error = null;
    });
  }

  void _cameraIdle() {
    if (_programmaticMove) {
      _programmaticMove = false;
      return;
    }
    if (!_cameraMoving || _saving) return;
    setState(() => _cameraMoving = false);
    final target = _cameraTarget;
    if (target != null) unawaited(_choose(target, center: false));
  }

  Future<void> _locate({bool choose = true}) async {
    if (_locating || _saving) return;
    final interaction = ++_interaction;
    final cache = ref.read(_locationCacheProvider);
    final cached = cache.recent;
    if (cached != null) {
      _center(cached, fit: true, animate: choose);
      if (choose) {
        await _choose(cached, center: false, quiet: true);
      } else {
        unawaited(_prefetch(cached));
      }
      return;
    }
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled().timeout(
        const Duration(seconds: 5),
      )) {
        throw const ApiException('Vui lòng bật vị trí trên thiết bị.');
      }
      var permission = await Geolocator.checkPermission().timeout(
        const Duration(seconds: 5),
      );
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) {
        throw const ApiException(
          'Vui lòng cho phép truy cập vị trí trong cài đặt ứng dụng hoặc trình duyệt, rồi thử lại.',
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      ).timeout(const Duration(seconds: 20));
      if (!mounted || interaction != _interaction) return;
      if (!position.latitude.isFinite ||
          !position.longitude.isFinite ||
          position.latitude.abs() > 90 ||
          position.longitude.abs() > 180) {
        throw const ApiException(
          'Vị trí thiết bị không hợp lệ. Vui lòng chọn trên bản đồ.',
        );
      }
      final point = LatLng(position.latitude, position.longitude);
      cache.point = point;
      cache.updatedAt = DateTime.now();
      _center(point, fit: true, animate: choose);
      setState(() => _locating = false);
      if (choose) {
        await _choose(point, center: false, quiet: true);
      } else {
        unawaited(_prefetch(point));
      }
    } on TimeoutException {
      if (mounted && interaction == _interaction) {
        setState(
          () => _error =
              'Lấy vị trí mất quá lâu. Vui lòng thử lại hoặc chọn trên bản đồ.',
        );
      }
    } catch (error) {
      if (mounted && interaction == _interaction) {
        setState(
          () => _error = error is ApiException
              ? error.message
              : 'Chưa lấy được vị trí. Vui lòng kiểm tra quyền vị trí hoặc chọn trên bản đồ.',
        );
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  String _key(LatLng point) =>
      '${point.latitude.toStringAsFixed(6)},${point.longitude.toStringAsFixed(6)}';

  Future<void> _choose(
    LatLng point, {
    bool center = true,
    bool quiet = false,
  }) async {
    if (_saving) return;
    _cameraDebounce?.cancel();
    ++_interaction;
    setState(() {
      _cameraMoving = false;
      _point = point;
      _address = null;
      _error = null;
    });
    if (center) _center(point);
    await _resolve(point, quiet: quiet);
  }

  Future<void> _prefetch(LatLng point) async {
    try {
      await _fetch(point);
    } catch (_) {
      // Chỉ hiện lỗi khi người dùng chọn vị trí, không chặn thao tác bản đồ.
    }
  }

  Future<Map<String, String>> _fetch(LatLng point) {
    final cache = ref.read(_locationCacheProvider);
    final key = _key(point);
    final cached = cache.addresses[key];
    if (cached != null) return Future.value(cached);
    final pending = cache.pending[key];
    if (pending != null) return pending;
    final operation = _loadAddress(point)
        .then((address) {
          if (cache.addresses.length >= 30) {
            cache.addresses.remove(cache.addresses.keys.first);
          }
          cache.addresses[key] = address;
          return address;
        })
        .whenComplete(() {
          cache.pending.remove(key);
        });
    cache.pending[key] = operation;
    return operation;
  }

  Future<Map<String, String>> _loadAddress(LatLng point) async {
    final response = await ref
        .read(apiClientProvider)
        .request(
          '/locations/reverse-geocode',
          query: {'latitude': point.latitude, 'longitude': point.longitude},
          authenticated: true,
          receiveTimeout: const Duration(seconds: 15),
        )
        .timeout(
          const Duration(seconds: 20),
          onTimeout: () => throw const ApiException(
            'Yêu cầu tra địa chỉ đã hết thời gian chờ. Vui lòng thử lại.',
            code: 'GEO_REQUEST_TIMEOUT',
          ),
        );
    final data = response['data'];
    if (data is! Map ||
        [
          'fullAddress',
          'province',
          'ward',
        ].any((key) => '${data[key] ?? ''}'.trim().isEmpty)) {
      throw const ApiException(
        'Chưa xác định đủ địa chỉ tại ghim. Vui lòng chọn vị trí khác hoặc thử lại.',
        code: 'GEO_INVALID_RESPONSE',
      );
    }
    return {
      'fullAddress': '${data['fullAddress']}',
      'province': '${data['province']}',
      'ward': '${data['ward']}',
      'latitude': '${point.latitude}',
      'longitude': '${point.longitude}',
    };
  }

  Future<Map<String, String>?> _resolve(
    LatLng point, {
    bool quiet = false,
  }) async {
    final request = ++_request;
    final cached = ref.read(_locationCacheProvider).addresses[_key(point)];
    if (cached != null) {
      setState(() {
        _address = cached;
        _resolving = false;
      });
      return cached;
    }
    setState(() {
      _resolving = true;
      _quietResolution = quiet;
      _error = null;
    });
    try {
      final address = await _fetch(point);
      if (!mounted || request != _request) return null;
      setState(() => _address = address);
      return address;
    } catch (error) {
      if (mounted && request == _request) {
        setState(
          () => _error = error is ApiException
              ? error.diagnosticMessage
              : 'Chưa tra được địa chỉ tại ghim. Vui lòng thử lại.',
        );
      }
      return null;
    } finally {
      if (mounted && request == _request) setState(() => _resolving = false);
    }
  }

  Future<void> _select() async {
    if (_locating || _saving || _resolving || _cameraMoving || _point == null) {
      return;
    }
    setState(() => _saving = true);
    final address = _address ?? await _resolve(_point!);
    if (!mounted) return;
    if (address != null) Navigator.pop(context, address);
    setState(() => _saving = false);
  }

  @override
  void dispose() {
    _cameraDebounce?.cancel();
    ++_interaction;
    ++_request;
    _map.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final busy = _locating || _resolving || _saving || _cameraMoving;
    final mapsReady = ref.watch(mapReadyProvider).asData?.value == true;
    final label = _address == null
        ? (_point == null
              ? 'Chưa chọn vị trí'
              : '${_point!.latitude.toStringAsFixed(5)}, ${_point!.longitude.toStringAsFixed(5)}')
        : formatAddress(
            _address!['fullAddress']!,
            ward: _address!['ward']!,
            province: _address!['province']!,
            fromMap: true,
          );
    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .82,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 8, 4),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryFixed,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.add_location_alt_rounded,
                      color: Theme.of(context).colorScheme.primary,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Thêm địa chỉ',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đóng',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'Kéo bản đồ hoặc chạm để ghim đúng cửa nhà, rồi chọn vị trí.',
              ),
            ),
            Expanded(
              child: Stack(
                children: [
                  Listener(
                    onPointerDown: (_) => _programmaticMove = false,
                    child: MapSurface(
                      map: FlutterMap(
                        mapController: _map,
                        options: MapOptions(
                          initialCenter:
                              ref.read(_locationCacheProvider).recent ??
                              const LatLng(16.0471, 108.2068),
                          initialZoom: 5,
                          maxZoom: 19,
                          onMapReady: () {
                            _mapMounted = true;
                            if (_cameraTarget case final point?) {
                              _center(point, fit: true, animate: false);
                            }
                          },
                          onTap: (_, point) {
                            if (!_saving) unawaited(_choose(point));
                          },
                          onPositionChanged: (camera, hasGesture) {
                            if (hasGesture) {
                              if (!_cameraMoving) _cameraStarted();
                              _cameraTarget = camera.center;
                              _cameraDebounce?.cancel();
                              _cameraDebounce = Timer(
                                const Duration(milliseconds: 350),
                                _cameraIdle,
                              );
                            }
                          },
                        ),
                        children: [const MapTiles(), mapAttribution()],
                      ),
                    ),
                  ),
                  if (mapsReady && (_point != null || _cameraMoving))
                    Center(
                      child: IgnorePointer(
                        child: Transform.translate(
                          offset: Offset(0, -24),
                          child: Icon(
                            Icons.location_pin,
                            size: 48,
                            color: Colors.red,
                          ),
                        ),
                      ),
                    ),
                  if (_saving)
                    const Positioned.fill(
                      child: AbsorbPointer(child: SizedBox.expand()),
                    ),
                  if (_saving || (_resolving && !_quietResolution))
                    Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          color: Theme.of(context).colorScheme.primary,
                          backgroundColor: Colors.transparent,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Text(
                _error ?? label,
                key: const ValueKey('selected-address'),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        shape: const StadiumBorder(),
                        minimumSize: const Size(0, 56),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                      onPressed: !mapsReady || _locating || _saving
                          ? null
                          : _locate,
                      child: const Text(
                        'Lấy vị trí hiện tại',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        shape: const StadiumBorder(),
                        minimumSize: const Size(0, 56),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                      onPressed: !mapsReady || busy || _point == null
                          ? null
                          : _select,
                      child: const Text(
                        'Chọn vị trí này',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
