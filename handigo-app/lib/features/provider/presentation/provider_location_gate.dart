import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers/app_providers.dart';
import '../../auth/domain/app_user.dart';
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
        auth.user?.role != UserRole.provider ||
        auth.user?.providerOnboardingStatus != 'APPROVED' ||
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
      _online = data.availabilityStatus == 'online';
      if (_online && _foreground) {
        _service.start(shouldUpload: _canUpload);
      } else if (!_online || kIsWeb) {
        _service.stop();
      }
    }, fireImmediately: true);
  }

  bool _canUpload() =>
      mounted &&
      _online &&
      ref.read(authControllerProvider).isAuthenticated &&
      ref.read(authControllerProvider).user?.id == _userId &&
      ref.read(authControllerProvider).user?.role == UserRole.provider &&
      ref.read(authControllerProvider).user?.providerOnboardingStatus ==
          'APPROVED';

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (state == AppLifecycleState.detached) {
      _service.stop();
    } else if (_foreground && _online) {
      _service.start(shouldUpload: _canUpload);
      unawaited(_service.check(force: true));
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
  Widget build(BuildContext context) => widget.child;
}
