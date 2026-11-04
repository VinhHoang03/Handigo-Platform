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
          .assignmentCoordinates(query.address!, query.ward!, query.province!);
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
      await tracker.synchronize(
        shouldUpload: () =>
            ref.mounted &&
            owner != null &&
            ref.read(authControllerProvider).user?.id == owner,
      );
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

class ProviderAssignmentCustomerInfo extends ConsumerWidget {
  const ProviderAssignmentCustomerInfo({
    required this.orderId,
    this.order,
    this.assignment,
    super.key,
  });
  final String orderId;
  final OrderSummary? order;
  final ProviderAssignment? assignment;

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
    final failure = gps?.error ?? destination.error;
    final label = distance == null
        ? failure is ApiException
              ? failure.message
              : failure != null
              ? 'Chưa tải được vị trí để tính khoảng cách. Vui lòng thử lại.'
              : 'Đang tính khoảng cách…'
        : '${target!.approximate ? 'Đến khu vực khách khoảng' : 'Cách bạn khoảng'} ${distance < 1000 ? '${distance.round()} m' : '${NumberFormat('0.0', 'vi_VN').format(distance / 1000)} km'}${target.approximate ? ' (ước tính theo địa chỉ)' : ''}';
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
        line(
          Icons.person_outline,
          'Khách hàng: ${name?.isNotEmpty == true ? name : 'Chưa có tên khách hàng'}',
        ),
        const SizedBox(height: 6),
        line(Icons.near_me_outlined, label),
        if (distance == null && failure != null)
          TextButton(
            onPressed: () {
              ref.invalidate(providerAssignmentPositionProvider);
              ref.invalidate(providerAssignmentDestinationProvider(query));
              ref.invalidate(providerAssignmentOrdersProvider);
            },
            child: const Text('Thử lại khoảng cách'),
          ),
      ],
    );
  }
}
