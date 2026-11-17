import 'package:flutter/material.dart';
import '../../orders/domain/order_summary.dart';
import '../../orders/presentation/order_cancel_sheet.dart';

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
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    title: Text(_confirming ? 'Xác nhận hủy đơn?' : 'Hủy đơn dịch vụ'),
    content: SingleChildScrollView(
      child: _confirming
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bạn xác nhận hủy nhận đơn dịch vụ này? Lý do hủy sẽ được lưu và thông báo cho khách hàng.',
                ),
                const SizedBox(height: 16),
                Text(
                  'LÝ DO ĐÃ CHỌN',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.error,
                  ),
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
                  Text(
                    'Lý do hủy sẽ được lưu cùng đơn hàng và thông báo cho khách hàng.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FormField<String>(
                    validator: (_) =>
                        _reason == null ? 'Vui lòng chọn lý do hủy đơn.' : null,
                    builder: (field) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final reason in _reasons)
                          CancelReasonTile(
                            label: reason,
                            selected: _reason == reason,
                            enabled: true,
                            onTap: () {
                              setState(() => _reason = reason);
                              field.didChange(reason);
                            },
                          ),
                        if (field.hasError)
                          Text(
                            field.errorText!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    initialValue: _explanation,
                    onChanged: (value) => _explanation = value.trim(),
                    minLines: 3,
                    maxLines: 5,
                    maxLength: 500 - (_reason?.length ?? 0) - 2,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      labelText: _reason == 'Lý do khác'
                          ? 'Giải thích thêm *'
                          : 'Giải thích thêm',
                      hintText: _reason == 'Lý do khác'
                          ? 'Mô tả cụ thể lý do hủy (ít nhất 10 ký tự)...'
                          : 'Bổ sung thông tin để khách hàng hiểu rõ hơn (không bắt buộc)...',
                      alignLabelWithHint: true,
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
        child: Text(_confirming ? 'Hủy đơn' : 'Tiếp tục hủy đơn'),
      ),
    ],
  );
}
