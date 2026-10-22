import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/routing/app_router.dart';
import 'app/theme/app_theme.dart';
import 'core/network/realtime_connection.dart';
import 'features/booking/presentation/booking_provider.dart';
import 'features/provider/presentation/provider_assignment_gate.dart';
import 'features/provider/presentation/provider_location_gate.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: HandigoApp()));
}

class HandigoApp extends ConsumerWidget {
  const HandigoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(realtimeConnectionProvider);
    ref.watch(bookingDraftPersistenceProvider);
    return MaterialApp.router(
      title: 'Handigo',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.light,
      routerConfig: ref.watch(appRouterProvider),
      locale: const Locale('vi', 'VN'),
      supportedLocales: const [Locale('vi', 'VN'), Locale('en', 'US')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) => ProviderLocationGate(
        child: ProviderAssignmentGate(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
