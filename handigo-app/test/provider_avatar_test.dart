import 'dart:ui' as ui;
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/shared/widgets/provider_avatar.dart';

class _UnavailableAvatarAssets extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) {
    if (key.contains('assets/avatars/')) {
      throw FlutterError('Không tải được ảnh mặc định thử nghiệm.');
    }
    return rootBundle.load(key);
  }
}

void main() {
  test('Nhận diện avatar Google và chọn asset theo giới tính', () {
    expect(
      isGoogleAvatarUrl('https://lh3.googleusercontent.com/a/avatar'),
      isTrue,
    );
    expect(isGoogleAvatarUrl('https://example.com/avatar.jpg'), isFalse);
    expect(providerFallbackAvatarAsset('female'), providerFemaleAvatarAsset);
    expect(providerFallbackAvatarAsset('nữ'), providerFemaleAvatarAsset);
    expect(providerFallbackAvatarAsset('male'), providerMaleAvatarAsset);
    expect(providerFallbackAvatarAsset(null), providerMaleAvatarAsset);
  });

  testWidgets('Thợ nữ không có avatar dùng asset nữ', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ProviderAvatar(gender: 'female')),
      ),
    );

    final image = tester.widget<Image>(find.byType(Image));
    expect(image.image, isA<AssetImage>());
    expect((image.image as AssetImage).assetName, providerFemaleAvatarAsset);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Avatar Gmail của thợ nam được thay bằng asset nam', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ProviderAvatar(
            url: 'https://lh3.googleusercontent.com/a/avatar',
            gender: 'male',
          ),
        ),
      ),
    );

    final image = tester.widget<Image>(find.byType(Image));
    expect(image.image, isA<AssetImage>());
    expect((image.image as AssetImage).assetName, providerMaleAvatarAsset);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Ảnh mặc định lỗi vẫn có biểu tượng người, không hiện dấu X', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DefaultAssetBundle(
            bundle: _UnavailableAvatarAssets(),
            child: const ProviderAvatar(gender: 'female'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.person_outline_rounded), findsOneWidget);
    expect(find.byType(ErrorWidget), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Hai ảnh mặc định được đóng gói và giải mã được', (tester) async {
    await tester.runAsync(() async {
      for (final asset in [
        providerMaleAvatarAsset,
        providerFemaleAvatarAsset,
      ]) {
        final data = await rootBundle.load(asset);
        final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
        final frame = await codec.getNextFrame();
        expect(frame.image.width, greaterThan(0));
        frame.image.dispose();
        codec.dispose();
      }
    });
    expect(tester.takeException(), isNull);
  });
}
