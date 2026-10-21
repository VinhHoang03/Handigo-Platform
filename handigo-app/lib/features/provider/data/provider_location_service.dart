import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';

class ProviderLocationService extends ChangeNotifier {
  ProviderLocationService(this._api, {DateTime Function()? now})
    : _now = now ?? DateTime.now;
  final ApiClient _api;
  final DateTime Function() _now;
  static const checkInterval = Duration(seconds: 30);
  static const movementThreshold = 25.0;
  StreamSubscription<Position>? _positions;
  Timer? _watchdog;
  Position? _anchor;
  DateTime? _lastSampleAt, _lastSentAt;
  Future<void>? _operation;
  bool Function()? _shouldUpload;
  int _generation = 0;
  int? _operationGeneration;
  bool _tracking = false, _disposed = false;
  ApiException? error;
  bool get tracking => _tracking;

  LocationSettings get streamSettings {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Handigo đang bật nhận việc',
          notificationChannelName: 'Vị trí khi nhận việc',
          notificationText:
              'Đang cập nhật vị trí để tìm đơn gần bạn. Tắt nhận việc để dừng.',
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25,
        allowBackgroundLocationUpdates: true,
        showBackgroundLocationIndicator: true,
        pauseLocationUpdatesAutomatically: false,
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 25,
    );
  }

  Future<void> synchronize({required bool Function() shouldUpload}) {
    final generation = _generation;
    bool allowed() => !_disposed && generation == _generation && shouldUpload();
    return _run(() async {
      if (!allowed()) return;
      await _checkPermission(request: true);
      if (!allowed()) return;
      final position = await _readPosition();
      await _accept(position, allowed, force: true, manual: true);
    }, afterRunning: true);
  }

  void start({required bool Function() shouldUpload}) {
    if (_tracking || _disposed) return;
    final generation = _generation;
    _shouldUpload = () => generation == _generation && shouldUpload();
    _tracking = true;
    _scheduleCheck();
    unawaited(check(force: _anchor == null));
  }

  Future<void> check({bool force = false}) async {
    final generation = _generation;
    final allowed = _shouldUpload;
    if (!_tracking || allowed == null || !allowed() || _disposed) return;
    try {
      await _run(() async {
        await _checkPermission();
        if (!_tracking || !allowed() || _disposed) return;
        _ensureStream();
        if (force ||
            _lastSampleAt == null ||
            _now().difference(_lastSampleAt!) >= checkInterval) {
          await _accept(await _readPosition(), allowed, force: force);
        }
      });
    } catch (failure) {
      if (generation == _generation) _report(failure);
    } finally {
      _scheduleCheck();
    }
  }

  void _scheduleCheck() {
    _watchdog?.cancel();
    if (_tracking && !_disposed) {
      _watchdog = Timer(checkInterval, () => unawaited(check()));
    }
  }

  void _ensureStream() {
    if (_positions != null || !_tracking || _disposed) return;
    final generation = _generation;
    _positions = Geolocator.getPositionStream(locationSettings: streamSettings)
        .listen(
          (position) {
            if (_operation != null || generation != _generation || !_tracking) {
              return;
            }
            final allowed = _shouldUpload;
            if (allowed == null) return;
            unawaited(
              _run(() => _accept(position, allowed)).catchError((
                Object failure,
              ) {
                if (generation == _generation) _report(failure);
              }),
            );
          },
          onError: (Object failure) {
            if (generation != _generation) return;
            final subscription = _positions;
            _positions = null;
            unawaited(subscription?.cancel());
            _report(failure);
          },
          onDone: () {
            if (generation == _generation) _positions = null;
          },
        );
  }

  Future<void> _checkPermission({bool request = false}) async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const ApiException('Vui lòng bật vị trí trên thiết bị.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied && request) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      throw const ApiException(
        'Quyền vị trí đang bị chặn. Vui lòng cấp quyền trong cài đặt thiết bị hoặc trình duyệt.',
      );
    }
    if (permission != LocationPermission.whileInUse &&
        permission != LocationPermission.always) {
      throw const ApiException('Vui lòng cấp quyền vị trí để bật nhận việc.');
    }
  }

  Future<Position> _readPosition() async {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      ).timeout(const Duration(seconds: 15));
    } on TimeoutException {
      throw const ApiException(
        'Lấy vị trí mất quá lâu. Vui lòng kiểm tra GPS và thử lại.',
      );
    } catch (_) {
      throw const ApiException(
        'Không lấy được vị trí. Vui lòng kiểm tra quyền vị trí và GPS của thiết bị rồi thử lại.',
      );
    }
  }

  Future<void> _accept(
    Position position,
    bool Function() allowed, {
    bool force = false,
    bool manual = false,
  }) async {
    final age = _now().difference(position.timestamp);
    if (!position.latitude.isFinite ||
        !position.longitude.isFinite ||
        position.latitude.abs() > 90 ||
        position.longitude.abs() > 180 ||
        !position.accuracy.isFinite ||
        position.accuracy < 0 ||
        (!manual && position.accuracy > 25) ||
        age > const Duration(seconds: 60) ||
        age < const Duration(seconds: -10)) {
      throw const ApiException(
        'Vị trí chưa đủ chính xác hoặc đã cũ. Vui lòng ra nơi thoáng và thử lại.',
      );
    }
    if (!allowed() || _disposed) return;
    _lastSampleAt = _now();
    _scheduleCheck();
    final previous = _anchor;
    final moved =
        manual ||
        previous == null ||
        previous.accuracy > 25 ||
        Geolocator.distanceBetween(
              previous.latitude,
              previous.longitude,
              position.latitude,
              position.longitude,
            ) >=
            math.max(movementThreshold, previous.accuracy + position.accuracy);
    final elapsed = _lastSentAt == null
        ? checkInterval
        : _now().difference(_lastSentAt!);
    if (!force &&
        ((!moved && elapsed < checkInterval) ||
            elapsed < const Duration(seconds: 5))) {
      _clearError();
      return;
    }
    final target = moved ? position : previous;
    final generation = _generation;
    try {
      await _api.request(
        '/locations/me',
        method: 'PUT',
        authenticated: true,
        data: {'latitude': target.latitude, 'longitude': target.longitude},
      );
    } catch (_) {
      throw const ApiException(
        'Đã lấy được vị trí nhưng chưa lưu được lên hệ thống. Vui lòng kiểm tra kết nối và thử lại.',
      );
    }
    if (_disposed || generation != _generation || !allowed()) return;
    if (moved) _anchor = position;
    _lastSentAt = _now();
    _clearError();
  }

  Future<void> _run(
    Future<void> Function() action, {
    bool afterRunning = false,
  }) {
    if (_disposed) return Future.value();
    final running = _operation;
    if (running != null) {
      if (_operationGeneration == _generation && !afterRunning) return running;
      return running.catchError((Object _) {}).then((_) => _run(action));
    }
    _operationGeneration = _generation;
    late final Future<void> operation;
    operation = Future<void>.sync(action).whenComplete(() {
      if (identical(_operation, operation)) _operation = null;
    });
    _operation = operation;
    return operation;
  }

  void _report(Object failure) {
    if (_disposed || !_tracking) return;
    error = failure is ApiException
        ? failure
        : const ApiException('Không thể cập nhật vị trí. Hệ thống sẽ thử lại.');
    notifyListeners();
  }

  void _clearError() {
    if (error == null || _disposed) return;
    error = null;
    notifyListeners();
  }

  void stop() {
    _tracking = false;
    _generation++;
    _watchdog?.cancel();
    _watchdog = null;
    final subscription = _positions;
    _positions = null;
    unawaited(subscription?.cancel());
    _shouldUpload = null;
    _anchor = null;
    _lastSampleAt = _lastSentAt = null;
    error = null;
  }

  @override
  void dispose() {
    _disposed = true;
    stop();
    super.dispose();
  }
}
