import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../orders/domain/order_summary.dart';
import '../domain/provider_models.dart';
import 'provider_screens.dart';

final providerAssignmentOrdersProvider =
    FutureProvider.autoDispose<List<OrderSummary>>(retry: (_, _) => null, (
      ref,
    ) {
      ref.watch(authControllerProvider.select((auth) => auth.user?.id));
      ref.watch(providerAssignmentsProvider);
      return ref.watch(providerRepositoryProvider).recentOrders();
    });

bool _valid(double? latitude, double? longitude) =>
    latitude != null &&
    longitude != null &&
    latitude.isFinite &&
    longitude.isFinite &&
    latitude.abs() <= 90 &&
    longitude.abs() <= 180;
bool _fresh(Position? position) {
  if (position == null || !_valid(position.latitude, position.longitude)) {
    return false;
  }
  final age = DateTime.now().difference(position.timestamp);
  return age <= const Duration(seconds: 60) &&
      age >= const Duration(seconds: -10);
}

typedef AssignmentDestinationQuery = ({
  double? latitude,
  double? longitude,
  String? address,
  String? ward,
  String? province,
});
final providerAssignmentDestinationProvider = FutureProvider.autoDispose
    .family<
      ({double latitude, double longitude, bool approximate}),
      AssignmentDestinationQuery
    >(retry: (_, _) => null, (ref, query) {
      ref.watch(authControllerProvider.select((auth) => auth.user?.id));
      if (_valid(query.latitude, query.longitude)) {
        return (
          latitude: query.latitude!,
          longitude: query.longitude!,
          approximate: false,
        );
      }
      if ([
        query.address,
        query.ward,
        query.province,
      ].any((value) => value?.trim().isNotEmpty != true)) {
        throw const ApiException(
          'Địa chỉ khách chưa đủ thông tin để tính khoảng cách.',
        );
      }
      return ref
          .watch(providerRepositoryProvider)
          .assignmentCoordinates(query.address!, query.ward!, query.province!)
          .timeout(const Duration(seconds: 15));
    });

final providerAssignmentPositionProvider = FutureProvider.autoDispose<Position>(
  retry: (_, _) => null,
  (ref) async {
    final owner = ref.watch(
      authControllerProvider.select((auth) => auth.user?.id),
    );
    final tracker = ref.watch(providerLocationServiceProvider.notifier);
    final pending = ref.keepAlive();
    try {
      await tracker
          .synchronize(
            shouldUpload: () =>
                ref.mounted &&
                owner != null &&
                ref.read(authControllerProvider).user?.id == owner,
          )
          .timeout(const Duration(seconds: 20));
    } catch (_) {
      if (!_fresh(tracker.currentPosition)) rethrow;
    } finally {
      pending.close();
    }
    final position = tracker.currentPosition;
    if (!_fresh(position)) {
      throw const ApiException(
        'Bật GPS và cho phép truy cập vị trí để xem khoảng cách.',
      );
    }
    return position!;
  },
);

typedef _OrderDistance = ({double? distance, bool loading, bool approximate});

_OrderDistance _watchOrderDistance(WidgetRef ref, OrderSummary order) {
  final current = ref.watch(
    providerLocationServiceProvider.select(
      (service) => service.currentPosition,
    ),
  );
  final fresh = _fresh(current);
  final gps = fresh ? null : ref.watch(providerAssignmentPositionProvider);
  final position = fresh ? current : gps?.asData?.value;
  final destination = ref.watch(
    providerAssignmentDestinationProvider((
      latitude: order.addressLatitude,
      longitude: order.addressLongitude,
      address: null,
      ward: null,
      province: null,
    )),
  );
  final target = destination.asData?.value;
  final failure = gps?.error ?? destination.error;
  double? distance;
  if (position != null && target != null) {
    distance = Geolocator.distanceBetween(
      position.latitude,
      position.longitude,
      target.latitude,
      target.longitude,
    );
  }
  return (
    distance: distance,
    loading: distance == null && failure == null,
    approximate: target?.approximate ?? false,
  );
}

/// Vòng xoay đặt cạnh trạng thái đơn khi đang đo khoảng cách; ẩn khi xong hoặc lỗi.
class ProviderOrderDistanceSpinner extends ConsumerWidget {
  const ProviderOrderDistanceSpinner({required this.order, super.key});
  final OrderSummary order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!_watchOrderDistance(ref, order).loading) {
      return const SizedBox.shrink();
    }
    return const SizedBox(
      width: 16,
      height: 16,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }
}

/// Khoảng cách tới nơi đến; không hiện gì nếu chưa đo được.
class ProviderOrderDistance extends ConsumerWidget {
  const ProviderOrderDistance({required this.order, super.key});
  final OrderSummary order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = _watchOrderDistance(ref, order);
    final distance = state.distance;
    if (distance == null) return const SizedBox.shrink();
    final amount = distance < 1000
        ? '${distance.round()} m'
        : '${NumberFormat('0.0', 'vi_VN').format(distance / 1000)} km';
    final text = state.approximate
        ? 'Cách khu vực khách khoảng $amount (ước tính theo địa chỉ)'
        : 'Cách nơi đến khoảng $amount';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.near_me_outlined, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: Theme.of(context).textTheme.bodySmall),
        ),
      ],
    );
  }
}

class ProviderAssignmentCustomerInfo extends ConsumerWidget {
  const ProviderAssignmentCustomerInfo({
    required this.orderId,
    this.order,
    this.assignment,
    this.showName = true,
    super.key,
  });
  final String orderId;
  final OrderSummary? order;
  final ProviderAssignment? assignment;
  final bool showName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final details =
        order ??
        ref
            .watch(providerAssignmentOrdersProvider)
            .asData
            ?.value
            .where((item) => item.id == orderId)
            .firstOrNull;
    final current = ref.watch(
      providerLocationServiceProvider.select(
        (service) => service.currentPosition,
      ),
    );
    final fresh = _fresh(current);
    final gps = fresh ? null : ref.watch(providerAssignmentPositionProvider);
    final position = fresh ? current : gps?.asData?.value;
    final query = (
      latitude: assignment?.addressLatitude ?? details?.addressLatitude,
      longitude: assignment?.addressLongitude ?? details?.addressLongitude,
      address: assignment?.fullAddress,
      ward: assignment?.ward,
      province: assignment?.province,
    );
    final destination = ref.watch(providerAssignmentDestinationProvider(query));
    final target = destination.asData?.value;
    double? distance;
    if (position != null && target != null) {
      distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        target.latitude,
        target.longitude,
      );
    }
    final name = details?.customerName?.trim();
    Widget line(IconData icon, String text) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20),
        const SizedBox(width: 8),
        Expanded(child: Text(text)),
      ],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showName) ...[
          line(
            Icons.person_outline,
            'Khách hàng: ${name?.isNotEmpty == true ? name : 'Chưa có tên khách hàng'}',
          ),
          const SizedBox(height: 6),
        ],
        // Chỉ hiện khi đã đo được; không đo được thì ẩn hoàn toàn.
        if (distance != null)
          line(
            Icons.near_me_outlined,
            '${target!.approximate ? 'Đến khu vực khách khoảng' : 'Cách bạn khoảng'} ${distance < 1000 ? '${distance.round()} m' : '${NumberFormat('0.0', 'vi_VN').format(distance / 1000)} km'}${target.approximate ? ' (ước tính theo địa chỉ)' : ''}',
          ),
      ],
    );
  }
}
