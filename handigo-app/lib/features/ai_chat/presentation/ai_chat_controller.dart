import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../data/ai_chat_repository.dart';

final aiChatRepositoryProvider = Provider<AiChatRepository>(
  (ref) => AiChatRepository(ref.watch(apiClientProvider)),
);

final aiChatControllerProvider = ChangeNotifierProvider<AiChatController>((
  ref,
) {
  ref.watch(authControllerProvider.select((auth) => auth.user?.id));
  return AiChatController(ref.watch(aiChatRepositoryProvider));
});

String _newId() {
  final random = Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((value) => value.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

class AiChatController extends ChangeNotifier {
  AiChatController(this._repository) {
    load();
  }
  final AiChatRepository _repository;
  String _sessionId = _newId();
  Map<String, dynamic>? _pendingRequest;
  Map<String, dynamic>? session;
  bool busy = false;
  bool _disposed = false;
  String? error;

  List<Map<String, dynamic>> get messages =>
      (session?['messages'] as List? ?? []).cast<Map<String, dynamic>>();
  Map<String, dynamic>? get confirmation =>
      session?['pendingConfirmation'] as Map<String, dynamic>?;
  Map<String, dynamic>? get payment =>
      session?['payment'] as Map<String, dynamic>?;
  bool get needsReconciliation => session?['requiresReconciliation'] == true;
  bool get needsNewSession => session?['requiresNewSession'] == true;
  bool get canSend =>
      !busy &&
      error == null &&
      !needsReconciliation &&
      !needsNewSession &&
      _pendingRequest == null;
  bool get canReset =>
      !busy &&
      error == null &&
      confirmation == null &&
      !needsReconciliation &&
      _pendingRequest == null;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _apply(Map<String, dynamic> value) {
    session = value;
    _sessionId = value['sessionId'] as String;
    final interrupted = value['interruptedRequest'] as Map<String, dynamic>?;
    _pendingRequest = interrupted != null && !needsReconciliation
        ? {...interrupted, 'sessionId': _sessionId}
        : null;
    error = _pendingRequest == null
        ? null
        : 'Lượt xử lý trước bị gián đoạn. Nhấn Thử lại để tiếp tục.';
  }

  Future<void> _run(Future<void> Function() action) async {
    if (busy || _disposed) return;
    busy = true;
    error = null;
    _notify();
    try {
      await action();
    } catch (failure) {
      error = failure is ApiException
          ? failure.message
          : 'Trợ lý chưa thể trả lời. Vui lòng thử lại.';
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> load() => _run(() async {
    final latest = await _repository.latest();
    if (latest != null) _apply(latest);
  });

  Future<void> send(String text) async {
    final content = text.trim();
    if (!canSend || content.isEmpty || content.length > 4000) return;
    _pendingRequest = {
      'sessionId': _sessionId,
      'requestId': _newId(),
      'message': content,
    };
    await _submit();
  }

  Future<void> decide(String decision) async {
    if (!canSend ||
        confirmation == null ||
        !['CONFIRM', 'REJECT'].contains(decision)) {
      return;
    }
    _pendingRequest = {
      'sessionId': _sessionId,
      'requestId': _newId(),
      'confirmation': {
        'actionId': confirmation!['actionId'],
        'decision': decision,
      },
    };
    await _submit();
  }

  Future<void> checkPayment() async {
    if (!canSend || payment == null) return;
    _pendingRequest = {
      'sessionId': _sessionId,
      'requestId': _newId(),
      'paymentStatus': {'orderId': payment!['orderId']},
    };
    await _submit();
  }

  Future<void> _submit() => _run(() async {
    // Giữ nguyên requestId khi thử lại để tránh thực hiện thao tác hai lần.
    _apply(await _repository.send(Map.of(_pendingRequest!)));
  });

  Future<void> retry() => _pendingRequest != null ? _submit() : load();

  Future<void> reset() async {
    if (!canReset) return;
    await _run(() async => _apply(await _repository.reset(_sessionId)));
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
