import 'dart:async';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/realtime_connection.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  Completer<String?>? token;
  @override
  Future<String?> socketAccessToken({bool renew = false}) async =>
      token == null ? 'test-session' : await token!.future;
}

class _Socket extends Fake implements io.Socket {
  final handlers = <String, Function>{};
  @override
  bool connected = false;
  @override
  dynamic auth;
  int connections = 0;
  @override
  Function() on(String event, void Function(dynamic) handler) {
    handlers[event] = handler;
    return () => handlers.remove(event);
  }

  @override
  io.Socket connect() {
    connections++;
    return this;
  }

  @override
  io.Socket disconnect() {
    connected = false;
    return this;
  }

  @override
  void dispose() {}
  void receive(String event, [dynamic data]) {
    if (event == 'connect') connected = true;
    if (event == 'disconnect') connected = false;
    handlers[event]?.call(data);
  }
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized()
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  });
  testWidgets('Gộp sự kiện đơn, báo giá và thanh toán thành một lượt đồng bộ', (
    tester,
  ) async {
    final api = _Api();
    final socket = _Socket();
    var refreshes = 0;
    final connection = RealtimeConnection(
      api,
      () => refreshes++,
      socketFactory: (_, _) => socket,
    );
    addTearDown(connection.dispose);
    addTearDown(api.close);
    await tester.pump();
    expect(socket.handlers.keys, contains('order:updated'));
    socket.receive('connect');
    socket.receive('order:updated', {'orderId': 'order'});
    socket.receive('quotation:updated', {'orderId': 'order'});
    socket.receive('payment:status', {'orderId': 'order'});
    expect(refreshes, 0);
    await tester.pump(const Duration(milliseconds: 250));
    expect(refreshes, 1);
    connection.dispose();
  });

  testWidgets(
    'Socket còn kết nối vẫn đối soát đơn sau 20 giây nếu lỡ sự kiện',
    (tester) async {
      final api = _Api();
      final socket = _Socket()..connected = true;
      var orders = 0, refreshes = 0;
      final connection = RealtimeConnection(
        api,
        () => refreshes++,
        reconcileOrders: () => orders++,
        socketFactory: (_, _) => socket,
      );
      addTearDown(connection.dispose);
      addTearDown(api.close);
      await tester.pump();
      await tester.pump(const Duration(seconds: 20));
      await tester.pump(const Duration(milliseconds: 250));
      expect(orders, 1);
      expect(refreshes, 0);
      connection.dispose();
    },
  );

  testWidgets('Mở lại app và kết nối lại đều đồng bộ dữ liệu đã bỏ lỡ', (
    tester,
  ) async {
    final api = _Api();
    final socket = _Socket();
    var refreshes = 0;
    final connection = RealtimeConnection(
      api,
      () => refreshes++,
      keepAliveInBackground: () => true,
      socketFactory: (_, _) => socket,
    );
    addTearDown(connection.dispose);
    addTearDown(api.close);
    await tester.pump();
    connection.didChangeAppLifecycleState(AppLifecycleState.paused);
    socket.receive('order:updated');
    await tester.pump(const Duration(seconds: 21));
    expect(refreshes, 0);
    connection.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await tester.pump();
    socket.receive('connect');
    await tester.pump(const Duration(milliseconds: 250));
    expect(refreshes, 1);
    socket.receive('disconnect');
    socket.receive('connect');
    await tester.pump(const Duration(milliseconds: 250));
    expect(refreshes, 2);
    connection.dispose();
  });

  testWidgets('Không tạo hai socket khi các lượt kết nối cùng chờ token', (
    tester,
  ) async {
    final api = _Api()..token = Completer<String?>();
    final socket = _Socket();
    var sockets = 0, refreshes = 0;
    final connection = RealtimeConnection(
      api,
      () => refreshes++,
      socketFactory: (_, _) {
        sockets++;
        return socket;
      },
    );
    addTearDown(api.close);
    final first = connection.connect();
    final second = connection.connect();
    api.token!.complete('test-session');
    await first;
    await second;
    expect(sockets, 1);
    socket.receive('order:updated');
    connection.dispose();
    await tester.pump(const Duration(seconds: 21));
    expect(refreshes, 0);
  });
}
