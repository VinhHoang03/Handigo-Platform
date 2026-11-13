import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../../shared/widgets/app_states.dart';

final customerWithdrawalsProvider = FutureProvider.autoDispose
    .family<PagedResult<Map<String, dynamic>>, int>((ref, page) async {
      final response = await ref
          .watch(apiClientProvider)
          .request(
            '/withdrawals/me',
            query: {'page': page, 'limit': 20},
            authenticated: true,
          );
      return PagedResult.fromJson(
        response['data'] as Map<String, dynamic>,
        (item) => item,
      );
    });

String _money(num value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);

Future<bool?> showCustomerWithdrawal(BuildContext context, double balance) =>
    showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _WithdrawalDialog(balance: balance),
    );

class _WithdrawalDialog extends ConsumerStatefulWidget {
  const _WithdrawalDialog({required this.balance});
  final double balance;
  @override
  ConsumerState<_WithdrawalDialog> createState() => _WithdrawalDialogState();
}

class _WithdrawalDialogState extends ConsumerState<_WithdrawalDialog> {
  int? _amount;
  String? _error;
  bool _busy = false;
  bool _needsHistoryCheck = false;

  Future<void> _submit() async {
    final amount = _amount;
    if (_busy ||
        _needsHistoryCheck ||
        amount == null ||
        amount < 1 ||
        amount > widget.balance)
      return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(apiClientProvider)
          .request(
            '/withdrawals',
            method: 'POST',
            data: {'amount': amount},
            authenticated: true,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      final status = error is ApiException ? error.statusCode : null;
      if (mounted)
        setState(() {
          _busy = false;
          _needsHistoryCheck = status == null || status >= 500;
          _error = !_needsHistoryCheck && error is ApiException
              ? error.message
              : 'Chưa xác định được kết quả. Hãy kiểm tra lịch sử rút tiền trước khi gửi lại.';
          if (_needsHistoryCheck) ref.invalidate(customerWithdrawalsProvider);
        });
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_busy,
    child: AlertDialog(
      scrollable: true,
      title: const Text('Yêu cầu rút tiền'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Số dư khả dụng: ${_money(widget.balance)}'),
          const SizedBox(height: 8),
          const Text(
            'Handigo sử dụng tài khoản ngân hàng mặc định hoặc tài khoản đã lưu gần nhất.',
          ),
          const SizedBox(height: 16),
          TextField(
            enabled: !_busy && !_needsHistoryCheck,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (value) => setState(() {
              _amount = int.tryParse(value);
              _error = null;
            }),
            decoration: InputDecoration(
              labelText: 'Số tiền rút',
              suffixText: 'đ',
              errorText: (_amount ?? 0) > widget.balance
                  ? 'Vượt số dư khả dụng.'
                  : _error,
              errorMaxLines: 4,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context),
          child: const Text('Đóng'),
        ),
        FilledButton(
          onPressed:
              _busy ||
                  _needsHistoryCheck ||
                  (_amount ?? 0) < 1 ||
                  (_amount ?? 0) > widget.balance
              ? null
              : _submit,
          child: Text(_busy ? 'Đang gửi…' : 'Gửi yêu cầu'),
        ),
      ],
    ),
  );
}

class CustomerWithdrawalsScreen extends StatelessWidget {
  const CustomerWithdrawalsScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Lịch sử rút tiền')),
    body: const CustomerWithdrawalsList(),
  );
}

class CustomerWithdrawalsList extends ConsumerStatefulWidget {
  const CustomerWithdrawalsList({super.key});
  @override
  ConsumerState<CustomerWithdrawalsList> createState() =>
      _CustomerWithdrawalsScreenState();
}

class _CustomerWithdrawalsScreenState
    extends ConsumerState<CustomerWithdrawalsList> {
  int _page = 1;
  @override
  Widget build(BuildContext context) {
    final provider = customerWithdrawalsProvider(_page);
    return ref
        .watch(provider)
        .when(
          loading: () => const AppLoading(),
          error: (_, _) => AppMessage(
            message: 'Không thể tải yêu cầu rút tiền.',
            onRetry: () => ref.invalidate(provider),
          ),
          data: (result) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(provider);
              try {
                await ref.read(provider.future);
              } catch (_) {
                /* Lỗi hiển thị ở màn hình. */
              }
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                if (result.items.isEmpty)
                  const AppMessage(
                    message: 'Chưa có yêu cầu rút tiền.',
                    icon: Icons.receipt_long_outlined,
                  ),
                for (final item in result.items)
                  Card(
                    child: ListTile(
                      title: Text(_money(item['amount'] as num? ?? 0)),
                      subtitle: Text(
                        [
                          switch (item['status']) {
                            'pending' => 'Chờ duyệt',
                            'approved' => 'Đã duyệt',
                            'rejected' => 'Từ chối',
                            _ => 'Đang cập nhật',
                          },
                          if (DateTime.tryParse('${item['createdAt']}')
                              case final DateTime date)
                            DateFormat(
                              'HH:mm · dd/MM/yyyy',
                            ).format(date.toLocal()),
                          if (item['adminNote'] case final String reason
                              when reason.isNotEmpty)
                            reason,
                        ].join('\n'),
                      ),
                    ),
                  ),
                if (_page > 1 || result.totalPages > 1)
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      IconButton(
                        tooltip: 'Trang trước',
                        onPressed: _page > 1
                            ? () => setState(() => _page--)
                            : null,
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Text('Trang $_page'),
                      IconButton(
                        tooltip: 'Trang sau',
                        onPressed: _page < result.totalPages
                            ? () => setState(() => _page++)
                            : null,
                        icon: const Icon(Icons.chevron_right),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        );
  }
}
