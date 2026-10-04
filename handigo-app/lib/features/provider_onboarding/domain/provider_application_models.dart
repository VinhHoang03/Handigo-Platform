class ProviderApplication {
  const ProviderApplication({required this.id, required this.status, this.rejectionReason, this.rejectionNotes, this.onboardingStep, this.description = '', this.experienceYears = 0, this.serviceIds = const [], this.workingAreas = const [], this.identityDocument, this.certificates = const []});
  factory ProviderApplication.fromJson(Map<String, dynamic> json) {
    final identity = json['identityDocument'];
    final certificates = json['certificates'];
    return ProviderApplication(id: _id(json), status: '${json['status'] ?? 'draft'}', rejectionReason: json['rejectionReason'] as String?, rejectionNotes: json['rejectionNotes'] as String?, onboardingStep: (json['onboardingStep'] as num?)?.toInt(), description: '${json['description'] ?? ''}', experienceYears: (json['experienceYears'] as num?)?.toInt() ?? 0, serviceIds: _strings(json['serviceIds']), workingAreas: _strings(json['workingAreas']), identityDocument: identity is Map ? IdentityDocument.fromJson(Map<String, dynamic>.from(identity)) : null, certificates: certificates is List ? certificates.whereType<Map>().map((e) => ProviderCertificate.fromJson(Map<String, dynamic>.from(e))).toList() : const []);
  }
  final String id, status, description;
  final String? rejectionReason, rejectionNotes;
  final int? onboardingStep, experienceYears;
  final List<String> serviceIds, workingAreas;
  final IdentityDocument? identityDocument;
  final List<ProviderCertificate> certificates;
}

class IdentityDocument {
  const IdentityDocument({this.type = 'cccd', this.documentNumber = '', this.fullName = '', this.frontImageUrl, this.backImageUrl, this.passportImageUrl, this.verificationStatus = 'unsubmitted', this.rejectionReason});
  factory IdentityDocument.fromJson(Map<String, dynamic> json) => IdentityDocument(type: '${json['type'] ?? 'cccd'}', documentNumber: '${json['documentNumber'] ?? json['numberLast4'] ?? ''}', fullName: '${json['fullName'] ?? ''}', frontImageUrl: json['frontImageUrl'] as String?, backImageUrl: json['backImageUrl'] as String?, passportImageUrl: json['passportImageUrl'] as String?, verificationStatus: '${json['verificationStatus'] ?? 'unsubmitted'}', rejectionReason: json['rejectionReason'] as String?);
  final String type, documentNumber, fullName, verificationStatus;
  final String? frontImageUrl, backImageUrl, passportImageUrl, rejectionReason;
}

class ProviderCertificate {
  const ProviderCertificate({required this.title, this.certificateNumber, this.issuer, this.imageUrls = const [], this.status = 'pending'});
  factory ProviderCertificate.fromJson(Map<String, dynamic> json) => ProviderCertificate(title: '${json['title'] ?? ''}', certificateNumber: json['certificateNumber'] as String?, issuer: json['issuer'] as String?, imageUrls: _strings(json['imageUrls']), status: '${json['status'] ?? 'pending'}');
  final String title, status;
  final String? certificateNumber, issuer;
  final List<String> imageUrls;
}

List<String> _strings(dynamic value) => value is List ? value.map((item) => item is String ? item : item is Map ? '${item['_id'] ?? item['id'] ?? ''}' : '').where((item) => item.isNotEmpty).toList() : const [];
String _id(Map<String, dynamic> json) => '${json['_id'] ?? json['id'] ?? ''}';
