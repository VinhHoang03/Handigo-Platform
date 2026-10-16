import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_client.dart';
import '../domain/provider_application_models.dart';

typedef AdministrativeArea = ({int code, String name});

class ProviderApplicationRepository {
  const ProviderApplicationRepository(this._api);
  final ApiClient _api;
  Future<ProviderApplication?> mine() async {
    final data = (await _api.request(
      '/provider-applications/me',
      authenticated: true,
    ))['data'];
    return data is Map
        ? ProviderApplication.fromJson(Map<String, dynamic>.from(data))
        : null;
  }

  Future<ProviderApplication> saveDraft(Map<String, dynamic> payload) async =>
      _parse(
        await _api.request(
          '/provider-applications/me/draft',
          method: 'PATCH',
          data: payload,
          authenticated: true,
        ),
      );
  Future<ProviderApplication> submit(Map<String, dynamic> payload) async =>
      _parse(
        await _api.request(
          '/provider-applications',
          method: 'POST',
          data: payload,
          authenticated: true,
        ),
      );
  Future<ProviderApplication> resubmit(
    String id,
    Map<String, dynamic> payload,
  ) async => _parse(
    await _api.request(
      '/provider-applications/$id/resubmit',
      method: 'PATCH',
      data: payload,
      authenticated: true,
    ),
  );
  Future<String> uploadAsset(
    XFile file, {
    required String purpose,
    required String documentKind,
  }) => _api.uploadProviderApplicationAsset(
    file,
    purpose: purpose,
    documentKind: documentKind,
  );
  Future<ProviderAssetUploadResult> uploadIdentityAsset(
    XFile file, {
    required String documentKind,
    void Function(int sent, int total)? onSendProgress,
  }) => _api.uploadProviderApplicationAssetResult(
    file,
    purpose: 'identity',
    documentKind: documentKind,
    onSendProgress: onSendProgress,
  );
  Future<List<AdministrativeArea>> provinces() =>
      _administrativeAreas('/vietnam-addresses/provinces');
  Future<List<AdministrativeArea>> wards(int provinceCode) =>
      _administrativeAreas('/vietnam-addresses/provinces/$provinceCode/wards');
  Future<List<AdministrativeArea>> _administrativeAreas(String path) async {
    final data = (await _api.request(path))['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) {
          final json = Map<String, dynamic>.from(item);
          return (
            code: (json['code'] as num).toInt(),
            name: '${json['name'] ?? ''}',
          );
        })
        .where((item) => item.name.isNotEmpty)
        .toList();
  }

  ProviderApplication _parse(Map<String, dynamic> response) =>
      ProviderApplication.fromJson(
        Map<String, dynamic>.from(response['data'] as Map),
      );
}
