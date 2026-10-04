import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/domain/app_user.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/auth_screens.dart';
import '../../features/home/presentation/customer_shell.dart';
import '../../features/service_catalog/presentation/service_catalog_screens.dart';
import '../../features/orders/presentation/order_screens.dart';
import '../../features/orders/presentation/tracking_screen.dart';
import '../../features/notifications/presentation/notification_screens.dart';
import '../../features/chat/presentation/chat_screens.dart';
import '../../features/account/presentation/account_screens.dart';
import '../../features/provider_onboarding/presentation/provider_onboarding_screens.dart';
import '../../features/provider/presentation/provider_screens.dart';
import '../../features/provider/presentation/provider_order_detail_screen.dart';
import '../../features/provider/presentation/provider_account_screens.dart';
import '../providers/app_providers.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider.notifier);
  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: auth,
    redirect: (context, state) {
      final location = state.matchedLocation;
      if (auth.status == AuthStatus.initializing) {
        return location == '/splash' ? null : '/splash';
      }
      final isAuthRoute = {
        '/login',
        '/register',
        '/register/otp',
        '/forgot-password',
        '/forgot-password/reset',
        '/forgot-password/new-password',
      }.contains(location);
      if (!auth.isAuthenticated && !isAuthRoute) {
        return '/login';
      }
      if (location == '/forgot-password/new-password' &&
          state.extra is! ResetPasswordArguments) {
        return '/forgot-password';
      }
      if (auth.isAuthenticated &&
          auth.user?.role == UserRole.provider &&
          auth.user?.providerOnboardingStatus != 'APPROVED' &&
          location != '/customer/provider-onboarding') {
        return '/customer/provider-onboarding';
      }
      if (auth.isAuthenticated &&
          auth.user?.role == UserRole.provider &&
          location.startsWith('/customer') &&
          location != '/customer/provider-onboarding') {
        return '/provider';
      }
      if (auth.isAuthenticated && (isAuthRoute || location == '/splash')) {
        return auth.user!.role == UserRole.provider ? '/provider' : '/customer';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: '/register/otp',
        builder: (_, state) => OtpScreen(
          email: state.uri.queryParameters['email'] ?? '',
          mode: OtpMode.register,
          expiresAt: state.extra is DateTime ? state.extra as DateTime : null,
        ),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/forgot-password/reset',
        builder: (_, state) => OtpScreen(
          email: state.uri.queryParameters['email'] ?? '',
          mode: OtpMode.resetPassword,
          expiresAt: state.extra is DateTime ? state.extra as DateTime : null,
        ),
      ),
      GoRoute(
        path: '/forgot-password/new-password',
        builder: (_, state) => state.extra is ResetPasswordArguments
            ? ResetPasswordScreen(
                arguments: state.extra as ResetPasswordArguments,
              )
            : const ForgotPasswordScreen(),
      ),
      GoRoute(path: '/customer', builder: (_, __) => const CustomerShell()),
      GoRoute(
        path: '/customer/notifications',
        builder: (_, __) => const NotificationCenterScreen(),
      ),
      GoRoute(
        path: '/customer/orders',
        builder: (_, __) => const OrderListScreen(),
      ),
      GoRoute(
        path: '/customer/orders/:id',
        builder: (_, state) =>
            OrderDetailScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/customer/orders/:id/tracking',
        builder: (_, state) =>
            OrderTrackingScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/customer/chat',
        builder: (_, __) => const ConversationListScreen(),
      ),
      GoRoute(
        path: '/customer/chat/order/:id',
        builder: (_, state) =>
            ChatByOrderScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/customer/account',
        builder: (_, __) => const AccountOverviewScreen(),
      ),
      GoRoute(
        path: '/customer/profile',
        builder: (_, __) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/customer/addresses',
        builder: (_, __) => const AddressScreen(),
      ),
      GoRoute(
        path: '/customer/wallet',
        builder: (_, __) => const WalletScreen(),
      ),
      GoRoute(
        path: '/customer/vouchers',
        builder: (_, __) => const VoucherScreen(),
      ),
      GoRoute(
        path: '/customer/feedback',
        builder: (_, __) => const FeedbackScreen(),
      ),
      GoRoute(
        path: '/customer/support',
        builder: (_, __) => const SupportScreen(),
      ),
      GoRoute(
        path: '/customer/complaints',
        builder: (_, __) => const ComplaintScreen(),
      ),
      GoRoute(
        path: '/customer/settings',
        builder: (_, __) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/customer/provider-onboarding',
        builder: (_, __) => const ProviderOnboardingScreen(),
      ),
      GoRoute(
        path: '/customer/services',
        builder: (_, state) => ServiceCatalogScreen(
          initialSearch: state.uri.queryParameters['q'],
          initialCategoryId: state.uri.queryParameters['categoryId'],
        ),
      ),
      GoRoute(
        path: '/customer/services/:id',
        builder: (_, state) =>
            ServiceDetailScreen(serviceId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/customer/bookings/new/:serviceId',
        builder: (_, state) =>
            BookingRouteScreen(serviceId: state.pathParameters['serviceId']!),
      ),
      GoRoute(
        path: '/customer/bookings/success',
        builder: (_, state) {
          final data = state.extra is Map
              ? state.extra! as Map
              : const <String, dynamic>{};
          return BookingSuccessScreen(
            orderId: data['orderId'] as String?,
            orderCode: data['orderCode'] as String?,
            paymentStatus: data['paymentStatus'] as String?,
            checkoutUrl: data['checkoutUrl'] as String?,
          );
        },
      ),
      GoRoute(path: '/provider', builder: (_, __) => const ProviderShell()),
      GoRoute(
        path: '/provider/orders/:id',
        builder: (_, state) =>
            ProviderOrderDetailScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/provider/profile',
        builder: (_, __) => const ProviderProfileScreen(),
      ),
      GoRoute(
        path: '/provider/wallet',
        builder: (_, __) => const ProviderWalletScreen(),
      ),
      GoRoute(
        path: '/provider/banks',
        builder: (_, __) => const ProviderBankAccountsScreen(),
      ),
      GoRoute(
        path: '/provider/feedback',
        builder: (_, __) => const ProviderFeedbackScreen(),
      ),
      GoRoute(
        path: '/provider/notifications',
        builder: (_, __) => const NotificationCenterScreen(),
      ),
      GoRoute(
        path: '/provider/settings',
        builder: (_, __) => const ProviderSettingsScreen(),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
