import 'dart:async';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  // Dùng font thật để các phép kiểm tra bố cục phản ánh ứng dụng.
  for (final entry in {
    'Inter': 'Inter-variable.ttf',
    'Hanken Grotesk': 'HankenGrotesk-variable.ttf',
  }.entries) {
    await (FontLoader(
      entry.key,
    )..addFont(rootBundle.load('assets/fonts/${entry.value}'))).load();
  }
  var directory = File(Platform.resolvedExecutable).parent;
  for (var index = 0; index < 8; index++) {
    final icons = File(
      '${directory.path}/material_fonts/MaterialIcons-Regular.otf',
    );
    if (icons.existsSync()) {
      await (FontLoader('MaterialIcons')..addFont(
            Future.value(ByteData.sublistView(icons.readAsBytesSync())),
          ))
          .load();
      break;
    }
    directory = directory.parent;
  }
  await testMain();
}
