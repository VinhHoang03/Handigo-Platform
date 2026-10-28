import '../../../core/network/api_exception.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/widgets/app_feedback.dart';
import 'chat_screens.dart';

class OrderChatButton extends ConsumerStatefulWidget {
  const OrderChatButton({
    required this.orderId,
    required this.status,
    required this.hasProvider,
    this.providerView = false,
    this.iconOnly = false,
    this.label = 'Nhắn tin',
    super.key,
  });
  final String orderId, status, label;
  final bool hasProvider, providerView, iconOnly;

  @override
  ConsumerState<OrderChatButton> createState() => _OrderChatButtonState();
}

class _OrderChatButtonState extends ConsumerState<OrderChatButton> {
  bool _opening = false;

  Future<void> _open() async {
    if (_opening) return;
    final reason = widget.status == 'cancelled'
        ? 'Đơn đã hủy nên không thể nhắn tin.'
        : !widget.hasProvider || widget.status == 'created'
        ? 'Chưa có thợ nhận đơn nên chưa thể nhắn tin.'
        : !const [
            'accepted',
            'in_progress',
            'completed',
          ].contains(widget.status)
        ? 'Đơn này hiện chưa thể nhắn tin.'
        : null;
    if (reason != null) {
      AppToast.show(context, reason);
      return;
    }
    setState(() => _opening = true);
    try {
      final conversation = await ref
          .read(chatRepositoryProvider)
          .conversationForOrder(widget.orderId);
      if (!mounted) return;
      await context.push(
        '/${widget.providerView ? 'provider' : 'customer'}/chat/order/${widget.orderId}',
        extra: conversation,
      );
    } catch (error) {
      if (mounted) {
        final message = error is ApiException
            ? switch (error.statusCode) {
                403 => 'Bạn không có quyền nhắn tin trong đơn này.',
                404 => 'Không tìm thấy cuộc trò chuyện của đơn này.',
                400 => 'Đơn này hiện chưa thể nhắn tin.',
                _ => 'Chưa kết nối được tin nhắn. Bạn thử lại nhé.',
              }
            : 'Chưa kết nối được tin nhắn. Bạn thử lại nhé.';
        AppToast.show(context, message);
      }
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final icon = _opening
        ? const SizedBox(
            width: 17,
            height: 17,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : const Icon(Icons.chat_bubble_outline, size: 17);
    return widget.iconOnly
        ? IconButton.outlined(
            tooltip: widget.label,
            onPressed: _open,
            icon: icon,
          )
        : OutlinedButton.icon(
            onPressed: _open,
            icon: icon,
            label: Text(widget.label),
          );
  }
}
