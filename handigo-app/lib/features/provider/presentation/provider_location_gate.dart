import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../app/providers/app_providers.dart';
import '../data/provider_location_service.dart';
import 'provider_schedule_preview.dart';
import 'provider_screens.dart';

class ProviderLocationGate extends ConsumerWidget {
  const ProviderLocationGate({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    if (!auth.isAuthenticated ||
        auth.user?.canAccessProvider != true ||
        ref.watch(providerUiPreviewProvider) != null) {
      return child;
    }
    return _ActiveProviderLocationGate(
      key: ValueKey(auth.user!.id),
      child: child,
    );
  }
}

class _ActiveProviderLocationGate extends ConsumerStatefulWidget {
  const _ActiveProviderLocationGate({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<_ActiveProviderLocationGate> createState() =>
      _ProviderLocationGateState();
}

class _ProviderLocationGateState
    extends ConsumerState<_ActiveProviderLocationGate>
    with WidgetsBindingObserver {
  late final ProviderLocationService _service;
  late final String _userId;
  bool _online = false;
  bool _foreground = true;
  bool _showAlwaysPrompt = false, _alwaysPromptDismissed = false;

  @override
  void initState() {
    super.initState();
    _userId = ref.read(authControllerProvider).user!.id;
    _service = ref.read(providerLocationServiceProvider);
    _foreground =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual(providerOverviewProvider, (_, next) {
      final data = next.asData?.value;
      if (data == null) return;
      // Đang thực hiện đơn (busy) vẫn phải gửi vị trí để khách theo dõi thợ.
      _online = const ['online', 'busy'].contains(data.availabilityStatus);
      if (_online && _foreground) {
        _service.start(shouldUpload: _canUpload);
        unawaited(_refreshAlwaysPrompt());
      } else if (!_online || kIsWeb) {
        _service.stop();
      }
    }, fireImmediately: true);
  }

  /// Nhắc thợ chọn "Luôn cho phép" để vị trí không bị ngắt khi chuyển app khác.
  Future<void> _refreshAlwaysPrompt() async {
    if (_alwaysPromptDismissed || !_online) return;
    final needs = await _service.needsAlwaysPermission();
    if (!mounted || needs == _showAlwaysPrompt) return;
    setState(() => _showAlwaysPrompt = needs);
  }

  bool _canUpload() =>
      mounted &&
      _online &&
      ref.read(authControllerProvider).isAuthenticated &&
      ref.read(authControllerProvider).user?.id == _userId &&
      ref.read(authControllerProvider).user?.canAccessProvider == true;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (state == AppLifecycleState.detached) {
      _service.stop();
    } else if (_foreground && _online) {
      _service.start(shouldUpload: _canUpload);
      unawaited(_service.check(force: true));
      unawaited(_refreshAlwaysPrompt());
    } else if (kIsWeb &&
        (state == AppLifecycleState.hidden ||
            state == AppLifecycleState.paused)) {
      _service.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _service.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_showAlwaysPrompt) return widget.child;
    final scheme = Theme.of(context).colorScheme;
    return Stack(
      children: [
        widget.child,
        Positioned(
          left: 16,
          right: 16,
          bottom: 16,
          child: SafeArea(
            child: Material(
              elevation: 6,
              borderRadius: BorderRadius.circular(16),
              color: scheme.surface,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Cho phép vị trí luôn bật',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Để nhận đơn gần bạn khi chuyển sang ứng dụng khác, hãy chọn Vị trí → "Luôn cho phép" trong cài đặt.',
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: () => setState(() {
                            _alwaysPromptDismissed = true;
                            _showAlwaysPrompt = false;
                          }),
                          child: const Text('Để sau'),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: () =>
                              unawaited(Geolocator.openAppSettings()),
                          child: const Text('Mở cài đặt'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
