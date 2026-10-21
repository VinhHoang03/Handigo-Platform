import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class PendingBookingStore {
  const PendingBookingStore();
  static const _storage = FlutterSecureStorage();
  String _key(String userId) => 'handigo_pending_booking_$userId';
  Future<void> save(String userId, String orderId) =>
      _storage.write(key: _key(userId), value: orderId);
  Future<String?> read(String userId) => _storage.read(key: _key(userId));
  Future<void> clear(String userId) => _storage.delete(key: _key(userId));
}
