import 'package:flutter/material.dart';

/// Màu thương hiệu đồng bộ với handigo-web/src/index.css.
abstract final class AppTheme {
  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF3525CD),
      brightness: brightness,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: brightness == Brightness.light
          ? scheme.copyWith(
              primary: const Color(0xFF3525CD),
              secondary: const Color(0xFF00687A),
              surface: const Color(0xFFFAF8FF),
              onSurface: const Color(0xFF131B2E),
            )
          : scheme,
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
    );
  }
}
