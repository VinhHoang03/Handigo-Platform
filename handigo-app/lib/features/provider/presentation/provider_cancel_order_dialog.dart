import 'package:flutter/material.dart';
import '../../orders/domain/order_summary.dart';

class ProviderCancelOrderDialog extends StatefulWidget {
  const ProviderCancelOrderDialog({required this.order, super.key});
  final OrderDetail order;
  @override
  State<ProviderCancelOrderDialog> createState() =>
      _ProviderCancelOrderDialogState();
}

class _ProviderCancelOrderDialogState extends State<ProviderCancelOrderDialog> {
  final _form = GlobalKey<FormState>();
  String? _reason;
  String _explanation = '';
  bool _confirming = false;

  List<String> get _reasons => [
    if (widget.order.hasArrived &&
        widget.order.inspectionRequired &&
        widget.order.status == 'accepted')
      'Khách hàng không đồng ý báo giá',
    widget.order.hasArrived
        ? 'Không thể sửa chữa hoặc thực hiện dịch vụ'
        : 'Không thể đến địa chỉ khách hàng',
    'Khách hàng cung cấp thông tin chưa đầy đủ',
    if (!widget.order.hasArrived) 'Không thể liên hệ với khách hàng',
    if (!widget.order.hasArrived && widget.order.isAppointment)
      'Lịch hẹn không còn phù hợp',
    'Lý do khác',
  ];
  String get _fullReason =>
      _explanation.isEmpty ? _reason! : '$_reason: $_explanation';

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(_confirming ? 'Xác nhận hủy đơn?' : 'Hủy đơn dịch vụ'),
    content: SingleChildScrollView(
      child: _confirming
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bạn có chắc chắn muốn hủy nhận đơn này? Lý do hủy sẽ được lưu và thông báo cho khách hàng.',
                ),
                const SizedBox(height: 16),
                const Text(
                  'Lý do đã chọn',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(_fullReason),
              ],
            )
          : Form(
              key: _form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _reason,
                    isExpanded: true,
                    itemHeight: null,
                    decoration: const InputDecoration(labelText: 'Lý do hủy'),
                    hint: const Text('Chọn lý do'),
                    items: [
                      for (final reason in _reasons)
                        DropdownMenuItem(value: reason, child: Text(reason)),
                    ],
                    onChanged: (value) => setState(() => _reason = value),
                    validator: (value) =>
                        value == null ? 'Vui lòng chọn lý do hủy đơn.' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    initialValue: _explanation,
                    onChanged: (value) => _explanation = value.trim(),
                    minLines: 2,
                    maxLines: 4,
                    maxLength: 500 - (_reason?.length ?? 0) - 2,
                    decoration: InputDecoration(
                      labelText: _reason == 'Lý do khác'
                          ? 'Nội dung lý do khác'
                          : 'Giải thích thêm (không bắt buộc)',
                    ),
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      if ((_reason == 'Lý do khác' || text.isNotEmpty) &&
                          text.length < 10) {
                        return 'Vui lòng nhập giải thích ít nhất 10 ký tự.';
                      }
                      if (text.isNotEmpty &&
                          text.length + (_reason?.length ?? 0) + 2 > 500) {
                        return 'Lý do hủy không được vượt quá 500 ký tự.';
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),
    ),
    actions: [
      TextButton(
        onPressed: () {
          if (_confirming) {
            setState(() => _confirming = false);
          } else {
            Navigator.pop(context);
          }
        },
        child: Text(_confirming ? 'Quay lại' : 'Đóng'),
      ),
      FilledButton(
        style: _confirming
            ? FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error,
                foregroundColor: Theme.of(context).colorScheme.onError,
              )
            : null,
        onPressed: () {
          if (_confirming) {
            Navigator.pop(context, _fullReason);
          } else if (_form.currentState!.validate()) {
            FocusScope.of(context).unfocus();
            setState(() => _confirming = true);
          }
        },
        child: Text(_confirming ? 'Xác nhận hủy' : 'Tiếp tục hủy đơn'),
      ),
    ],
  );
}
