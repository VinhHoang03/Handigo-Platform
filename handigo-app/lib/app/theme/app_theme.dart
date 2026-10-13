import 'package:flutter/material.dart';

/// Bảng màu theo DESIGN.md của giao diện Handigo mobile.
abstract final class AppTheme {
  static const primary = Color(0xFF3525CD);
  static const primaryDark = Color(0xFF1E00A9);
  static const secondary = Color(0xFF00687A);
  static const onPrimaryContainer = Color(0xFFB1AFFF);
  static const primaryFixed = Color(0xFFE2DFFF);
  static const onSurfaceVariant = Color(0xFF464555);
  static const outline = Color(0xFF777587);
  static const tertiary = Color(0xFF592000);
  static const tertiaryContainer = Color(0xFF7D3000);
  static const error = Color(0xFFBA1A1A);
  static const onError = Color(0xFFFFFFFF);
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
    final scheme = brightness == Brightness.light
        ? const ColorScheme.light(
            primary: primaryDark,
            onPrimary: Colors.white,
            primaryContainer: primary,
            onPrimaryContainer: onPrimaryContainer,
            primaryFixed: primaryFixed,
            primaryFixedDim: Color(0xFFC3C0FF),
            onPrimaryFixed: Color(0xFF0F0069),
            onPrimaryFixedVariant: Color(0xFF3323CC),
            secondaryFixed: Color(0xFFABEDFF),
            secondaryFixedDim: Color(0xFF86D2E6),
            onSecondaryFixed: Color(0xFF001F26),
            onSecondaryFixedVariant: Color(0xFF004E5C),
            tertiaryFixed: Color(0xFFFFDBCC),
            tertiaryFixedDim: Color(0xFFFFB694),
            onTertiaryFixed: Color(0xFF351000),
            onTertiaryFixedVariant: Color(0xFF7B2F00),
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
            surfaceDim: Color(0xFFD2D9F4),
            surfaceBright: surface,
            surfaceTint: Color(0xFF4D44E3),
            inverseSurface: Color(0xFF283044),
            onInverseSurface: Color(0xFFEEF0FF),
            inversePrimary: Color(0xFFC3C0FF),
          )
        : ColorScheme.fromSeed(seedColor: primary, brightness: brightness);
    final baseText =
        (brightness == Brightness.light
                ? Typography.material2021().black
                : Typography.material2021().white)
            .apply(fontFamily: 'Inter');
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Inter',
      textTheme: baseText.copyWith(
        displayLarge: baseText.displayLarge?.copyWith(
          fontFamily: 'Hanken Grotesk',
        ),
        displayMedium: baseText.displayMedium?.copyWith(
          fontFamily: 'Hanken Grotesk',
        ),
        displaySmall: baseText.displaySmall?.copyWith(
          fontFamily: 'Hanken Grotesk',
        ),
        headlineLarge: baseText.headlineLarge?.copyWith(
          fontFamily: 'Hanken Grotesk',
        ),
        headlineMedium: baseText.headlineMedium?.copyWith(
          fontFamily: 'Hanken Grotesk',
        ),
        headlineSmall: baseText.headlineSmall?.copyWith(
          fontFamily: 'Hanken Grotesk',
        ),
        titleLarge: baseText.titleLarge?.copyWith(fontFamily: 'Hanken Grotesk'),
        titleMedium: baseText.titleMedium?.copyWith(
          fontFamily: 'Hanken Grotesk',
        ),
        titleSmall: baseText.titleSmall?.copyWith(fontFamily: 'Hanken Grotesk'),
      ),
      scaffoldBackgroundColor: scheme.surface,
      colorScheme: scheme,
      cardTheme: CardThemeData(
        color: scheme.surfaceContainerLowest,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .3)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerLow,
        border: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 52),
          backgroundColor: scheme.primaryContainer,
          foregroundColor: scheme.onPrimaryContainer,
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
