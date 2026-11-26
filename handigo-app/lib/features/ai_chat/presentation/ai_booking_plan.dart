import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'ai_chat_controller.dart';

class AiBookingPlan extends ConsumerWidget {
  const AiBookingPlan({super.key, required this.enabled});
  final bool enabled;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(aiChatControllerProvider);
    final plan = controller.session?['bookingPlan'] as Map?;
    if (plan == null) return const SizedBox.shrink();
    final items = (plan['items'] as List? ?? []).whereType<Map>().toList();
    final current = items
        .where((item) => item['id'] == plan['activeItemId'])
        .firstOrNull;
    final live = ['active', 'paused'].contains(plan['status']);
    final allowed =
        enabled &&
        controller.canSend &&
        (controller.confirmation == null ||
            controller.confirmation!['tool'] == 'create_booking');
    const labels = {
      'queued': 'Chờ soạn',
      'active': 'Đang soạn',
      'blocked': 'Để lại',
      'created': 'Đã tạo đơn',
      'skipped': 'Đã bỏ',
    };
    Widget button(String action, String label, [String? itemId]) =>
        OutlinedButton(
          onPressed: allowed
              ? () => controller.managePlan(action, itemId: itemId)
              : null,
          child: Text(label),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Yêu cầu đặt dịch vụ (${items.where((item) => item['status'] == 'created').length}/${items.length} đã tạo đơn)',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            for (final item in items) ...[
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Text(
                  '${item['label']} · ${labels[item['status']] ?? item['status']}${item['orderCode'] == null ? '' : ' · ${item['orderCode']}'}',
                ),
              ),
              if (live && item['status'] == 'blocked')
                button(
                  'resume',
                  'Tiếp tục ${item['label']}',
                  item['id'] as String,
                ),
            ],
            Text(
              plan['note'] as String? ??
                  'Mỗi đơn có xác nhận riêng. Bỏ danh sách không hủy các đơn đã tạo.',
            ),
            if (live)
              Wrap(
                spacing: 8,
                children: [
                  if (plan['status'] == 'paused')
                    button('resume', 'Tiếp tục danh sách')
                  else ...[
                    if (current?['status'] == 'active') ...[
                      button('defer', 'Để lại yêu cầu'),
                      button('skip', 'Bỏ yêu cầu'),
                    ] else
                      button('next', 'Yêu cầu tiếp theo'),
                    button('pause', 'Tạm dừng danh sách'),
                  ],
                  button('cancel', 'Bỏ các yêu cầu chưa tạo'),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
