import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/features/auth/presentation/otp_code_input.dart';

void main() {
  late TextEditingController controller;
  late GlobalKey<FormState> formKey;

  setUp(() {
    controller = TextEditingController();
    formKey = GlobalKey<FormState>();
  });

  tearDown(() => controller.dispose());

  Future<void> pumpInput(WidgetTester tester) => tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Form(
          key: formKey,
          child: OtpCodeInput(
            controller: controller,
            validator: (value) =>
                value != null && RegExp(r'^[0-9]{6}$').hasMatch(value)
                ? null
                : 'Vui lòng nhập đủ 6 chữ số OTP',
          ),
        ),
      ),
    ),
  );

  testWidgets('Nhập một số tự chuyển sang ô tiếp theo và chỉ nhận số', (
    tester,
  ) async {
    await pumpInput(tester);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'a5');
    await tester.pump();
    expect(controller.text, '5');
    expect(tester.widget<TextField>(fields.at(0)).controller!.text, '5');
    expect(tester.widget<TextField>(fields.at(1)).focusNode!.hasFocus, isTrue);
  });

  testWidgets('Dán mã sáu số vào một ô phân bố đúng và xóa mã khi gửi lại', (
    tester,
  ) async {
    await pumpInput(tester);
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(2), '123456');
    await tester.pump();
    expect(controller.text, '123456');
    for (var index = 0; index < 6; index++) {
      expect(
        tester.widget<TextField>(fields.at(index)).controller!.text,
        '${index + 1}',
      );
    }
    expect(formKey.currentState!.validate(), isTrue);
    controller.clear();
    await tester.pump();
    expect(tester.widget<TextField>(fields.first).controller!.text, isEmpty);
    expect(formKey.currentState!.validate(), isFalse);
    await tester.pump();
    expect(find.text('Vui lòng nhập đủ 6 chữ số OTP'), findsOneWidget);
  });

  testWidgets('Backspace ở ô trống xóa số trước và quay lại ô trước', (
    tester,
  ) async {
    await pumpInput(tester);
    final fields = find.byType(TextField);
    await tester.enterText(fields.first, '5');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.backspace);
    await tester.pump();
    expect(controller.text, isEmpty);
    expect(tester.widget<TextField>(fields.first).focusNode!.hasFocus, isTrue);
  });
}
