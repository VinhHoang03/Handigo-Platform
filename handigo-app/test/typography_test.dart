import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';

void main() {
  for (final platform in [TargetPlatform.android, TargetPlatform.iOS]) {
    test('Thang chữ theo design ở $platform, cả sáng và tối', () {
      debugDefaultTargetPlatformOverride = platform;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);
      for (final theme in [AppTheme.light, AppTheme.dark]) {
        final text = theme.textTheme;
        final roles = [
          (text.headlineLarge!, 28.0, FontWeight.w800),
          (text.titleLarge!, 22.0, FontWeight.w600),
          (text.bodyMedium!, 16.0, FontWeight.w400),
          (text.bodySmall!, 13.0, FontWeight.w400),
          (text.labelSmall!, 11.0, FontWeight.w500),
        ];
        for (final (style, size, weight) in roles) {
          expect(style.fontSize, size);
          expect(style.fontWeight, weight);
          expect(style.height, inInclusiveRange(1.4, 1.6));
          expect(
            style.fontFamily,
            platform == TargetPlatform.iOS ? '.SF Pro Text' : 'Roboto',
          );
        }
        expect(theme.appBarTheme.titleTextStyle?.fontSize, 22);
        expect(text.titleMedium?.fontSize, 16);
        expect(text.labelLarge?.fontSize, 16);
      }
    });
  }
}
