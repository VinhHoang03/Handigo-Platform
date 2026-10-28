import 'package:flutter/services.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../../../shared/widgets/booking_details_summary.dart';
import '../../../shared/widgets/provider_avatar.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../shared/widgets/service_images.dart';
import '../domain/order_summary.dart';
import 'order_screens.dart';
import '../../chat/presentation/order_chat_button.dart';

class OrderDetailOverview extends StatelessWidget {
  const OrderDetailOverview({
    required this.order,
    this.providerView = false,
    super.key,
  });
  final bool providerView;
  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final contactName = providerView ? order.customerName : order.providerName;
    final contactAvatar = providerView
        ? order.customerAvatar
        : order.providerAvatar;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                ...[
                  SizedBox(
                    width: 68,
                    height: 68,
                    child: ServiceCoverImage(
                      url: order.serviceImage,
                      name: order.serviceName,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: Text(
                              order.serviceName,
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: OrderStatusBadge(
                                label: providerView
                                    ? orderStatusLabel(order.status)
                                    : customerOrderStatusLabel(order.summary),
                                color: customerOrderStatusColor(
                                  theme,
                                  providerView
                                      ? order.status
                                      : order.summary.customerDisplayStatus,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Mã đơn: ${order.code}',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            BookingDetailsSummary(
              address: order.addressLabel?.isNotEmpty == true
                  ? order.addressLabel!
                  : 'Chưa có thông tin địa chỉ',
              scheduledAt: order.scheduledAt,
              placedAt: order.createdAt,
              compact: true,
            ),
            if (!providerView && contactName?.isNotEmpty == true) ...[
              const SizedBox(height: 12),
              Text(
                providerView ? 'Khách hàng' : 'Thợ thực hiện',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  ProviderAvatar(
                    url: contactAvatar,
                    gender: providerView ? null : order.providerGender,
                    size: 44,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: providerView ? 1 : 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          contactName!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (!providerView) ...[
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                color: Colors.amber,
                                size: 16,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  order.providerRating == null ||
                                          order.providerRating == 0
                                      ? 'Chưa có đánh giá'
                                      : '${order.providerRating!.toStringAsFixed(1)}/5',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (!providerView &&
                      order.providerId?.isNotEmpty == true &&
                      [
                        'accepted',
                        'in_progress',
                        'completed',
                      ].contains(order.status)) ...[
                    const SizedBox(width: 8),
                    Flexible(
                      flex: 4,
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: OrderChatButton(
                          orderId: order.id,
                          status: order.status,
                          hasProvider: true,
                          label: 'Nhắn tin với thợ',
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
            if (providerView) ...[
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.person_outline_rounded, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                order.customerName?.isNotEmpty == true
                                    ? order.customerName!
                                    : 'Khách hàng',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.phone_outlined, size: 20),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                order.customerPhone?.trim().isNotEmpty == true
                                    ? order.customerPhone!
                                    : 'Chưa có số điện thoại',
                                style: theme.textTheme.bodyMedium,
                              ),
                            ),
                            if (order.customerPhone?.trim().isNotEmpty == true)
                              IconButton(
                                tooltip: 'Sao chép số điện thoại',
                                iconSize: 18,
                                visualDensity: VisualDensity.compact,
                                onPressed: () async {
                                  await Clipboard.setData(
                                    ClipboardData(
                                      text: order.customerPhone!.trim(),
                                    ),
                                  );
                                  if (context.mounted)
                                    AppToast.show(
                                      context,
                                      'Đã sao chép số điện thoại.',
                                    );
                                },
                                icon: const Icon(Icons.copy_outlined),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    flex: 2,
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: OrderChatButton(
                        orderId: order.id,
                        status: order.status,
                        hasProvider: order.providerId?.isNotEmpty == true,
                        providerView: true,
                        label: 'Nhắn tin',
                      ),
                    ),
                  ),
                ],
              ),
            ],
            if (providerView &&
                order.problemDescription?.isNotEmpty == true) ...[
              const SizedBox(height: 12),
              Text('Mô tả yêu cầu', style: theme.textTheme.titleSmall),
              const SizedBox(height: 4),
              Text(order.problemDescription!),
            ],
          ],
        ),
      ),
    );
  }
}

class OrderQuotationSection extends StatelessWidget {
  const OrderQuotationSection({required this.quotation, super.key});
  final RepairQuotation quotation;

  @override
  Widget build(BuildContext context) {
    String money(num value) =>
        '${NumberFormat.decimalPattern('vi_VN').format(value)} đ';
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Báo giá của thợ',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            for (final item in quotation.items) ...[
              Text(item.title),
              Text(
                '${money(item.unitPrice)} × ${item.quantity} = ${money(item.unitPrice * item.quantity)}',
              ),
              if (item.description?.isNotEmpty == true) Text(item.description!),
              if (item.note?.isNotEmpty == true) Text(item.note!),
              const SizedBox(height: 12),
            ],
            if (quotation.discountAmount > 0)
              Text('Giảm giá báo giá: −${money(quotation.discountAmount)}'),
            Text(
              'Tổng báo giá: ${money(quotation.finalAmount)}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (quotation.estimatedDurationMinutes != null)
              Text(
                'Thời gian dự kiến: ${quotation.estimatedDurationMinutes} phút',
              ),
            if (quotation.inspectionNote?.isNotEmpty == true)
              Text('Ghi chú kiểm tra: ${quotation.inspectionNote}'),
            if (quotation.recommendation?.isNotEmpty == true)
              Text('Đề xuất của thợ: ${quotation.recommendation}'),
            if (quotation.directPaymentConfirmedAt != null)
              const Text('Thợ đã xác nhận nhận tiền trực tiếp.'),
          ],
        ),
      ),
    );
  }
}

class OrderProgressTimeline extends StatelessWidget {
  const OrderProgressTimeline({required this.order, super.key});
  final OrderDetail order;

  List<OrderStatusEvent> get _events {
    final events = List<OrderStatusEvent>.of(order.statusHistory);
    if (events.isEmpty || events.first.status != 'created') {
      events.insert(
        0,
        OrderStatusEvent(status: 'created', createdAt: order.createdAt),
      );
    }
    final statuses = events.where(
      (event) => [
        'created',
        'accepted',
        'in_progress',
        'completed',
        'cancelled',
      ].contains(event.status),
    );
    if (statuses.last.status != order.status) {
      events.add(
        OrderStatusEvent(
          status: order.status,
          createdAt: order.status == 'cancelled'
              ? order.cancelledAt ?? order.updatedAt
              : order.updatedAt,
        ),
      );
    }
    return events;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final events = _events;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'THEO DÕI TIẾN ĐỘ',
                    style: TextStyle(
                      fontSize: 13,
                      color: scheme.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: OrderStatusBadge(
                      label: customerOrderStatusLabel(order.summary),
                      color: customerOrderStatusColor(
                        Theme.of(context),
                        order.summary.customerDisplayStatus,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            for (var index = 0; index < events.length; index++)
              Builder(
                builder: (context) {
                  final event = events[index];
                  final last = index == events.length - 1;
                  final cancelled = event.status == 'cancelled';
                  final active =
                      last &&
                      !['completed', 'cancelled'].contains(order.status);
                  final reassigned =
                      event.status == 'created' &&
                      index > 0 &&
                      (event.previousStatus == 'accepted' ||
                          events[index - 1].status == 'accepted');
                  final color = cancelled ? scheme.error : scheme.primary;
                  final title = reassigned
                      ? 'Tìm thợ thay thế'
                      : switch (event.status) {
                          'created' => 'Đã tạo đơn hàng',
                          'accepted' => 'Chuyên gia đã nhận đơn',
                          'in_progress' => 'Đang thực hiện dịch vụ',
                          'completed' => 'Đã hoàn tất dịch vụ',
                          'cancelled' => 'Đơn hàng đã hủy',
                          'paid' => 'Đã thanh toán',
                          'assigned' => 'Đã điều phối chuyên gia',
                          _ => orderStatusLabel(event.status),
                        };
                  final reason =
                      order.cancellationReason?.trim().isNotEmpty == true
                      ? order.cancellationReason!
                      : event.note;
                  final description = cancelled
                      ? reason?.trim().isNotEmpty == true
                            ? 'Lý do hủy: $reason'
                            : 'Đơn hàng đã được hủy.'
                      : event.note?.trim().isNotEmpty == true
                      ? event.note!
                      : reassigned
                      ? 'Handigo đang tìm chuyên gia khác phù hợp để hỗ trợ bạn.'
                      : switch (event.status) {
                          'created' =>
                            'Yêu cầu ${order.serviceName} đã được ghi nhận với mã ${order.code}.',
                          'accepted' =>
                            'Chuyên gia đã xác nhận tiếp nhận yêu cầu dịch vụ.',
                          'in_progress' =>
                            'Chuyên gia đang thực hiện ${order.serviceName}.',
                          'completed' => 'Dịch vụ đã được hoàn tất.',
                          'paid' =>
                            'Hệ thống đã ghi nhận khoản thanh toán của đơn hàng.',
                          'assigned' =>
                            'Hệ thống đã chuyển yêu cầu dịch vụ đến chuyên gia.',
                          _ => 'Trạng thái đơn hàng đã được cập nhật.',
                        };
                  return IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          width: 32,
                          child: Column(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: active
                                      ? scheme.surfaceContainerLowest
                                      : color,
                                  border: Border.all(
                                    color: color,
                                    width: active ? 2 : 1,
                                  ),
                                ),
                                child: Icon(
                                  cancelled
                                      ? Icons.close
                                      : reassigned
                                      ? Icons.search
                                      : active
                                      ? Icons.more_horiz
                                      : Icons.check,
                                  size: 18,
                                  color: active ? color : scheme.onPrimary,
                                ),
                              ),
                              if (!last)
                                Expanded(
                                  child: Container(
                                    width: 1,
                                    color: scheme.primary.withValues(alpha: .6),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(bottom: last ? 0 : 24),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: cancelled || active
                                        ? color
                                        : scheme.onSurface,
                                  ),
                                ),
                                if (event.createdAt != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    DateFormat(
                                      'HH:mm:ss dd/MM/yyyy',
                                    ).format(event.createdAt!.toLocal()),
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: scheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 4),
                                Text(
                                  description,
                                  style: TextStyle(
                                    fontSize: 13,
                                    height: 1.65,
                                    color: scheme.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
