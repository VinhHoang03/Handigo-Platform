import 'package:flutter/material.dart';

Color? categoryIconColor(String? value) {
  if (value == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value)) {
    return null;
  }
  return Color(0xff000000 | int.parse(value.substring(1), radix: 16));
}
