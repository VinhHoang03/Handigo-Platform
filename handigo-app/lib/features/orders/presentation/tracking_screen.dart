import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../../../shared/widgets/app_states.dart';

class OrderTrackingScreen extends ConsumerWidget {
  const OrderTrackingScreen({required this.orderId, super.key});
  final String orderId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: const Text('Theo dõi đơn hàng'),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: Center(
            child: Text(
              '#${orderId.length > 8 ? orderId.substring(0, 8) : orderId}',
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ),
        ),
      ],
    ),
    body: FutureBuilder<Map<String, dynamic>>(
      future: ref.watch(orderTrackingProvider(orderId).future),
      builder: (_, snapshot) {
        if (!snapshot.hasData)
          return snapshot.hasError
              ? const AppMessage(message: 'Chưa thể tải vị trí theo dõi.')
              : const AppLoading();
        final raw = snapshot.data!['data'];
        final data = raw is Map<String, dynamic> ? raw : <String, dynamic>{};
        final status =
            '${data['status'] ?? data['orderStatus'] ?? 'in_progress'}';
        final progress = _progress(status);
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(orderTrackingProvider(orderId)),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              _TrackingStatusCard(
                status: status,
                progress: progress,
                data: data,
              ),
              const SizedBox(height: 14),
              _TrackingMapCard(data: data),
              const SizedBox(height: 14),
              _TrackingTimeline(status: status),
            ],
          ),
        );
      },
    ),
  );
}

final orderTrackingProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>(
      (ref, id) => ref
          .read(apiClientProvider)
          .request('/orders/$id/tracking-route', authenticated: true),
    );

double _progress(String status) => switch (status) {
  'completed' => 1,
  'accepted' => .45,
  'in_progress' => .7,
  'cancelled' => 0,
  _ => .2,
};

class _TrackingStatusCard extends StatelessWidget {
  const _TrackingStatusCard({
    required this.status,
    required this.progress,
    required this.data,
  });
  final String status;
  final double progress;
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final title = status == 'completed'
        ? 'Đã hoàn thành'
        : status == 'cancelled'
        ? 'Đã hủy'
        : status == 'accepted'
        ? 'Thợ đã nhận đơn'
        : 'Đang thực hiện';
    return Card(
      color: scheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: scheme.surfaceContainerLowest,
                  foregroundColor: scheme.primary,
                  child: Icon(
                    status == 'completed'
                        ? Icons.check
                        : Icons.home_repair_service_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${(progress * 100).round()}% tiến trình',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 9,
                backgroundColor: scheme.surface.withValues(alpha: .7),
                color: scheme.primary,
              ),
            ),
            if (data['estimatedMinutes'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  'Dự kiến còn ${data['estimatedMinutes']} phút',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TrackingMapCard extends StatelessWidget {
  const _TrackingMapCard({required this.data});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: Container(
      height: 168,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
      ),
      child: Stack(
        children: [
          Center(
            child: Icon(
              Icons.map_outlined,
              size: 58,
              color: Theme.of(
                context,
              ).colorScheme.primary.withValues(alpha: .45),
            ),
          ),
          Positioned(
            left: 14,
            top: 14,
            child: _MapLabel(
              icon: Icons.my_location,
              text: data['providerLocation'] == null
                  ? 'Đang chờ vị trí thợ'
                  : 'Vị trí thợ',
            ),
          ),
          Positioned(
            right: 14,
            bottom: 14,
            child: _MapLabel(
              icon: Icons.location_on,
              text: data['destination'] == null
                  ? 'Địa chỉ dịch vụ'
                  : '${data['destination']}',
            ),
          ),
        ],
      ),
    ),
  );
}

class _MapLabel extends StatelessWidget {
  const _MapLabel({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface.withValues(alpha: .9),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 5),
          Text(text, style: Theme.of(context).textTheme.labelSmall),
        ],
      ),
    ),
  );
}

class _TrackingTimeline extends StatelessWidget {
  const _TrackingTimeline({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final current = status == 'completed'
        ? 2
        : status == 'in_progress'
        ? 1
        : 0;
    const steps = [
      ('Đã tạo đơn', Icons.receipt_long_outlined),
      ('Thợ đang thực hiện', Icons.handyman_outlined),
      ('Hoàn tất dịch vụ', Icons.check_circle_outline),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tiến trình dịch vụ',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < steps.length; i++)
              _TimelineStep(
                title: steps[i].$1,
                icon: steps[i].$2,
                active: i <= current,
                last: i == steps.length - 1,
              ),
          ],
        ),
      ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.title,
    required this.icon,
    required this.active,
    required this.last,
  });
  final String title;
  final IconData icon;
  final bool active, last;
  @override
  Widget build(BuildContext context) {
    final color = active
        ? Theme.of(context).colorScheme.primary
        : Theme.of(context).colorScheme.outline;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Icon(icon, size: 21, color: color),
            if (!last)
              Container(
                width: 2,
                height: 29,
                color: color.withValues(alpha: .35),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            title,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: active ? FontWeight.w700 : FontWeight.w400,
              color: active
                  ? null
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}
