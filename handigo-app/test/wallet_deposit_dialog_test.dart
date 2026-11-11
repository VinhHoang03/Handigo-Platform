import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/account/data/account_repository.dart';
import 'package:handigo_app/features/account/presentation/wallet_deposit_dialog.dart';

class _Repository implements AccountRepository {
  int creates = 0, checks = 0, cancels = 0;
  double? amount;
  bool failQr = false, failCancel = false;
  String status = 'pending';
  @override
  Future<Map<String, dynamic>> deposit(double value) async {
    creates++;
    amount = value;
    return {
      'amount': value,
      'transaction': {'gatewayOrderCode': '12345'},
    };
  }

  @override
  Future<Uint8List> depositQr(String code) async {
    expect(code, '12345');
    if (failQr) throw Exception('Lỗi tải QR kiểm thử');
    return base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=',
    );
  }

  @override
  Future<Map<String, dynamic>> syncDeposit(String code) async {
    expect(code, '12345');
    checks++;
    return {'status': status};
  }

  @override
  Future<Map<String, dynamic>> cancelDeposit(String code) async {
    expect(code, '12345');
    cancels++;
    if (failCancel) throw Exception('Lỗi hủy kiểm thử');
    return {'status': status == 'success' ? 'success' : 'cancelled'};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _open(WidgetTester tester, _Repository repository) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(360, 800);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: Navigator(
        onGenerateRoute: (_) => MaterialPageRoute<void>(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDialog<void>(
                context: context,
                barrierDismissible: false,
                builder: (_) => WalletDepositDialog(
                  repository: repository,
                  onChanged: () {},
                ),
              ),
              child: const Text('Màn hình ví'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Màn hình ví'));
  await tester.pumpAndSettle();
}

Future<void> _create(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField), '125000');
  await tester.tap(find.text('Tiếp tục'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Nền trắng, hủy đóng đúng hộp thoại trong navigator lồng nhau', (
    tester,
  ) async {
    final repository = _Repository();
    await _open(tester, repository);
    expect(
      tester.widget<AlertDialog>(find.byType(AlertDialog)).backgroundColor,
      Colors.white,
    );
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.text('Màn hình ví'), findsOneWidget);
    expect(repository.creates, 0);
  });

  testWidgets(
    'Tạo đúng số tiền, QR dưới input, kiểm tra không tạo giao dịch mới',
    (tester) async {
      final repository = _Repository();
      await _open(tester, repository);
      await tester.tap(find.text('Tiếp tục'));
      await tester.pumpAndSettle();
      expect(repository.creates, 0);
      await _create(tester);
      expect(repository.amount, 125000);
      expect(repository.creates, 1);
      expect(find.byType(Image), findsOneWidget);
      expect(
        tester.getTopLeft(find.byType(Image)).dy,
        greaterThan(tester.getBottomLeft(find.byType(TextField)).dy),
      );
      expect(tester.widget<TextField>(find.byType(TextField)).enabled, isFalse);
      expect(find.text('Tiếp tục'), findsNothing);
      await tester.tap(find.text('Kiểm tra'));
      await tester.pumpAndSettle();
      expect(repository.checks, 1);
      expect(repository.creates, 1);
      repository.status = 'success';
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(find.text('Đã xác nhận nạp tiền thành công.'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
      expect(find.byType(Image), findsNothing);
      final checks = repository.checks;
      await tester.pump(const Duration(seconds: 10));
      expect(repository.checks, checks);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Đóng'));
      await tester.pumpAndSettle();
    },
  );

  testWidgets(
    'Lỗi tải QR có thể thử lại mà không tạo thêm giao dịch; hủy qua backend',
    (tester) async {
      final repository = _Repository()..failQr = true;
      await _open(tester, repository);
      await _create(tester);
      expect(find.text('Kiểm tra'), findsOneWidget);
      repository.failQr = false;
      await tester.tap(find.text('Kiểm tra'));
      await tester.pumpAndSettle();
      expect(find.byType(Image), findsOneWidget);
      expect(repository.creates, 1);
      repository.failCancel = true;
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      repository.failCancel = false;
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(repository.cancels, 2);
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('Màn hình ví'), findsOneWidget);
    },
  );

  testWidgets('Hủy gặp giao dịch vừa thanh toán vẫn hiển thị thành công', (
    tester,
  ) async {
    final repository = _Repository();
    await _open(tester, repository);
    await _create(tester);
    repository.status = 'success';
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(find.text('Đã xác nhận nạp tiền thành công.'), findsOneWidget);
    await tester.tap(find.text('Đóng'));
    await tester.pumpAndSettle();
  });
}
