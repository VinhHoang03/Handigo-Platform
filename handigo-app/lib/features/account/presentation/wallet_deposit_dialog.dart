import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/payos_qr_preview.dart';
import '../data/account_repository.dart';

class WalletDepositDialog extends StatefulWidget {
  const WalletDepositDialog({
    required this.repository,
    required this.onChanged,
    super.key,
  });
  final AccountRepository repository;
  final VoidCallback onChanged;

  @override
  State<WalletDepositDialog> createState() => _WalletDepositDialogState();
}

class _WalletDepositDialogState extends State<WalletDepositDialog>
    with WidgetsBindingObserver {
  final _amount = TextEditingController();
  Timer? _timer;
  Uint8List? _qr;
  String? _orderCode, _error;
  String _status = 'pending';
  bool _busy = false, _active = true, _created = false;
  bool get _terminal => ['success', 'failed', 'cancelled'].contains(_status);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_active && _orderCode != null && !_terminal) unawaited(_check());
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _active = state == AppLifecycleState.resumed;
    if (_active && _orderCode != null && !_terminal) unawaited(_check());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _amount.dispose();
    super.dispose();
  }

  void _showError(Object error) {
    _error = error is ApiException
        ? error.message
        : 'Chưa thể xử lý nạp ví. Vui lòng thử lại.';
  }

  Future<void> _create() async {
    if (_busy || _created) return;
    final amount = int.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0 || amount > 9007199254740991) {
      setState(() => _error = 'Vui lòng nhập số tiền nguyên lớn hơn 0 hợp lệ.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await widget.repository.deposit(amount.toDouble());
      if (!mounted) return;
      _created = true;
      final transaction = data['transaction'];
      final orderCode = transaction is Map
          ? transaction['gatewayOrderCode']?.toString()
          : null;
      if (orderCode == null || orderCode.isEmpty || data['amount'] != amount) {
        throw const ApiException(
          'Thông tin nạp ví chưa hợp lệ. Vui lòng kiểm tra lịch sử trước khi tạo giao dịch mới.',
        );
      }
      _orderCode = orderCode;
      _qr = await widget.repository.depositQr(_orderCode!);
      if (!mounted) return;
      widget.onChanged();
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _applyStatus(Map<String, dynamic> transaction) {
    _status = transaction['status'] as String? ?? 'pending';
    if (_terminal) _qr = null;
    widget.onChanged();
  }

  Future<void> _check() async {
    if (_busy || !mounted || _terminal || _orderCode == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final transaction = await widget.repository.syncDeposit(_orderCode!);
      if (!mounted) return;
      _applyStatus(transaction);
      if (!_terminal && _qr == null) {
        _qr = await widget.repository.depositQr(_orderCode!);
      }
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    if (_busy) return;
    if (_orderCode == null || _terminal) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final transaction = await widget.repository.cancelDeposit(_orderCode!);
      if (!mounted) return;
      _applyStatus(transaction);
      if (_status != 'success' && _terminal) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_busy,
    child: AlertDialog(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      title: const Text('Nạp ví'),
      content: SizedBox(
        width: 320,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _amount,
                enabled: !_busy && !_created,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(labelText: 'Số tiền (VND)'),
              ),
              if (_qr != null && !_terminal) ...[
                const SizedBox(height: 12),
                PayosQrPreview(bytes: _qr!),
              ],
              if (_status == 'success') ...[
                const SizedBox(height: 12),
                const Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: Color(0xFF15803D)),
                    SizedBox(width: 8),
                    Expanded(child: Text('Đã xác nhận nạp tiền thành công.')),
                  ],
                ),
              ] else if (_terminal) ...[
                const SizedBox(height: 12),
                const Text(
                  'Giao dịch nạp ví đã kết thúc, chưa ghi nhận thanh toán thành công.',
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              if (_busy) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : _cancel,
          child: Text(_terminal ? 'Đóng' : 'Hủy'),
        ),
        if (!_terminal)
          FilledButton(
            onPressed: _busy || (_created && _orderCode == null)
                ? null
                : _created
                ? _check
                : _create,
            child: Text(_created ? 'Kiểm tra' : 'Tiếp tục'),
          ),
      ],
    ),
  );
}
