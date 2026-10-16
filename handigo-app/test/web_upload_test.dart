import 'dart:typed_data';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:image_picker/image_picker.dart';

void main() {
  for (final providerAsset in [false, true]) {
    test('Tải ảnh từ dữ liệu bộ nhớ, hồ sơ provider: $providerAsset', () async {
      final bytes = Uint8List.fromList([137, 80, 78, 71]);
      final file = XFile.fromData(
        bytes,
        path: 'anh.png',
        name: 'anh.png',
        mimeType: 'image/png',
      );
      final dio = Dio(BaseOptions(baseUrl: 'https://api.example.com'));
      final api = ApiClient(dio, CookieJar());
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) async {
            expect(
              request.path,
              providerAsset
                  ? '/provider-application-assets/images'
                  : '/orders/attachments',
            );
            expect(request.headers['Authorization'], 'Bearer test-token');
            final form = request.data as FormData;
            final part = form.files.single;
            expect(part.key, 'image');
            expect(part.value.filename, 'anh.png');
            expect(part.value.contentType.toString(), 'image/png');
            final content = await part.value.finalize().toList();
            expect(content.expand((chunk) => chunk).toList(), bytes);
            if (providerAsset) {
              expect(Map.fromEntries(form.fields), {
                'purpose': 'identity',
                'documentKind': 'cccd_front',
              });
            }
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'data': {'url': 'https://example.com/anh.png'},
                },
              ),
            );
          },
        ),
      );
      api.setToken('test-token');
      final url = providerAsset
          ? await api.uploadProviderApplicationAsset(
              file,
              purpose: 'identity',
              documentKind: 'cccd_front',
            )
          : await api.uploadOrderAttachment(file);
      expect(url, 'https://example.com/anh.png');
    });
  }
}
