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
  /// Chu kỳ gửi vị trí tự động lên hệ thống khi thợ bật nhận việc.
  static const checkInterval = Duration(minutes: 5);

  /// Thời gian thử lại khi lấy hoặc lưu vị trí lỗi.
  static const retryInterval = Duration(seconds: 30);

  /// Bỏ qua mẫu GPS nhiễu nếu lần lưu thành công gần nhất còn trong khoảng này.
  static const noisySampleGrace = Duration(minutes: 6);
  static const movementThreshold = 25.0;
  StreamSubscription<Position>? _positions;
  Timer? _watchdog;
  Position? _anchor;
  Position? _currentPosition;
  DateTime? _lastSampleAt, _lastSentAt;
  Future<void>? _operation;
  bool Function()? _shouldUpload;
  int _generation = 0;
  int? _operationGeneration;
  bool _tracking = false, _disposed = false;
  ApiException? error;
  bool get tracking => _tracking;
  Position? get synchronizedPosition => _anchor;
  Position? get currentPosition => _currentPosition ?? synchronizedPosition;

  LocationSettings get streamSettings {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25,
        intervalDuration: const Duration(seconds: 30),
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

  Future<void> synchronize({
    required bool Function() shouldUpload,
    bool useCachedPosition = false,
  }) {
    final generation = _generation;
    bool allowed() => !_disposed && generation == _generation && shouldUpload();
    return _run(() async {
      if (!allowed()) return;
      await _checkPermission(request: true);
      if (!allowed()) return;
      final recent = _currentPosition;
      final age = recent == null ? null : _now().difference(recent.timestamp);
      final position =
          useCachedPosition &&
              recent != null &&
              age != null &&
              !age.isNegative &&
              age <= const Duration(seconds: 30) &&
              recent.accuracy <= 25
          ? recent
          : await _readPosition();
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
        final sentAt = _lastSentAt;
        if (force ||
            error != null ||
            _lastSampleAt == null ||
            _now().difference(_lastSampleAt!) >= checkInterval ||
            sentAt == null ||
            _now().difference(sentAt) >= checkInterval) {
          await _accept(await _readPosition(), allowed, force: force);
        }
      });
    } catch (failure) {
      if (generation == _generation) _report(failure);
    } finally {
      _scheduleCheck(_nextCheckDelay());
    }
  }

  void _scheduleCheck([Duration delay = checkInterval]) {
    _watchdog?.cancel();
    if (_tracking && !_disposed) {
      _watchdog = Timer(delay, () => unawaited(check()));
    }
  }

  /// Lượt kiểm tra kế tiếp rơi vào lúc đến hạn gửi định kỳ; khi đang lỗi thì thử lại sớm.
  Duration _nextCheckDelay() {
    final sentAt = _lastSentAt;
    if (error != null || sentAt == null) return retryInterval;
    final remaining = checkInterval - _now().difference(sentAt);
    return remaining < retryInterval ? retryInterval : remaining;
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
                if (generation != _generation) return;
                _report(failure);
                _scheduleCheck(_nextCheckDelay());
              }),
            );
          },
          onError: (Object failure) {
            if (generation != _generation) return;
            final subscription = _positions;
            _positions = null;
            unawaited(subscription?.cancel());
            _report(failure);
            // Kết nối lại luồng GPS sớm thay vì chờ đến chu kỳ gửi định kỳ.
            _scheduleCheck(retryInterval);
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
      // Bỏ mẫu tự động nhiễu, giữ mốc vừa lưu; không gửi tọa độ kém chất lượng.
      final syncAge = _lastSentAt == null
          ? null
          : _now().difference(_lastSentAt!);
      if (!manual &&
          syncAge != null &&
          !syncAge.isNegative &&
          syncAge <= noisySampleGrace) {
        return;
      }
      throw const ApiException(
        'Vị trí chưa đủ chính xác hoặc đã cũ. Vui lòng ra nơi thoáng và thử lại.',
      );
    }
    if (!allowed() || _disposed) return;
    _currentPosition = position;
    notifyListeners();
    _lastSampleAt = _now();
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
    // Mốc đang lưu có sai số lớn thì cho phép thay bằng mẫu chính xác ngay.
    final upgradesCoarseAnchor = previous != null && previous.accuracy > 25;
    // Gửi tự động tối đa mỗi 5 phút, kể cả khi đang di chuyển, để vị trí trên hệ thống ổn định.
    if (!force &&
        (elapsed < const Duration(seconds: 5) ||
            (!upgradesCoarseAnchor && elapsed < checkInterval))) {
      _clearError();
      _scheduleCheck(_nextCheckDelay());
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
    if (moved && error == null) notifyListeners();
    _clearError();
    _scheduleCheck(_nextCheckDelay());
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
