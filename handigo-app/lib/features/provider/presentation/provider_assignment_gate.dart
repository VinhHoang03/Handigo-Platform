import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/realtime_connection.dart';
import '../../auth/domain/app_user.dart';
import '../domain/provider_models.dart';
import 'provider_assignment_sound.dart';
import 'provider_screens.dart';
import 'provider_schedule_preview.dart';

typedef AssignmentRealtimeEvent = ({String name, dynamic data});
final assignmentNowProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

final assignmentRealtimeEventsProvider =
    StreamProvider.autoDispose<AssignmentRealtimeEvent>((ref) {
      return ref.watch(realtimeConnectionProvider)?.events ??
          const Stream.empty();
    });

class ProviderAssignmentGate extends ConsumerWidget {
  const ProviderAssignmentGate({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    if (!auth.isAuthenticated ||
        auth.user?.role != UserRole.provider ||
        auth.user?.providerOnboardingStatus != 'APPROVED' ||
        ref.watch(providerUiPreviewProvider) != null) {
      return child;
    }
    return _ActiveAssignmentGate(key: ValueKey(auth.user!.id), child: child);
  }
}

class _ActiveAssignmentGate extends ConsumerStatefulWidget {
  const _ActiveAssignmentGate({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<_ActiveAssignmentGate> createState() =>
      _ActiveAssignmentGateState();
}

class _ActiveAssignmentGateState extends ConsumerState<_ActiveAssignmentGate>
    with WidgetsBindingObserver {
  final _pending = <String, ProviderAssignment>{};
  final _closed = <String>{};
  final _announced = <String>{};
  Timer? _timer;
  String? _currentId, _error, _fullAddress;
  bool _busy = false, _foreground = true, _audioUnavailable = false;
  late final AssignmentAlertSound _sound;
  ProviderAssignment? get _current => _pending[_currentId];
  DateTime get _now => ref.read(assignmentNowProvider)();

  @override
  void initState() {
    super.initState();
    _sound = ref.read(assignmentAlertSoundProvider);
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual(providerAssignmentsProvider, (_, next) {
      if (next.isLoading || next.hasError) return;
      final items = next.asData?.value;
      if (items != null) _update(items, replace: true);
    }, fireImmediately: true);
    ref.listenManual(assignmentRealtimeEventsProvider, (_, next) {
      final event = next.asData?.value;
      if (event == null) return;
      if (event.name == 'connect') {
        ref.invalidate(providerAssignmentsProvider);
        return;
      }
      if (event.data is! Map) return;
      final payload = event.data as Map;
      if (event.name == 'assignment:closed') {
        final id = payload['assignmentId'];
        if (id is String) {
          _closed.add(id);
          _update(
            _pending.values.where((item) => item.id != id).toList(),
            replace: true,
          );
        }
        ref.invalidate(providerAssignmentsProvider);
      }
      if (event.name == 'assignment:new' ||
          event.name == 'direct-request:new') {
        final raw = payload['assignment'];
        if (raw is Map && raw['status'] == 'pending' && raw['orderId'] is Map) {
          try {
            final item = ProviderAssignment.fromJson(
              Map<String, dynamic>.from(raw),
            );
            if (item.id != 'null' && item.orderId != 'null') _update([item]);
          } catch (_) {
            // Tải lại từ API khi payload realtime chưa đủ thông tin.
          }
        }
        ref.invalidate(providerAssignmentsProvider);
      }
    });
  }

  void _update(List<ProviderAssignment> items, {bool replace = false}) {
    if (!mounted) return;
    final previous = _currentId;
    setState(() {
      if (replace) {
        _pending.removeWhere((id, _) => !items.any((item) => item.id == id));
      }
      final now = _now;
      for (final item in items) {
        if (!_closed.contains(item.id) &&
            item.responseDeadline?.isAfter(now) == true) {
          _pending[item.id] = item;
        }
      }
      _pending.removeWhere(
        (id, item) =>
            _closed.contains(id) || item.responseDeadline?.isAfter(now) != true,
      );
      if (!_pending.containsKey(_currentId)) {
        _currentId = _pending.keys.firstOrNull;
      }
      if (previous != _currentId) {
        _error = null;
        _fullAddress = null;
        _audioUnavailable = false;
      }
    });
    if (_pending.isEmpty) {
      _timer?.cancel();
      _timer = null;
    } else {
      _timer ??= Timer.periodic(const Duration(seconds: 1), (_) {
        final expired = _pending.values
            .where((item) => !item.responseDeadline!.isAfter(_now))
            .map((item) => item.id)
            .toList();
        _closed.addAll(expired);
        _update(_pending.values.toList());
        if (expired.isNotEmpty) ref.invalidate(providerAssignmentsProvider);
      });
    }
    if (_currentId != previous) unawaited(_sound.stop());
    final item = _current;
    if (item != null && item.id != previous) {
      unawaited(_loadAddress(item));
    }
    if (_foreground && item != null && _announced.add(item.id)) {
      unawaited(_playSound(item.id));
    }
  }

  Future<void> _loadAddress(ProviderAssignment item) async {
    try {
      final orders = await ref.read(providerRepositoryProvider).recentOrders();
      if (!mounted || _currentId != item.id) return;
      final address = orders
          .where((order) => order.id == item.orderId)
          .firstOrNull
          ?.addressLabel;
      if (address?.trim().isNotEmpty == true) {
        setState(() => _fullAddress = address!.trim());
      }
    } catch (_) {
      // Giữ địa chỉ từ đơn chờ khi chưa tải được địa chỉ đầy đủ.
    }
  }

  Future<void> _playSound(String id) async {
    await _sound.stop();
    if (!mounted || !_foreground || _currentId != id) return;
    final played = await _sound.play();
    if (mounted && _currentId == id) {
      setState(() => _audioUnavailable = !played);
    }
  }

  Future<void> _respond(bool accept) async {
    final item = _current;
    if (_busy || item == null || !item.responseDeadline!.isAfter(_now)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    unawaited(_sound.stop());
    try {
      final repository = ref.read(providerRepositoryProvider);
      if (accept) {
        await repository.acceptAssignment(item.id);
      } else {
        await repository.rejectAssignment(item.id, '');
      }
      if (!mounted) return;
      _closed.add(item.id);
      _update(
        _pending.values.where((pending) => pending.id != item.id).toList(),
        replace: true,
      );
      ref.invalidate(providerAssignmentsProvider);
      ref.invalidate(providerOrdersProvider);
      ref.invalidate(providerOrderPageProvider);
      ref.invalidate(providerScheduleOrdersProvider);
      ref.invalidate(providerOverviewProvider);
    } catch (error) {
      if (mounted && _currentId == item.id) {
        setState(
          () => _error = error is ApiException
              ? error.message
              : 'Không thể phản hồi đơn. Vui lòng thử lại.',
        );
        ref.invalidate(providerAssignmentsProvider);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _foreground = true;
      ref.invalidate(providerAssignmentsProvider);
      setState(() {});
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      _foreground = false;
      unawaited(_sound.stop());
      _update(const [], replace: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    unawaited(_sound.stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = _foreground ? _current : null;
    final amountLabel = item?.totalAmount?.isFinite == true
        ? NumberFormat.currency(
            locale: 'vi_VN',
            symbol: 'đ',
            decimalDigits: 0,
          ).format(item!.totalAmount)
        : null;
    return Stack(
      children: [
        ExcludeFocus(
          excluding: item != null,
          child: ExcludeSemantics(excluding: item != null, child: widget.child),
        ),
        if (item != null) ...[
          const Positioned.fill(
            child: ModalBarrier(dismissible: false, color: Colors.black54),
          ),
          Positioned.fill(
            child: Center(
              child: AlertDialog(
                backgroundColor: Colors.white,
                surfaceTintColor: Colors.transparent,
                insetPadding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 24,
                ),
                contentPadding: const EdgeInsets.fromLTRB(24, 18, 24, 18),
                content: SizedBox(
                  width: 360,
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Bạn có đơn hàng mới',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                            color: Colors.black,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Divider(height: 1, color: Colors.black),
                        const SizedBox(height: 10),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Text(
                                item.serviceName,
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'Còn ${_countdown(item.responseDeadline!, _now)}',
                              style: TextStyle(
                                fontSize: 13,
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text.rich(
                          TextSpan(
                            text: 'Mã đơn: ',
                            children: [
                              TextSpan(
                                text: item.orderCode,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (item.serviceType == 'fixed_price') ...[
                          const SizedBox(height: 8),
                          Text(
                            'Giá trị đơn hàng: ${amountLabel ?? 'Chưa có thông tin giá'}',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ],
                        if ((_fullAddress ?? item.addressLabel)?.isNotEmpty ==
                            true) ...[
                          const SizedBox(height: 8),
                          Text(
                            formatAssignmentAddress(
                              _fullAddress ?? item.addressLabel!,
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          item.orderType == 'immediate' ||
                                  item.scheduledAt == null
                              ? 'Thời gian thực hiện: Bây giờ'
                              : 'Thời gian thực hiện: ${DateFormat('HH:mm dd/MM/yyyy').format(item.scheduledAt!.toLocal())}',
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ],
                        if (_audioUnavailable)
                          TextButton.icon(
                            onPressed: () => _playSound(item.id),
                            icon: const Icon(Icons.volume_up_outlined),
                            label: const Text('Bật âm báo'),
                          ),
                      ],
                    ),
                  ),
                ),
                actionsPadding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                actions: [
                  SizedBox(
                    height: 12 + MediaQuery.textScalerOf(context).scale(24) * 2,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              backgroundColor: Colors.white,
                              minimumSize: const Size(0, 60),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            onPressed: _busy ? null : () => _respond(false),
                            child: const Text('Từ chối'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 60),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            onPressed: _busy ? null : () => _respond(true),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    _busy ? 'Đang xử lý...' : 'Đồng ý',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ),
                                if (amountLabel != null) ...[
                                  const SizedBox(height: 4),
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      amountLabel,
                                      style: const TextStyle(
                                        fontSize: 22,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

String _countdown(DateTime deadline, DateTime now) {
  final seconds = ((deadline.difference(now).inMilliseconds + 999) ~/ 1000)
      .clamp(0, 864000);
  return '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
}
