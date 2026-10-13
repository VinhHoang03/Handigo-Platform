import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'ai_chat_controller.dart';

Future<void> showAiChatSheet(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SizedBox(
          height:
              MediaQuery.sizeOf(context).height * .9 -
              MediaQuery.viewInsetsOf(context).bottom,
          child: const AiChatSheet(),
        ),
      ),
    );

class AiChatSheet extends ConsumerStatefulWidget {
  const AiChatSheet({super.key});
  @override
  ConsumerState<AiChatSheet> createState() => _AiChatSheetState();
}

class _AiChatSheetState extends ConsumerState<AiChatSheet> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final controller = ref.read(aiChatControllerProvider);
    if (!controller.canSend || _input.text.trim().isEmpty) return;
    await controller.send(_input.text);
    if (!mounted) return;
    if (controller.error == null) _input.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(aiChatControllerProvider);
    final scheme = Theme.of(context).colorScheme;
    final confirmation = controller.confirmation;
    final payment = controller.payment;
    return Material(
      color: scheme.surface,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
              child: Row(
                children: [
                  Icon(Icons.chat_bubble_rounded, color: scheme.primary),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Trợ lý AI Handigo',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Cuộc trò chuyện mới',
                    onPressed: controller.canReset ? controller.reset : null,
                    icon: const Icon(Icons.add_comment_outlined),
                  ),
                  IconButton(
                    tooltip: 'Đóng trợ lý',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.all(16),
                children: [
                  if (controller.messages.isEmpty && !controller.busy)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Text(
                        'Xin chào! Tôi có thể giúp bạn tìm dịch vụ, đặt lịch và kiểm tra đơn hàng. Bạn cần hỗ trợ gì?',
                      ),
                    ),
                  for (final message in controller.messages)
                    Align(
                      alignment: message['sender'] == 'user'
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.sizeOf(context).width * .8,
                        ),
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: message['sender'] == 'user'
                              ? scheme.primaryContainer
                              : scheme.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SelectableText(
                              message['content'] as String? ?? '',
                              style: TextStyle(
                                color: message['sender'] == 'user'
                                    ? scheme.onPrimaryContainer
                                    : scheme.onSurface,
                              ),
                            ),
                            for (final group
                                in (message['choiceGroups'] as List? ?? [])
                                    .whereType<Map<String, dynamic>>()) ...[
                              const SizedBox(height: 8),
                              Text(group['label'] as String? ?? ''),
                              Wrap(
                                spacing: 8,
                                runSpacing: 4,
                                children: [
                                  for (final option
                                      in (group['options'] as List? ?? [])
                                          .whereType<String>())
                                    ActionChip(
                                      label: Text(option),
                                      onPressed: controller.canSend
                                          ? () {
                                              final current = _input.text
                                                  .trim();
                                              _input.text =
                                                  group['multiple'] == true &&
                                                      current.isNotEmpty
                                                  ? '$current; $option'
                                                  : option;
                                              _input.selection =
                                                  TextSelection.collapsed(
                                                    offset: _input.text.length,
                                                  );
                                            }
                                          : null,
                                    ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  if (controller.busy)
                    const Row(
                      children: [
                        SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 12),
                        Expanded(child: Text('Trợ lý đang xử lý...')),
                      ],
                    ),
                  if (controller.error != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              controller.error!,
                              style: TextStyle(color: scheme.error),
                            ),
                            TextButton(
                              onPressed: controller.busy
                                  ? null
                                  : controller.retry,
                              child: const Text('Thử lại'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (controller.needsReconciliation)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Thao tác trước cần được kiểm tra. Vui lòng tải lại trạng thái trước khi tiếp tục.',
                            ),
                            TextButton(
                              onPressed: controller.busy
                                  ? null
                                  : controller.load,
                              child: const Text('Tải lại trạng thái'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (controller.needsNewSession)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text(
                        'Cuộc trò chuyện đã kết thúc. Nhấn nút cuộc trò chuyện mới để tiếp tục.',
                      ),
                    ),
                  if (confirmation != null)
                    _ConfirmationCard(
                      action: confirmation,
                      enabled: controller.canSend,
                      onDecision: controller.decide,
                    ),
                  if (payment != null)
                    _PaymentCard(
                      payment: payment,
                      enabled: controller.canSend,
                      onCheck: controller.checkPayment,
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      enabled: controller.canSend,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 4000,
                      textInputAction: TextInputAction.newline,
                      decoration: const InputDecoration(
                        hintText: 'Nhắn với trợ lý Handigo...',
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    tooltip: 'Gửi tin nhắn',
                    onPressed: controller.canSend ? _send : null,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const _previewLabels = {
  'service': 'Dịch vụ',
  'options': 'Tùy chọn',
  'address': 'Địa chỉ',
  'schedule': 'Thời gian',
  'unitPrice': 'Đơn giá',
  'quantity': 'Số lượng',
  'paymentMethod': 'Thanh toán',
  'amount': 'Số tiền',
  'description': 'Mô tả',
  'orderCode': 'Mã đơn',
  'reason': 'Lý do hủy',
  'paidAmount': 'Đã thanh toán',
  'refundAmount': 'Dự kiến hoàn',
  'cancellationFee': 'Phí hủy',
  'note': 'Lưu ý',
  'paymentLabel': 'Khoản thanh toán',
  'subject': 'Tiêu đề yêu cầu',
  'category': 'Nhóm hỗ trợ',
  'priority': 'Độ ưu tiên',
  'caseId': 'Mã yêu cầu',
  'caseStatus': 'Trạng thái hiện tại',
};

String _previewValue(String key, dynamic value) {
  if (value is num) {
    return key == 'quantity'
        ? '$value'
        : '${NumberFormat.decimalPattern('vi_VN').format(value)} đ';
  }
  if (value is List) return value.whereType<String>().join('\n');
  if (value is! String) return '';
  if (key == 'paymentMethod') {
    return {
          'cash': 'Tiền mặt',
          'bank': 'Chuyển khoản',
          'wallet': 'Ví Handigo',
        }[value] ??
        value;
  }
  if (key == 'schedule') {
    final date = DateTime.tryParse(value);
    if (date != null) {
      return DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal());
    }
  }
  return value;
}

class _ConfirmationCard extends StatelessWidget {
  const _ConfirmationCard({
    required this.action,
    required this.enabled,
    required this.onDecision,
  });
  final Map<String, dynamic> action;
  final bool enabled;
  final Future<void> Function(String) onDecision;

  @override
  Widget build(BuildContext context) {
    final preview = action['preview'] as Map<String, dynamic>? ?? {};
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              preview['title'] as String? ?? 'Xác nhận thao tác',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Kiểm tra thông tin trước khi xác nhận. Bạn có thể nhắn thông tin cần sửa.',
            ),
            for (final entry in _previewLabels.entries)
              if (_previewValue(entry.key, preview[entry.key]).isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(
                    '${entry.value}: ${_previewValue(entry.key, preview[entry.key])}',
                  ),
                ),
            if (action['expiresAt'] is String)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  'Có hiệu lực đến ${_previewValue('schedule', action['expiresAt'])}.',
                ),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: enabled ? () => onDecision('REJECT') : null,
                    child: const Text('Từ chối'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: enabled ? () => onDecision('CONFIRM') : null,
                    child: const Text('Xác nhận'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({
    required this.payment,
    required this.enabled,
    required this.onCheck,
  });
  final Map<String, dynamic> payment;
  final bool enabled;
  final Future<void> Function() onCheck;

  @override
  Widget build(BuildContext context) {
    final url = Uri.tryParse(payment['checkoutUrl'] as String? ?? '');
    final canOpen =
        payment['status'] == 'pending' &&
        url != null &&
        url.scheme == 'https' &&
        url.userInfo.isEmpty &&
        !url.hasPort &&
        (url.host == 'payos.vn' || url.host.endsWith('.payos.vn'));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Thanh toán đơn ${payment['orderCode'] ?? ''}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(payment['message'] as String? ?? ''),
            if (payment['amount'] is num)
              Text(_previewValue('amount', payment['amount'])),
            if (canOpen)
              TextButton(
                onPressed: enabled
                    ? () async {
                        try {
                          final opened = await launchUrl(
                            url,
                            mode: LaunchMode.externalApplication,
                          );
                          if (!opened) throw const FormatException();
                        } catch (_) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Không mở được trang thanh toán. Vui lòng thử lại.',
                                ),
                              ),
                            );
                          }
                        }
                      }
                    : null,
                child: const Text('Mở PayOS để thanh toán'),
              ),
            TextButton(
              onPressed: enabled ? onCheck : null,
              child: const Text('Kiểm tra thanh toán'),
            ),
          ],
        ),
      ),
    );
  }
}
