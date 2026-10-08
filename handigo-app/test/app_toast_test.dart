import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/shared/widgets/app_feedback.dart';

Future<BuildContext> setup(WidgetTester tester) async {
  late BuildContext context;
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(
        body: Builder(
          builder: (value) {
            context = value;
            return const Text('Trang thử nghiệm');
          },
        ),
      ),
    ),
  );
  return context;
}

void main() {
  testWidgets('Toast nằm trên phải, có màu theo loại và tự ẩn', (tester) async {
    final context = await setup(tester);
    AppToast.show(context, 'Thành công', type: AppToastType.success);
    await tester.pump();
    final toast = find
        .ancestor(of: find.text('Thành công'), matching: find.byType(Material))
        .first;
    expect(tester.widget<Material>(toast).color, AppTheme.successGreen);
    expect(tester.getTopLeft(toast).dy, 12);
    expect(
      tester.getBottomRight(toast).dx,
      tester.view.physicalSize.width / tester.view.devicePixelRatio - 12,
    );
    expect(find.byType(SnackBar), findsNothing);
    await tester.pump(const Duration(seconds: 3));
    await tester.pump();
    expect(find.text('Thành công'), findsNothing);
    AppToast.show(context, 'Cảnh báo', type: AppToastType.warning);
    await tester.pump();
    final warning = find
        .ancestor(of: find.text('Cảnh báo'), matching: find.byType(Material))
        .first;
    expect(
      tester.widget<Material>(warning).color,
      AppTheme.light.colorScheme.error,
    );
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    await tester.tap(find.byTooltip('Đóng thông báo'));
    await tester.pump();
    expect(find.text('Cảnh báo'), findsNothing);
  });

  testWidgets('Toast mới thay toast cũ, action và hủy timer khi tháo app', (
    tester,
  ) async {
    final context = await setup(tester);
    var acted = false;
    AppToast.show(context, 'Cũ', duration: const Duration(seconds: 1));
    await tester.pump();
    AppToast.show(
      context,
      'Mới',
      duration: const Duration(seconds: 5),
      action: SnackBarAction(label: 'Thử lại', onPressed: () => acted = true),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Cũ'), findsNothing);
    expect(find.text('Mới'), findsOneWidget);
    await tester.tap(find.text('Thử lại'));
    await tester.pump();
    expect(acted, isTrue);
    expect(find.text('Mới'), findsNothing);
    AppToast.show(context, 'Đang mở');
    await tester.pump();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 4));
    expect(tester.takeException(), isNull);
  });
}
