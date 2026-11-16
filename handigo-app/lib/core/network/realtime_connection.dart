import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../app/providers/app_providers.dart';
import '../../features/orders/presentation/order_screens.dart';
import '../../features/orders/presentation/order_payment_panel.dart';
import '../../features/provider/presentation/provider_screens.dart';
import '../../features/auth/domain/app_user.dart';
import '../../features/notifications/presentation/notification_screens.dart';
import '../../features/chat/presentation/chat_screens.dart';
import '../config/app_config.dart';
import 'api_client.dart';

final realtimeConnectionProvider = Provider<RealtimeConnection?>((ref) {
  final userId = ref.watch(
    authControllerProvider.select((auth) => auth.user?.id),
  );
  if (userId == null) return null;
  void refreshOrders() {
    ref.invalidate(orderListProvider);
    ref.invalidate(orderPageProvider);
    ref.invalidate(orderDetailProvider);
    ref.invalidate(orderQuotationProvider);
    ref.invalidate(orderPaymentsProvider);
    ref.invalidate(providerAssignmentsProvider);
    ref.invalidate(providerOrdersProvider);
    ref.invalidate(providerOrderPageProvider);
    ref.invalidate(providerScheduleOrdersProvider);
    ref.invalidate(providerOverviewProvider);
  }

  void refresh() {
    refreshOrders();
    ref.invalidate(notificationListProvider);
    ref.invalidate(conversationListProvider);
    ref.invalidate(providerNotificationBadgeProvider);
    ref.invalidate(providerMessageBadgeProvider);
  }

  final connection = RealtimeConnection(
    ref.read(apiClientProvider),
    refresh,
    reconcileOrders: refreshOrders,
    keepAliveInBackground: () =>
        !kIsWeb &&
        ref.read(authControllerProvider).user?.role == UserRole.provider &&
        ref.read(authControllerProvider).user?.providerOnboardingStatus ==
            'APPROVED' &&
        ['online', 'busy'].contains(
          ref.read(providerOverviewProvider).asData?.value.availabilityStatus,
        ),
  );
  final inboxEvents = connection.events.listen((event) {
    if (event.name == 'message:new' || event.name == 'message:seen') {
      ref.invalidate(conversationListProvider);
      ref.invalidate(providerMessageBadgeProvider);
    }
  });
  ref.onDispose(() => unawaited(inboxEvents.cancel()));
  ref.onDispose(connection.dispose);
  return connection;
});

class RealtimeConnection with WidgetsBindingObserver {
  RealtimeConnection(
    this.api,
    this.refresh, {
    this.keepAliveInBackground,
    this.reconcileOrders,
    this.socketFactory,
  }) {
    WidgetsBinding.instance.addObserver(this);
    _foreground =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    unawaited(connect());
    _fallback = Timer.periodic(const Duration(seconds: 20), (_) {
      if (!_disposed && _foreground) {
        // Đối soát qua HTTP cả khi socket còn kết nối nhưng bị lỡ sự kiện.
        _scheduleRefresh(ordersOnly: connected);
        if (!connected) unawaited(connect());
      }
    });
  }
  final ApiClient api;
  final VoidCallback refresh;
  final bool Function()? keepAliveInBackground;
  final VoidCallback? reconcileOrders;
  final io.Socket Function(String, Map<String, dynamic>)? socketFactory;
  final _events = StreamController<({String name, dynamic data})>.broadcast();
  Stream<({String name, dynamic data})> get events => _events.stream;
  io.Socket? _socket;
  Timer? _fallback, _refreshTimer;
  bool _foreground = true, _ordersOnly = true;
  Future<void>? _connecting;
  bool _active = true;
  bool _disposed = false, _refreshing = false, _authRetried = false;
  bool get connected => _socket?.connected == true;

  Future<void> connect() {
    if (_connecting != null) return _connecting!;
    late final Future<void> operation;
    operation = _connect().whenComplete(() {
      if (identical(_connecting, operation)) _connecting = null;
    });
    return _connecting = operation;
  }

  Future<void> _connect() async {
    if (_disposed || !_active) return;
    try {
      final token = await api.socketAccessToken();
      if (_disposed || !_active || token == null) return;
      if (_socket != null) {
        _socket!.auth = {'token': token};
        _socket!.connect();
        return;
      }
      final base = Uri.parse(AppConfig.apiBaseUrl);
      final io.Socket socket = (socketFactory ?? io.io)(base.origin, {
        'transports': ['websocket'],
        'autoConnect': false,
        'forceNew': true,
        'auth': {'token': token},
        'reconnectionAttempts': 5,
      });
      _socket = socket;
      socket.onConnect((_) {
        _authRetried = false;
        _scheduleRefresh();
        _emit('connect', null);
      });
      socket.onDisconnect((_) {
        if (!_disposed) _emit('disconnect', null);
      });
      socket.onConnectError((error) async {
        if (_disposed ||
            _refreshing ||
            _authRetried ||
            !'$error'.contains('xác thực')) {
          return;
        }
        _refreshing = true;
        _authRetried = true;
        try {
          final renewed = await api.socketAccessToken(renew: true);
          if (!_disposed && renewed != null) {
            socket.auth = {'token': renewed};
            socket.connect();
          }
        } catch (_) {
          /* Giao diện HTTP xử lý phiên hết hạn. */
        } finally {
          _refreshing = false;
        }
      });
      for (final event in [
        'order:updated',
        'provider:availability',
        'payment:status',
        'quotation:updated',
        'assignment:new',
        'direct-request:new',
        'assignment:closed',
        'notification:new',
      ]) {
        socket.on(event, (data) {
          if (!_disposed) {
            _scheduleRefresh();
            _emit(event, data);
          }
        });
      }
      for (final event in [
        'message:new',
        'message:seen',
        'order:location',
        'providers:changed',
      ]) {
        socket.on(event, (data) {
          if (!_disposed) _emit(event, data);
        });
      }
      socket.connect();
    } catch (_) {
      /* Cho phép tải lại dữ liệu qua HTTP khi socket chưa sẵn sàng. */
    }
  }

  void _emit(String name, dynamic data) {
    if (!_disposed) _events.add((name: name, data: data));
  }

  void _scheduleRefresh({bool ordersOnly = false}) {
    if (_disposed || !_foreground) return;
    _ordersOnly = _ordersOnly && ordersOnly;
    _refreshTimer ??= Timer(const Duration(milliseconds: 250), () {
      _refreshTimer = null;
      final onlyOrders = _ordersOnly;
      _ordersOnly = true;
      if (_disposed || !_foreground) return;
      if (onlyOrders && reconcileOrders != null) {
        reconcileOrders!();
      } else {
        refresh();
      }
    });
  }

  void emit(
    String event,
    Map<String, dynamic> data, {
    void Function(dynamic)? ack,
  }) => _socket?.emitWithAck(event, data, ack: ack);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _active =
        state == AppLifecycleState.resumed ||
        (state != AppLifecycleState.detached &&
            keepAliveInBackground?.call() == true);
    if (state == AppLifecycleState.resumed) {
      _scheduleRefresh();
      unawaited(connect());
    } else if (!_active &&
        (state == AppLifecycleState.paused ||
            state == AppLifecycleState.detached)) {
      _socket?.disconnect();
    }
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _fallback?.cancel();
    _refreshTimer?.cancel();
    _socket?.dispose();
    unawaited(_events.close());
  }
}
