import 'package:flutter/material.dart';

/// Màu thương hiệu đồng bộ với handigo-web/src/index.css.
abstract final class AppTheme {
  static const primary = Color(0xFF3525CD);
  static const primaryDark = Color(0xFF1E00A9);
  static const secondary = Color(0xFF00687A);
  static const surface = Color(0xFFFAF8FF);
  static const surfaceContainerLow = Color(0xFFF2F3FF);
  static const surfaceContainerLowest = Color(0xFFFFFFFF);
  static const onSurface = Color(0xFF131B2E);
  static const outlineVariant = Color(0xFFC7C4D8);
  static const starGold = Color(0xFFFACC15);
  static const successGreen = Color(0xFF4ADE80);

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(seedColor: primary, brightness: brightness);
    final normalizedScheme = brightness == Brightness.dark
        ? scheme.copyWith(
            primaryContainer: scheme.surfaceContainerLow,
            onPrimaryContainer: scheme.onSurface,
          )
        : null;
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: brightness == Brightness.light ? surface : scheme.surface,
      colorScheme: brightness == Brightness.light
          ? const ColorScheme.light(
              primary: primaryDark,
              onPrimary: Colors.white,
              // Container dùng cho chip/avatar/icon nền nhẹ, không dùng màu
              // primary đậm để tránh label và icon bị phủ tím xanh.
              primaryContainer: surfaceContainerLow,
              onPrimaryContainer: onSurface,
              secondary: secondary,
              onSecondary: Colors.white,
              secondaryContainer: Color(0xFF9CE8FD),
              onSecondaryContainer: Color(0xFF076A7C),
              tertiary: Color(0xFF592000),
              onTertiary: Colors.white,
              tertiaryContainer: Color(0xFF7D3000),
              onTertiaryContainer: Color(0xFFFF9F72),
              error: Color(0xFFBA1A1A),
              onError: Colors.white,
              errorContainer: Color(0xFFFFDAD6),
              onErrorContainer: Color(0xFF93000A),
              surface: surface,
              onSurface: onSurface,
              surfaceContainerLowest: surfaceContainerLowest,
              surfaceContainerLow: surfaceContainerLow,
              surfaceContainer: Color(0xFFEAEDFF),
              surfaceContainerHigh: Color(0xFFE1E7FF),
              surfaceContainerHighest: Color(0xFFDAE2FC),
              onSurfaceVariant: Color(0xFF464555),
              outline: Color(0xFF777587),
              outlineVariant: outlineVariant,
            )
          : normalizedScheme!,
      cardTheme: CardThemeData(
        color: surfaceContainerLowest,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: outlineVariant),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: surfaceContainerLow,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 52),
          backgroundColor: primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}
