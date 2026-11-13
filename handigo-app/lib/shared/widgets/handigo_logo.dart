import 'package:flutter/material.dart';

class HandigoLogo extends StatelessWidget {
  const HandigoLogo({this.height = 36, super.key});

  final double height;

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/brand/handigo-logo.png',
    width: height * 3.1,
    height: height,
    fit: BoxFit.contain,
    semanticLabel: 'Handigo',
  );
}
