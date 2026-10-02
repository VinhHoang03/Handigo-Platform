import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_client.dart';
import '../domain/provider_application_models.dart';

class ProviderApplicationRepository {
  const ProviderApplicationRepository(this._api);
  final ApiClient _api;
  Future<ProviderApplication?> mine() async { final data = (await _api.request('/provider-applications/me', authenticated: true))['data']; return data is Map ? ProviderApplication.fromJson(Map<String, dynamic>.from(data)) : null; }
  Future<ProviderApplication> saveDraft(Map<String, dynamic> payload) async => _parse(await _api.request('/provider-applications/me/draft', method: 'PATCH', data: payload, authenticated: true));
  Future<ProviderApplication> submit(Map<String, dynamic> payload) async => _parse(await _api.request('/provider-applications', method: 'POST', data: payload, authenticated: true));
  Future<ProviderApplication> resubmit(String id, Map<String, dynamic> payload) async => _parse(await _api.request('/provider-applications/$id/resubmit', method: 'PATCH', data: payload, authenticated: true));
  Future<String> uploadAsset(XFile file, {required String purpose, required String documentKind}) => _api.uploadProviderApplicationAsset(file, purpose: purpose, documentKind: documentKind);
  ProviderApplication _parse(Map<String, dynamic> response) => ProviderApplication.fromJson(Map<String, dynamic>.from(response['data'] as Map));
}
