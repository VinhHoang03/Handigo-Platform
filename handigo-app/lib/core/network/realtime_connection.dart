import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../app/providers/app_providers.dart';
import '../../features/orders/presentation/order_screens.dart';
import '../../features/orders/presentation/order_payment_panel.dart';
import '../../features/provider/presentation/provider_screens.dart';
import '../../features/notifications/presentation/notification_screens.dart';
import '../../features/chat/presentation/chat_screens.dart';
import '../config/app_config.dart';
import 'api_client.dart';

final realtimeConnectionProvider = Provider<RealtimeConnection?>((ref) {
  final userId = ref.watch(
    authControllerProvider.select((auth) => auth.user?.id),
  );
  if (userId == null) return null;
  void refresh() {
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
    ref.invalidate(notificationListProvider);
    ref.invalidate(conversationListProvider);
  }

  final connection = RealtimeConnection(ref.read(apiClientProvider), refresh);
  ref.onDispose(connection.dispose);
  return connection;
});

class RealtimeConnection with WidgetsBindingObserver {
  RealtimeConnection(this.api, this.refresh) {
    WidgetsBinding.instance.addObserver(this);
    unawaited(connect());
    _fallback = Timer.periodic(const Duration(seconds: 20), (_) {
      if (!_disposed && _active && !connected) refresh();
    });
  }
  final ApiClient api;
  final VoidCallback refresh;
  final _events = StreamController<({String name, dynamic data})>.broadcast();
  Stream<({String name, dynamic data})> get events => _events.stream;
  io.Socket? _socket;
  Timer? _fallback;
  bool _active = true;
  bool _disposed = false, _refreshing = false, _authRetried = false;
  bool get connected => _socket?.connected == true;

  Future<void> connect() async {
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
      final socket = io.io(base.origin, {
        'transports': ['websocket'],
        'autoConnect': false,
        'forceNew': true,
        'auth': {'token': token},
        'reconnectionAttempts': 5,
      });
      _socket = socket;
      socket.onConnect((_) {
        _authRetried = false;
        refresh();
        _emit('connect', null);
      });
      socket.onConnectError((error) async {
        if (_disposed ||
            _refreshing ||
            _authRetried ||
            !'$error'.contains('xác thực'))
          return;
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
        'quotation:updated',
        'assignment:new',
        'direct-request:new',
        'assignment:closed',
        'notification:new',
      ]) {
        socket.on(event, (data) {
          if (!_disposed) {
            refresh();
            _emit(event, data);
          }
        });
      }
      for (final event in ['message:new', 'message:seen', 'order:location']) {
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

  void emit(
    String event,
    Map<String, dynamic> data, {
    void Function(dynamic)? ack,
  }) => _socket?.emitWithAck(event, data, ack: ack);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _active = state == AppLifecycleState.resumed;
    if (state == AppLifecycleState.resumed) {
      refresh();
      unawaited(connect());
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _socket?.disconnect();
    }
  }

  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _fallback?.cancel();
    _socket?.dispose();
    unawaited(_events.close());
  }
}
