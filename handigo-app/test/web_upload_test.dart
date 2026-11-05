import 'dart:typed_data';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
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
      final dio = Dio(
        BaseOptions(
          baseUrl: 'https://api.example.com',
          receiveTimeout: const Duration(seconds: 20),
          contentType: Headers.jsonContentType,
        ),
      );
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
            } else {
              expect(Map.fromEntries(form.fields), {
                'purpose': 'order_problem',
              });
              expect(request.receiveTimeout, const Duration(seconds: 90));
              expect(request.sendTimeout, const Duration(seconds: 60));
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
          : await api.uploadOrderAttachment(file, purpose: 'order_problem');
      expect(url, 'https://example.com/anh.png');
    });
  }

  test('Chặn ảnh mô tả vượt quá 5 MB trước khi gửi yêu cầu', () async {
    final dio = Dio();
    final api = ApiClient(dio, CookieJar());
    addTearDown(api.close);
    var requested = false;
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (_, handler) {
          requested = true;
          handler.reject(DioException(requestOptions: RequestOptions()));
        },
      ),
    );
    final file = XFile.fromData(
      Uint8List(5 * 1024 * 1024 + 1),
      name: 'anh.png',
      mimeType: 'image/png',
    );
    await expectLater(
      api.uploadOrderAttachment(file, purpose: 'order_problem'),
      throwsA(
        isA<ApiException>().having(
          (error) => error.message,
          'thông báo',
          'Ảnh không được vượt quá 5 MB.',
        ),
      ),
    );
    expect(requested, isFalse);
  });
}
