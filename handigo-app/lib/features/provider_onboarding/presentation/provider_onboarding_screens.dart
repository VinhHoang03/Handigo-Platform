import '../../../shared/widgets/app_search_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/providers/app_providers.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../data/provider_application_repository.dart';
import '../domain/provider_application_models.dart';

final providerApplicationRepositoryProvider = Provider(
  (ref) => ProviderApplicationRepository(ref.watch(apiClientProvider)),
);
final providerApplicationProvider = FutureProvider<ProviderApplication?>(
  (ref) => ref.watch(providerApplicationRepositoryProvider).mine(),
);
final vietnamProvincesProvider = FutureProvider<List<AdministrativeArea>>(
  (ref) => ref.watch(providerApplicationRepositoryProvider).provinces(),
);
final vietnamWardsProvider =
    FutureProvider.family<List<AdministrativeArea>, int>(
      (ref, provinceCode) =>
          ref.watch(providerApplicationRepositoryProvider).wards(provinceCode),
    );

enum _IdentityProcess { idle, uploading, reading }

class ProviderOnboardingScreen extends ConsumerStatefulWidget {
  const ProviderOnboardingScreen({super.key});

  @override
  ConsumerState<ProviderOnboardingScreen> createState() =>
      _ProviderOnboardingScreenState();
}

class _ProviderOnboardingScreenState
    extends ConsumerState<ProviderOnboardingScreen> {
  final description = TextEditingController();
  final experience = TextEditingController(text: '3');
  final area = TextEditingController();
  final fullName = TextEditingController();
  final documentNumber = TextEditingController();
  final dateOfBirth = TextEditingController();
  final nationality = TextEditingController();
  final placeOfOrigin = TextEditingController();
  final placeOfResidence = TextEditingController();
  final issuedAt = TextEditingController();
  final expiresAt = TextEditingController();
  final issuedPlace = TextEditingController();
  final serviceSearch = TextEditingController();
  final wardSearch = TextEditingController();
  final certificateTitles = <TextEditingController>[];
  final certificateIssuers = <TextEditingController>[];
  final certificateIssuedAts = <TextEditingController>[];
  final certificateUrls = <String>[];
  final certificateNames = <String>[];
  final selectedServices = <String>{};
  final selectedWards = <String>{};
  final fullNameFocus = FocusNode();

  int step = 1;
  int profilePage = 0;
  int identityReviewPage = 0;
  int flowDirection = 1;
  bool started = false;
  bool saving = false;
  bool _didHydrate = false;
  bool returnToSummary = false;
  bool identityReviewCompleted = false;
  String documentType = 'cccd';
  String? gender;
  String serviceQuery = '';
  String wardQuery = '';
  String? expandedCategory;
  int? selectedProvinceCode;
  String? selectedProvinceName;
  _IdentityProcess identityProcess = _IdentityProcess.idle;
  double uploadProgress = 0;
  String? activeDocumentName;
  String activeDocumentLabel = 'giấy tờ';
  String? frontName;
  String? backName;
  String? passportName;
  List<String> ocrWarnings = const [];
  bool ignoreCurrentOcr = false;
  String? frontUrl, backUrl, passportUrl;
  ProviderApplication? current;

  @override
  void initState() {
    super.initState();
    fullNameFocus.addListener(_refreshFocusState);
  }

  void _refreshFocusState() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    description.dispose();
    experience.dispose();
    area.dispose();
    fullName.dispose();
    documentNumber.dispose();
    dateOfBirth.dispose();
    nationality.dispose();
    placeOfOrigin.dispose();
    placeOfResidence.dispose();
    issuedAt.dispose();
    expiresAt.dispose();
    issuedPlace.dispose();
    for (final controller in [
      ...certificateTitles,
      ...certificateIssuers,
      ...certificateIssuedAts,
    ]) {
      controller.dispose();
    }
    serviceSearch.dispose();
    wardSearch.dispose();
    fullNameFocus
      ..removeListener(_refreshFocusState)
      ..dispose();
    super.dispose();
  }

  void hydrate(ProviderApplication? item) {
    if (_didHydrate) return;
    _didHydrate = true;
    current = item;
    if (item == null) return;
    started = true;
    step = (item.onboardingStep ?? 1).clamp(1, 3);
    description.text = item.description;
    experience.text = '${item.experienceYears}';
    area.text = item.workingAreas.join('; ');
    for (final workingArea in item.workingAreas) {
      final parts = workingArea.split(',').map((part) => part.trim()).toList();
      if (parts.length < 2) continue;
      selectedWards.add(parts.first);
      selectedProvinceName = parts.sublist(1).join(', ');
    }
    selectedServices.addAll(item.serviceIds);
    final identity = item.identityDocument;
    if (identity != null) {
      documentType = identity.type;
      fullName.text = identity.fullName;
      documentNumber.text = identity.documentNumber;
      dateOfBirth.text = _displayDate(identity.dateOfBirth);
      nationality.text = identity.nationality ?? '';
      placeOfOrigin.text = identity.placeOfOrigin ?? '';
      placeOfResidence.text = identity.placeOfResidence ?? '';
      issuedAt.text = _displayDate(identity.issuedAt);
      expiresAt.text = _displayDate(identity.expiresAt);
      issuedPlace.text = identity.issuedPlace ?? '';
      gender = identity.gender;
      frontUrl = identity.frontImageUrl;
      backUrl = identity.backImageUrl;
      passportUrl = identity.passportImageUrl;
      identityReviewCompleted = _identityInformationComplete;
    }
    for (final certificate in item.certificates) {
      if (certificate.imageUrls.isEmpty) continue;
      certificateTitles.add(TextEditingController(text: certificate.title));
      certificateIssuers.add(
        TextEditingController(text: certificate.issuer ?? ''),
      );
      certificateIssuedAts.add(
        TextEditingController(text: _displayDate(certificate.issuedAt)),
      );
      certificateUrls.add(certificate.imageUrls.first);
      certificateNames.add('Chứng chỉ đã tải');
    }
  }

  Map<String, dynamic> _payload({bool submit = false}) => {
    'description': description.text.trim(),
    'experienceYears': int.tryParse(experience.text) ?? 0,
    'serviceIds': selectedServices.toList(),
    'workingAreas': area.text
        .split(';')
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList(),
    'identityDocument': {
      'type': documentType,
      'documentNumber': documentNumber.text.trim(),
      'fullName': fullName.text.trim(),
      if (_apiDate(dateOfBirth.text) != null)
        'dateOfBirth': _apiDate(dateOfBirth.text),
      if (gender != null) 'gender': gender,
      if (nationality.text.trim().isNotEmpty)
        'nationality': nationality.text.trim(),
      if (placeOfOrigin.text.trim().isNotEmpty)
        'placeOfOrigin': placeOfOrigin.text.trim(),
      if (placeOfResidence.text.trim().isNotEmpty)
        'placeOfResidence': placeOfResidence.text.trim(),
      if (_apiDate(issuedAt.text) != null) 'issuedAt': _apiDate(issuedAt.text),
      if (_apiDate(expiresAt.text) != null)
        'expiresAt': _apiDate(expiresAt.text),
      if (issuedPlace.text.trim().isNotEmpty)
        'issuedPlace': issuedPlace.text.trim(),
      if (frontUrl != null) 'frontImageUrl': frontUrl,
      if (backUrl != null) 'backImageUrl': backUrl,
      if (passportUrl != null) 'passportImageUrl': passportUrl,
    },
    'onboardingStep': step,
    'certificates': List.generate(certificateUrls.length, (index) {
      final issuedDate = _apiDate(certificateIssuedAts[index].text);
      return {
        'title': certificateTitles[index].text.trim(),
        if (certificateIssuers[index].text.trim().isNotEmpty)
          'issuer': certificateIssuers[index].text.trim(),
        'issuedAt': ?issuedDate,
        'imageUrls': [certificateUrls[index]],
      };
    }),
  };

  Future<void> _save() async {
    setState(() => saving = true);
    try {
      current = await ref
          .read(providerApplicationRepositoryProvider)
          .saveDraft(_payload());
      ref.invalidate(providerApplicationProvider);
      if (mounted) _message('Đã lưu bản nháp.');
    } catch (error) {
      if (mounted) _message('Không thể lưu bản nháp: $error');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _submit() async {
    final certificatesValid = certificateTitles.every(
      (controller) => controller.text.trim().isNotEmpty,
    );
    if (selectedServices.isEmpty ||
        area.text.trim().isEmpty ||
        description.text.trim().isEmpty ||
        fullName.text.trim().isEmpty ||
        documentNumber.text.trim().isEmpty ||
        !_identityImagesComplete ||
        !certificatesValid) {
      _message('Vui lòng hoàn thiện đầy đủ thông tin hồ sơ.');
      return;
    }
    setState(() => saving = true);
    try {
      final repository = ref.read(providerApplicationRepositoryProvider);
      final result = current?.status == 'rejected'
          ? await repository.resubmit(current!.id, _payload(submit: true))
          : await repository.submit(_payload(submit: true));
      ref.invalidate(providerApplicationProvider);
      if (mounted) setState(() => current = result);
    } catch (error) {
      if (mounted) _message('Không thể gửi hồ sơ: $error');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _pickIdentity(bool front) async {
    if (saving) return;
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (file == null) return;
    final previousName = documentType == 'passport'
        ? passportName
        : (front ? frontName : backName);
    setState(() {
      saving = true;
      identityReviewCompleted = false;
      identityProcess = _IdentityProcess.uploading;
      uploadProgress = 0;
      activeDocumentName = file.name;
      activeDocumentLabel = documentType == 'passport'
          ? 'hộ chiếu'
          : (front ? 'mặt trước' : 'mặt sau');
      if (documentType == 'passport') {
        passportName = file.name;
      } else if (front) {
        frontName = file.name;
      } else {
        backName = file.name;
      }
      ocrWarnings = const [];
      ignoreCurrentOcr = false;
    });
    try {
      final kind = documentType == 'passport'
          ? 'passport'
          : (front ? 'cccd_front' : 'cccd_back');
      final result = await ref
          .read(providerApplicationRepositoryProvider)
          .uploadIdentityAsset(
            file,
            documentKind: kind,
            onSendProgress: (sent, total) {
              if (!mounted || total <= 0) return;
              final progress = sent / total;
              setState(() {
                uploadProgress = progress.clamp(0.0, 1.0).toDouble();
                if (sent >= total && !ignoreCurrentOcr) {
                  identityProcess = _IdentityProcess.reading;
                }
              });
            },
          );
      if (!mounted) return;
      setState(() {
        if (documentType == 'passport') {
          passportUrl = result.url;
          passportName = file.name;
        } else if (front) {
          frontUrl = result.url;
          frontName = file.name;
        } else {
          backUrl = result.url;
          backName = file.name;
        }
        final suggestion = result.ocrSuggestion;
        final suggestedName = suggestion?['fullName'];
        final suggestedNumber = suggestion?['documentNumber'];
        if (!ignoreCurrentOcr &&
            suggestedName is String &&
            suggestedName.trim().isNotEmpty) {
          fullName.text = suggestedName.trim();
        }
        if (!ignoreCurrentOcr &&
            suggestedNumber is String &&
            suggestedNumber.trim().isNotEmpty) {
          documentNumber.text = suggestedNumber.trim();
        }
        if (!ignoreCurrentOcr) {
          _applyOcrText(suggestion, 'dateOfBirth', dateOfBirth, date: true);
          _applyOcrText(suggestion, 'nationality', nationality);
          _applyOcrText(suggestion, 'placeOfOrigin', placeOfOrigin);
          _applyOcrText(suggestion, 'placeOfResidence', placeOfResidence);
          _applyOcrText(suggestion, 'issuedAt', issuedAt, date: true);
          _applyOcrText(suggestion, 'expiresAt', expiresAt, date: true);
          _applyOcrText(suggestion, 'issuedPlace', issuedPlace);
          final suggestedGender = suggestion?['gender'];
          if (suggestedGender is String &&
              {'male', 'female', 'other'}.contains(suggestedGender)) {
            gender = suggestedGender;
          }
        }
        final warnings = suggestion?['warnings'];
        if (warnings is List) {
          ocrWarnings = warnings.whereType<String>().toList();
        }
        identityProcess = _IdentityProcess.idle;
        if (!ignoreCurrentOcr && _identityImagesComplete) {
          flowDirection = 1;
          identityReviewPage = 1;
        }
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          identityProcess = _IdentityProcess.idle;
          if (documentType == 'passport') {
            passportName = previousName;
          } else if (front) {
            frontName = previousName;
          } else {
            backName = previousName;
          }
        });
        _message('Tải giấy tờ thất bại: $error');
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  void _applyOcrText(
    Map<String, dynamic>? suggestion,
    String key,
    TextEditingController controller, {
    bool date = false,
  }) {
    final value = suggestion?[key];
    if (value is! String || value.trim().isEmpty) return;
    controller.text = date ? _displayDate(value) : value.trim();
  }

  String _displayDate(String? value) {
    if (value == null || value.trim().isEmpty) return '';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value.trim();
    final day = parsed.day.toString().padLeft(2, '0');
    final month = parsed.month.toString().padLeft(2, '0');
    return '$day/$month/${parsed.year}';
  }

  String? _apiDate(String value) {
    final input = value.trim();
    if (input.isEmpty) return null;
    final parts = input.split('/');
    if (parts.length == 3) {
      final day = int.tryParse(parts[0]);
      final month = int.tryParse(parts[1]);
      final year = int.tryParse(parts[2]);
      if (day != null && month != null && year != null) {
        final date = DateTime.tryParse(
          '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}',
        );
        if (date != null &&
            date.day == day &&
            date.month == month &&
            date.year == year) {
          return date.toIso8601String();
        }
      }
      return null;
    }
    return DateTime.tryParse(input)?.toIso8601String();
  }

  bool _isValidOptionalDate(String value) =>
      value.trim().isEmpty || _apiDate(value) != null;

  bool get _identityImagesComplete => documentType == 'passport'
      ? passportUrl != null
      : frontUrl != null && backUrl != null;

  bool get _identityInformationComplete =>
      _identityImagesComplete &&
      fullName.text.trim().isNotEmpty &&
      documentNumber.text.trim().isNotEmpty;

  Future<void> _pickCertificate() async {
    if (saving) return;
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (file == null) return;
    setState(() => saving = true);
    try {
      final result = await ref
          .read(providerApplicationRepositoryProvider)
          .uploadCertificateAsset(file);
      if (!mounted) return;
      final suggestion = result.ocrSuggestion;
      final suggestedTitle = suggestion?['title'];
      final suggestedIssuer = suggestion?['issuer'];
      final suggestedIssuedAt = suggestion?['issuedAt'];
      final fallbackTitle = file.name
          .replaceFirst(RegExp(r'\.[^.]+$'), '')
          .replaceAll(RegExp(r'[_-]+'), ' ')
          .trim();
      setState(() {
        certificateTitles.add(
          TextEditingController(
            text: suggestedTitle is String && suggestedTitle.trim().isNotEmpty
                ? suggestedTitle.trim()
                : fallbackTitle,
          ),
        );
        certificateIssuers.add(
          TextEditingController(
            text: suggestedIssuer is String ? suggestedIssuer.trim() : '',
          ),
        );
        certificateIssuedAts.add(
          TextEditingController(
            text: suggestedIssuedAt is String
                ? _displayDate(suggestedIssuedAt)
                : '',
          ),
        );
        certificateUrls.add(result.url);
        certificateNames.add(file.name);
      });
    } catch (error) {
      if (mounted) _message('Tải chứng chỉ thất bại: $error');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _editCertificate(int index) async {
    final title = TextEditingController(text: certificateTitles[index].text);
    final issuer = TextEditingController(text: certificateIssuers[index].text);
    final date = TextEditingController(text: certificateIssuedAts[index].text);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _C.surface,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.viewInsetsOf(sheetContext).bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Chỉnh sửa chứng chỉ', style: _T.heading),
              const SizedBox(height: 16),
              _OcrField(label: 'Tên chứng chỉ', controller: title),
              const SizedBox(height: 10),
              _OcrField(label: 'Đơn vị cấp', controller: issuer),
              const SizedBox(height: 10),
              _OcrField(
                label: 'Ngày cấp',
                controller: date,
                hint: 'dd/mm/yyyy',
                keyboardType: TextInputType.datetime,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: () => Navigator.of(sheetContext).pop(true),
                  child: const Text('Lưu thay đổi'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (saved == true && mounted) {
      if (title.text.trim().isEmpty) {
        _message('Tên chứng chỉ không được để trống.');
      } else if (!_isValidOptionalDate(date.text)) {
        _message('Ngày cấp chứng chỉ không hợp lệ.');
      } else {
        setState(() {
          certificateTitles[index].text = title.text.trim();
          certificateIssuers[index].text = issuer.text.trim();
          certificateIssuedAts[index].text = date.text.trim();
        });
      }
    }
    title.dispose();
    issuer.dispose();
    date.dispose();
  }

  void _removeCertificate(int index) {
    late final TextEditingController title;
    late final TextEditingController issuer;
    late final TextEditingController date;
    setState(() {
      title = certificateTitles.removeAt(index);
      issuer = certificateIssuers.removeAt(index);
      date = certificateIssuedAts.removeAt(index);
      certificateUrls.removeAt(index);
      certificateNames.removeAt(index);
    });
    title.dispose();
    issuer.dispose();
    date.dispose();
  }

  void _message(String value) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(value)));
  }

  @override
  Widget build(BuildContext context) {
    final application = ref.watch(providerApplicationProvider);
    return Scaffold(
      backgroundColor: _C.background,
      body: SafeArea(
        child: application.when(
          loading: () =>
              const Center(child: CircularProgressIndicator(color: _C.primary)),
          error: (error, stackTrace) => _networkError(),
          data: (item) {
            hydrate(item);
            if ({
              'pending',
              'resubmitted',
              'approved',
            }.contains(current?.status)) {
              return _statusView(current!);
            }
            if (!started) return _introduction();
            return _form();
          },
        ),
      ),
    );
  }

  Widget _introduction() => Column(
    children: [
      _topBar('Đăng ký làm đối tác', help: true),
      Expanded(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          children: const [
            Text('HANDIGO · ĐỐI TÁC', style: _T.overline),
            SizedBox(height: 9),
            Text('Chủ động công việc,\ntăng thêm thu nhập', style: _T.hero),
            SizedBox(height: 14),
            _IntroArtwork(),
            SizedBox(height: 16),
            _Benefit(
              Icons.location_on_outlined,
              'Việc gần bạn',
              'Chọn khu vực bạn muốn nhận việc.',
            ),
            SizedBox(height: 14),
            _Benefit(
              Icons.verified_user_outlined,
              'Bảo hiểm 24/7',
              'An tâm hơn khi đồng hành cùng Handigo.',
            ),
            SizedBox(height: 14),
            _Benefit(
              Icons.account_balance_wallet_outlined,
              'Thu nhập minh bạch',
              'Theo dõi công việc và thu nhập rõ ràng.',
            ),
            SizedBox(height: 18),
            _ReferralCard(),
          ],
        ),
      ),
      _ActionBar(
        label: 'Bắt đầu đăng ký',
        onPrimary: () => setState(() => started = true),
      ),
    ],
  );

  Widget _form() => Column(
    children: [
      _topBar('Đăng ký làm đối tác', onBack: _back, help: true),
      _Progress(step),
      if (current?.status == 'rejected') _rejection(current!),
      Expanded(child: _animatedStepBody()),
      _ActionBar(
        label: _primaryActionLabel,
        onPrimary:
            (step == 1 && selectedServices.isEmpty) ||
                (step == 2 && selectedWards.isEmpty)
            ? null
            : _continue,
        onSave: step == 1 ? _save : null,
        onSecondary: step > 1 || returnToSummary ? _back : null,
        saving: saving,
      ),
    ],
  );

  String get _flowKey {
    if (step == 1) return 'services';
    if (step == 2) return 'areas';
    if (profilePage == 0) return 'identity-$identityReviewPage';
    if (profilePage == 1) return 'experience';
    if (profilePage == 2) return 'certificates';
    return 'summary';
  }

  Widget _animatedStepBody() {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final currentKey = ValueKey(_flowKey);
    return ClipRect(
      child: AnimatedSwitcher(
        duration: reduceMotion
            ? Duration.zero
            : const Duration(milliseconds: 260),
        reverseDuration: reduceMotion
            ? Duration.zero
            : const Duration(milliseconds: 220),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        layoutBuilder: (currentChild, previousChildren) => Stack(
          alignment: Alignment.topCenter,
          children: [...previousChildren, ?currentChild],
        ),
        transitionBuilder: (child, animation) {
          final incoming = child.key == currentKey;
          final offset = Offset((incoming ? 1 : -1) * flowDirection * 0.08, 0);
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: offset,
                end: Offset.zero,
              ).animate(animation),
              child: child,
            ),
          );
        },
        child: KeyedSubtree(key: currentKey, child: _stepBody()),
      ),
    );
  }

  String get _primaryActionLabel {
    if (returnToSummary && (step < 3 || profilePage == 1 || profilePage == 2)) {
      return 'Lưu thay đổi';
    }
    if (step != 3) return 'Tiếp tục';
    if (profilePage == 0 && identityReviewPage == 1) {
      return fullNameFocus.hasFocus ? 'Lưu và tiếp tục' : 'Tiếp tục kiểm tra';
    }
    if (profilePage == 0 && identityReviewPage == 2) {
      return returnToSummary ? 'Lưu thay đổi' : 'Lưu thông tin giấy tờ';
    }
    if (profilePage == 2) return 'Xem tóm tắt hồ sơ';
    if (profilePage == 3) {
      return current?.status == 'rejected'
          ? 'Gửi lại hồ sơ'
          : 'Gửi hồ sơ xét duyệt';
    }
    return profilePage == 1 ? 'Lưu và tiếp tục' : 'Tiếp tục';
  }

  void _continue() {
    if (step == 1) {
      if (selectedServices.isEmpty) {
        _message('Vui lòng chọn ít nhất một dịch vụ.');
      } else if (returnToSummary) {
        setState(() {
          flowDirection = 1;
          step = 3;
          profilePage = 3;
          returnToSummary = false;
        });
      } else {
        setState(() {
          flowDirection = 1;
          step = 2;
        });
      }
      return;
    }
    if (step == 2) {
      if (area.text.trim().isEmpty) {
        _message('Vui lòng nhập ít nhất một khu vực hoạt động.');
      } else if (returnToSummary) {
        setState(() {
          flowDirection = 1;
          step = 3;
          profilePage = 3;
          returnToSummary = false;
        });
      } else {
        setState(() {
          flowDirection = 1;
          step = 3;
        });
      }
      return;
    }
    if (profilePage == 0) {
      if (identityReviewPage == 0) {
        if (!_identityImagesComplete) {
          _message(
            documentType == 'passport'
                ? 'Vui lòng tải ảnh hộ chiếu để tiếp tục.'
                : 'Vui lòng tải đủ mặt trước và mặt sau CCCD để tiếp tục.',
          );
        } else {
          setState(() {
            flowDirection = 1;
            identityReviewPage = 1;
          });
        }
        return;
      }
      if (identityReviewPage == 1) {
        if (!_identityImagesComplete) {
          setState(() {
            flowDirection = -1;
            identityReviewPage = 0;
          });
          _message(
            documentType == 'passport'
                ? 'Vui lòng tải ảnh hộ chiếu trước.'
                : 'Vui lòng tải đủ mặt trước và mặt sau CCCD trước.',
          );
        } else if (fullName.text.trim().isEmpty ||
            documentNumber.text.trim().isEmpty) {
          _message('Vui lòng nhập họ tên và số giấy tờ.');
        } else if (!_isValidOptionalDate(dateOfBirth.text)) {
          _message('Ngày sinh phải có định dạng ngày/tháng/năm hợp lệ.');
        } else {
          setState(() {
            flowDirection = 1;
            identityReviewPage = 2;
          });
        }
        return;
      }
      if (!_isValidOptionalDate(issuedAt.text) ||
          !_isValidOptionalDate(expiresAt.text)) {
        _message(
          'Ngày cấp và hạn dùng phải có định dạng ngày/tháng/năm hợp lệ.',
        );
        return;
      }
      setState(() {
        flowDirection = 1;
        identityReviewCompleted = true;
        if (returnToSummary) {
          profilePage = 3;
          returnToSummary = false;
        } else {
          profilePage = 1;
        }
      });
      return;
    }
    if (profilePage == 1) {
      if (description.text.trim().isEmpty) {
        _message('Vui lòng mô tả kinh nghiệm làm việc.');
      } else {
        setState(() {
          flowDirection = 1;
          if (returnToSummary) {
            profilePage = 3;
            returnToSummary = false;
          } else {
            profilePage = 2;
          }
        });
      }
      return;
    }
    if (profilePage == 2) {
      final invalidTitle = certificateTitles.any(
        (controller) => controller.text.trim().isEmpty,
      );
      final invalidDate = certificateIssuedAts.any(
        (controller) => !_isValidOptionalDate(controller.text),
      );
      if (invalidTitle) {
        _message('Vui lòng bổ sung tên cho tất cả chứng chỉ.');
      } else if (invalidDate) {
        _message('Ngày cấp chứng chỉ không hợp lệ.');
      } else {
        setState(() {
          flowDirection = 1;
          profilePage = 3;
          returnToSummary = false;
        });
      }
      return;
    }
    _submit();
  }

  void _back() {
    flowDirection = -1;
    if (returnToSummary) {
      setState(() {
        step = 3;
        profilePage = 3;
        returnToSummary = false;
      });
    } else if (step == 3 && profilePage == 0 && identityReviewPage > 0) {
      setState(() => identityReviewPage--);
    } else if (step == 3 && profilePage > 0) {
      setState(() => profilePage--);
    } else if (step > 1) {
      setState(() => step--);
    } else if (current == null) {
      setState(() => started = false);
    } else if (context.canPop()) {
      context.pop();
    }
  }

  Widget _stepBody() {
    if (step == 1) return _serviceStep();
    if (step == 2) return _areaStep();
    if (profilePage == 0) return _identityStep();
    if (profilePage == 1) return _experienceStep();
    if (profilePage == 2) return _certificateStep();
    return _summaryStep();
  }

  Widget _serviceStep() {
    final user = ref.watch(authControllerProvider).user;
    return _page(
      title: 'Dịch vụ và kinh nghiệm',
      subtitle: 'Chọn nhiều dịch vụ cụ thể bạn có thể làm.',
      children: [
        Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: _C.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: _C.primarySoft,
                child: Text(
                  _initials(user?.fullName ?? ''),
                  style: const TextStyle(
                    color: _C.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user?.fullName ?? 'Tài khoản Handigo',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: _C.ink,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      user?.email ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _T.micro,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.lock_outline_rounded, size: 17, color: _C.muted),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppSearchField(
          controller: serviceSearch,
          onChanged: (value) => setState(() => serviceQuery = value.trim()),
          hintText: 'Tìm dịch vụ',
        ),
        const SizedBox(height: 18),
        _services(),
        const SizedBox(height: 18),
        _experienceSelector(),
      ],
    );
  }

  Widget _services() {
    final services = ref.watch(serviceCatalogServicesProvider(null));
    return services.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(48),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stackTrace) => _Empty(
        Icons.cloud_off_outlined,
        'Không thể tải dịch vụ',
        'Vui lòng kiểm tra kết nối và thử lại.',
        action: () => ref.invalidate(serviceCatalogServicesProvider(null)),
      ),
      data: (page) {
        final query = serviceQuery.toLowerCase();
        final visible = page.items
            .where(
              (service) =>
                  query.isEmpty ||
                  service.name.toLowerCase().contains(query) ||
                  (service.categoryName ?? '').toLowerCase().contains(query),
            )
            .toList();
        final groups = <String, List<dynamic>>{};
        for (final service in visible) {
          groups
              .putIfAbsent(service.categoryName ?? 'Dịch vụ khác', () => [])
              .add(service);
        }
        if (groups.isEmpty) {
          return const _Empty(
            Icons.search_off_rounded,
            'Không có kết quả',
            'Thử tìm bằng một từ khóa khác.',
          );
        }
        expandedCategory ??= groups.keys.first;
        return Column(
          children: groups.entries.map((entry) {
            final open = expandedCategory == entry.key || query.isNotEmpty;
            final count = entry.value
                .where((service) => selectedServices.contains(service.id))
                .length;
            return _ServiceGroup(
              title: entry.key,
              subtitle: _categoryHint(entry.key),
              open: open,
              selectedCount: count,
              onToggle: () =>
                  setState(() => expandedCategory = open ? '' : entry.key),
              children: entry.value.map<Widget>((service) {
                final selected = selectedServices.contains(service.id);
                return _ServiceCheck(
                  label: service.name,
                  selected: selected,
                  onTap: () => setState(
                    () => selected
                        ? selectedServices.remove(service.id)
                        : selectedServices.add(service.id),
                  ),
                );
              }).toList(),
            );
          }).toList(),
        );
      },
    );
  }

  Widget _experienceSelector() {
    final years = int.tryParse(experience.text) ?? 0;
    final selected = years <= 2 ? 0 : (years <= 5 ? 1 : 2);
    const labels = ['1–2 năm', '3–5 năm', 'Trên 5 năm'];
    const values = [1, 3, 6];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Kinh nghiệm',
          style: TextStyle(
            color: _C.ink,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: List.generate(labels.length, (index) {
            final active = selected == index;
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: index < 2 ? 8 : 0),
                child: SizedBox(
                  height: 46,
                  child: Material(
                    color: active ? _C.primary : _C.primarySoft,
                    borderRadius: BorderRadius.circular(10),
                    child: InkWell(
                      onTap: () =>
                          setState(() => experience.text = '${values[index]}'),
                      borderRadius: BorderRadius.circular(10),
                      child: Center(
                        child: Text(
                          labels[index],
                          style: TextStyle(
                            color: active ? Colors.white : _C.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 10),
        const Text('Chọn ít nhất 1 dịch vụ để tiếp tục.', style: _T.micro),
      ],
    );
  }

  Widget _areaStep() {
    final provinces = ref.watch(vietnamProvincesProvider);
    return provinces.when(
      loading: () => _areaPage(
        provinceControl: const _AreaSkeleton(lines: 1),
        wardContent: const _WardLoading(),
      ),
      error: (error, stackTrace) => _areaPage(
        provinceControl: const SizedBox.shrink(),
        wardContent: _Empty(
          Icons.cloud_off_outlined,
          'Không thể tải khu vực',
          'Vui lòng kiểm tra kết nối và thử lại.',
          action: () => ref.invalidate(vietnamProvincesProvider),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return _areaPage(
            provinceControl: const SizedBox.shrink(),
            wardContent: const _Empty(
              Icons.location_off_outlined,
              'Chưa có dữ liệu khu vực',
              'Danh sách tỉnh/thành hiện chưa khả dụng.',
            ),
          );
        }
        if (selectedProvinceCode == null) {
          var selected = items.first;
          for (final item in items) {
            final matchesSaved =
                selectedProvinceName != null &&
                item.name.toLowerCase() == selectedProvinceName!.toLowerCase();
            if (matchesSaved ||
                (selectedProvinceName == null &&
                    item.name.toLowerCase().contains('hồ chí minh'))) {
              selected = item;
              break;
            }
          }
          selectedProvinceCode = selected.code;
          selectedProvinceName = selected.name;
        }
        final wards = ref.watch(vietnamWardsProvider(selectedProvinceCode!));
        return _areaPage(
          provinceControl: DropdownButtonFormField<int>(
            key: ValueKey(selectedProvinceCode),
            initialValue: selectedProvinceCode,
            isExpanded: true,
            icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18),
            decoration: _input(),
            items: items
                .map(
                  (item) => DropdownMenuItem(
                    value: item.code,
                    child: Text(
                      item.name,
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                )
                .toList(),
            onChanged: (code) {
              if (code == null || code == selectedProvinceCode) return;
              final selected = items.firstWhere((item) => item.code == code);
              setState(() {
                selectedProvinceCode = selected.code;
                selectedProvinceName = selected.name;
                selectedWards.clear();
                area.clear();
                wardQuery = '';
                wardSearch.clear();
              });
            },
          ),
          wardContent: wards.when(
            loading: () => const _WardLoading(),
            error: (error, stackTrace) => _WardError(
              onRetry: () =>
                  ref.invalidate(vietnamWardsProvider(selectedProvinceCode!)),
            ),
            data: _wardResults,
          ),
        );
      },
    );
  }

  Widget _areaPage({
    required Widget provinceControl,
    required Widget wardContent,
  }) => _page(
    title: 'Khu vực hoạt động',
    subtitle: 'Chọn một tỉnh/thành và nhiều phường/xã bạn muốn nhận việc.',
    children: [
      _label('Tỉnh / thành phố'),
      const SizedBox(height: 8),
      provinceControl,
      const SizedBox(height: 12),
      _label('Phường / xã'),
      const SizedBox(height: 3),
      const Text(
        'Tất cả khu vực phải cùng tỉnh/thành. Đổi tỉnh/thành sẽ yêu cầu chọn lại phường/xã.',
        style: _T.micro,
      ),
      if (selectedWards.isNotEmpty) ...[
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: selectedWards
              .map(
                (ward) => _AreaChip(
                  label: ward,
                  onDeleted: () => setState(() {
                    selectedWards.remove(ward);
                    _syncWorkingAreas();
                  }),
                ),
              )
              .toList(),
        ),
      ],
      const SizedBox(height: 10),
      AppSearchField(
        controller: wardSearch,
        onChanged: (value) => setState(() => wardQuery = value.trim()),
        hintText: 'Tìm phường / xã',
      ),
      const SizedBox(height: 10),
      wardContent,
    ],
  );

  Widget _wardResults(List<AdministrativeArea> wards) {
    final query = wardQuery.toLowerCase();
    final visible = wards
        .where(
          (ward) => query.isEmpty || ward.name.toLowerCase().contains(query),
        )
        .toList();
    if (visible.isEmpty) {
      return _WardEmpty(
        query: wardQuery,
        onClear: () => setState(() {
          wardQuery = '';
          wardSearch.clear();
        }),
      );
    }
    return Column(
      children: visible
          .map(
            (ward) => _ServiceCheck(
              label: ward.name,
              selected: selectedWards.contains(ward.name),
              onTap: () => setState(() {
                if (!selectedWards.add(ward.name)) {
                  selectedWards.remove(ward.name);
                }
                _syncWorkingAreas();
              }),
            ),
          )
          .toList(),
    );
  }

  void _syncWorkingAreas() {
    final province = selectedProvinceName;
    area.text = province == null
        ? ''
        : selectedWards.map((ward) => '$ward, $province').join('; ');
  }

  void _openProfileSection(int targetPage) {
    if (targetPage > 0 && !_identityInformationComplete) {
      setState(() {
        flowDirection = 1;
        profilePage = 0;
        identityReviewPage = _identityImagesComplete ? 1 : 0;
      });
      _message(
        _identityImagesComplete
            ? 'Vui lòng kiểm tra và hoàn tất thông tin giấy tờ trước.'
            : documentType == 'passport'
            ? 'Vui lòng tải ảnh hộ chiếu trước.'
            : 'Vui lòng tải đủ hai mặt CCCD trước.',
      );
      return;
    }
    if (targetPage > 0 && !identityReviewCompleted) {
      setState(() {
        flowDirection = 1;
        profilePage = 0;
        identityReviewPage = 1;
      });
      _message('Vui lòng kiểm tra đủ hai phần thông tin giấy tờ trước.');
      return;
    }
    if (targetPage > 1 && description.text.trim().isEmpty) {
      setState(() {
        flowDirection = 1;
        profilePage = 1;
      });
      _message('Vui lòng hoàn tất mô tả kinh nghiệm trước.');
      return;
    }
    setState(() {
      flowDirection = targetPage >= profilePage ? 1 : -1;
      profilePage = targetPage;
    });
  }

  Widget _identityStep() {
    if (identityProcess != _IdentityProcess.idle) {
      return _documentProcessStep();
    }
    if (identityReviewPage == 1) return _personalInformationStep();
    if (identityReviewPage == 2) return _documentInformationStep();
    final hasUploadedDocument = documentType == 'passport'
        ? passportUrl != null
        : frontUrl != null || backUrl != null;
    final canEnterDocumentDetails =
        hasUploadedDocument || (ignoreCurrentOcr && activeDocumentName != null);
    return _page(
      title: 'Xác thực hồ sơ',
      subtitle:
          'Thông tin của bạn được bảo mật và chỉ dùng để xác minh hồ sơ đối tác.',
      children: [
        _ProfileSectionHeader(title: 'CCCD hoặc hộ chiếu', open: true),
        const SizedBox(height: 10),
        _DocumentTypeSwitch(
          value: documentType,
          onChanged: (value) => setState(() {
            documentType = value;
            identityReviewPage = 0;
            identityReviewCompleted = false;
          }),
        ),
        const SizedBox(height: 12),
        if (documentType == 'passport')
          _DocumentSlot(
            icon: Icons.badge_outlined,
            title: 'Trang hộ chiếu',
            uploaded: passportUrl != null,
            fileName: passportName,
            onTap: () => _pickIdentity(true),
          )
        else
          Row(
            children: [
              Expanded(
                child: _DocumentSlot(
                  icon: Icons.badge_outlined,
                  title: 'Mặt trước',
                  uploaded: frontUrl != null,
                  fileName: frontName,
                  onTap: () => _pickIdentity(true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DocumentSlot(
                  icon: Icons.badge_outlined,
                  title: 'Mặt sau',
                  uploaded: backUrl != null,
                  fileName: backName,
                  onTap: () => _pickIdentity(false),
                ),
              ),
            ],
          ),
        const SizedBox(height: 9),
        const Text(
          'Ảnh rõ nét, đủ 4 góc. Với hộ chiếu, tải trang thông tin. OCR tự điền; bạn luôn kiểm tra và sửa.',
          style: _T.micro,
        ),
        if (canEnterDocumentDetails) ...[
          const SizedBox(height: 16),
          _label('Thông tin đọc từ giấy tờ'),
          const SizedBox(height: 8),
          TextField(
            controller: fullName,
            textCapitalization: TextCapitalization.words,
            decoration: _input(hint: 'Họ và tên'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: documentNumber,
            decoration: _input(
              hint: documentType == 'passport' ? 'Số hộ chiếu' : 'Số CCCD',
            ),
          ),
          if (ocrWarnings.isNotEmpty) ...[
            const SizedBox(height: 10),
            _OcrWarning(messages: ocrWarnings),
          ],
        ],
        const SizedBox(height: 14),
        _ProfileSectionHeader(
          title: 'Mô tả kinh nghiệm',
          onTap: () => _openProfileSection(1),
        ),
        _ProfileSectionHeader(
          title: 'Chứng chỉ nghề',
          onTap: () => _openProfileSection(2),
        ),
        _ProfileSectionHeader(
          title: 'Tóm tắt hồ sơ',
          onTap: () => _openProfileSection(3),
        ),
        TextButton.icon(
          onPressed: saving ? null : _save,
          icon: const Icon(Icons.save_outlined, size: 17),
          label: const Text('Lưu nháp'),
        ),
      ],
    );
  }

  Widget _personalInformationStep() => _identityReviewPage(
    eyebrow: '${documentType.toUpperCase()} · THÔNG TIN CÁ NHÂN (1/2)',
    title: 'Kiểm tra thông tin',
    children: [
      const _OcrSuccessCard(),
      const SizedBox(height: 16),
      _OcrField(
        label: documentType == 'passport' ? 'Số hộ chiếu' : 'Số CCCD',
        controller: documentNumber,
        keyboardType: TextInputType.text,
      ),
      const SizedBox(height: 10),
      _OcrField(
        label: 'Họ và tên trên giấy tờ',
        controller: fullName,
        focusNode: fullNameFocus,
        textCapitalization: TextCapitalization.words,
      ),
      if (fullNameFocus.hasFocus) ...[
        const SizedBox(height: 6),
        const Text(
          'Đang chỉnh sửa họ tên · Trường có focus',
          style: _T.navigationPrimary,
        ),
      ],
      const SizedBox(height: 10),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _OcrField(
              label: 'Ngày sinh',
              controller: dateOfBirth,
              hint: 'dd/mm/yyyy',
              keyboardType: TextInputType.datetime,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _OcrGenderField(
              value: gender,
              onChanged: (value) => setState(() => gender = value),
            ),
          ),
        ],
      ),
      const SizedBox(height: 10),
      _OcrField(
        label: 'Quốc tịch',
        controller: nationality,
        textCapitalization: TextCapitalization.words,
      ),
      if (ocrWarnings.isNotEmpty) ...[
        const SizedBox(height: 10),
        _OcrWarning(messages: ocrWarnings),
      ],
      const SizedBox(height: 12),
      const Text(
        'Dữ liệu minh họa. Thông tin giấy tờ do hệ thống nhận diện; bạn có thể sửa nếu chưa chính xác.',
        style: _T.micro,
      ),
    ],
  );

  Widget _documentInformationStep() => _identityReviewPage(
    eyebrow: '${documentType.toUpperCase()} · THÔNG TIN GIẤY TỜ (2/2)',
    title: 'Địa chỉ và cấp giấy',
    children: [
      _OcrField(
        label: 'Quê quán',
        controller: placeOfOrigin,
        maxLines: 2,
        textCapitalization: TextCapitalization.sentences,
      ),
      const SizedBox(height: 10),
      _OcrField(
        label: 'Nơi thường trú',
        controller: placeOfResidence,
        maxLines: 3,
        textCapitalization: TextCapitalization.sentences,
      ),
      const SizedBox(height: 10),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _OcrField(
              label: 'Ngày cấp',
              controller: issuedAt,
              hint: 'dd/mm/yyyy',
              keyboardType: TextInputType.datetime,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _OcrField(
              label: 'Có giá trị đến',
              controller: expiresAt,
              hint: 'dd/mm/yyyy',
              keyboardType: TextInputType.datetime,
            ),
          ),
        ],
      ),
      const SizedBox(height: 10),
      _OcrField(
        label: 'Nơi cấp',
        controller: issuedPlace,
        maxLines: 2,
        textCapitalization: TextCapitalization.sentences,
      ),
      const SizedBox(height: 12),
      const Text(
        'Mọi trường tự điền đều có thể sửa. Chỉ lưu khi bạn đã đối chiếu với ảnh giấy tờ.',
        style: _T.micro,
      ),
    ],
  );

  Widget _identityReviewPage({
    required String eyebrow,
    required String title,
    required List<Widget> children,
  }) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
    children: [
      Text(eyebrow, style: _T.overline),
      const SizedBox(height: 8),
      Text(title, style: _T.heading),
      const SizedBox(height: 16),
      ...children,
    ],
  );

  Widget _documentProcessStep() {
    final reading = identityProcess == _IdentityProcess.reading;
    return _page(
      title: reading ? 'Đang đọc thông tin' : 'Đang tải giấy tờ',
      subtitle: reading
          ? 'OCR đang đọc thông tin từ ảnh bạn đã tải.'
          : 'Giữ màn hình mở để hoàn tất tải ảnh.',
      children: [
        if (reading)
          const _OcrReadingIcon()
        else
          _UploadProgressCard(
            fileName: activeDocumentName ?? 'Giấy tờ',
            documentLabel: activeDocumentLabel,
            progress: uploadProgress,
          ),
        const SizedBox(height: 14),
        if (reading)
          const _Hint(
            'Tên, số giấy tờ và các thông tin khác sẽ được tự điền để bạn kiểm tra.',
          )
        else
          _UploadedFiles(
            frontName: frontName,
            backName: backName,
            passportName: passportName,
            documentType: documentType,
          ),
        if (reading) ...[
          const SizedBox(height: 12),
          _UploadedFiles(
            frontName: frontName,
            backName: backName,
            passportName: passportName,
            documentType: documentType,
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: FilledButton(
              onPressed: () => setState(() {
                ignoreCurrentOcr = true;
                identityProcess = _IdentityProcess.idle;
                flowDirection = 1;
                identityReviewPage = 1;
              }),
              style: FilledButton.styleFrom(
                backgroundColor: _C.primarySoft,
                foregroundColor: _C.primary,
                elevation: 0,
              ),
              child: const Text('Nhập thông tin thủ công'),
            ),
          ),
        ],
      ],
    );
  }

  Widget _experienceStep() => _profilePage(
    eyebrow: 'HỒ SƠ · KINH NGHIỆM',
    title: 'Mô tả kinh nghiệm',
    children: [
      _VerifiedDocumentRow(
        documentType: documentType,
        onTap: () => setState(() {
          flowDirection = -1;
          profilePage = 0;
          identityReviewPage = 1;
          identityReviewCompleted = false;
        }),
      ),
      const SizedBox(height: 18),
      const Text(
        'Chia sẻ công việc bạn từng làm và kỹ năng phù hợp với dịch vụ đã chọn.',
        style: _T.body,
      ),
      const SizedBox(height: 10),
      TextField(
        controller: description,
        minLines: 7,
        maxLines: 9,
        maxLength: 2000,
        textCapitalization: TextCapitalization.sentences,
        decoration: _input(hint: 'Mô tả kinh nghiệm'),
      ),
      const SizedBox(height: 6),
      Text(
        'Kinh nghiệm đã chọn: ${_experienceLabel()}. Không đưa số CCCD, số điện thoại hay thông tin nhạy cảm vào mô tả.',
        style: _T.micro,
      ),
      const SizedBox(height: 14),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: saving ? null : _save,
          icon: const Icon(Icons.save_outlined, size: 18),
          label: const Text('Lưu nháp'),
        ),
      ),
    ],
  );

  Widget _certificateStep() => _profilePage(
    eyebrow: 'HỒ SƠ · CHỨNG CHỈ (${certificateUrls.length})',
    title: 'Chứng chỉ nghề',
    children: [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _C.primarySoft,
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Không bắt buộc',
              style: TextStyle(
                color: _C.primary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Bạn có thể thêm nhiều chứng chỉ hoặc bỏ qua phần này.',
              style: _T.micro,
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      ...List.generate(
        certificateUrls.length,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _CertificateCard(
            title: certificateTitles[index].text,
            fileName: certificateNames[index],
            issuer: certificateIssuers[index].text,
            issuedAt: certificateIssuedAts[index].text,
            onDelete: () => _removeCertificate(index),
            onEdit: () => _editCertificate(index),
          ),
        ),
      ),
      SizedBox(
        width: double.infinity,
        height: 48,
        child: TextButton(
          onPressed: saving ? null : _pickCertificate,
          style: TextButton.styleFrom(
            backgroundColor: _C.primarySoft,
            foregroundColor: _C.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          child: Text(
            saving ? 'Đang tải chứng chỉ...' : '+ Thêm chứng chỉ',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    ],
  );

  Widget _summaryStep() {
    final catalog = ref
        .watch(serviceCatalogServicesProvider(null))
        .asData
        ?.value;
    final serviceNames = catalog?.items
        .where((service) => selectedServices.contains(service.id))
        .map((service) => service.name)
        .join(' · ');
    final identityImages = documentType == 'passport'
        ? (passportUrl == null ? 0 : 1)
        : [frontUrl, backUrl].whereType<String>().length;
    final certificateSummary = certificateTitles
        .map((controller) => controller.text.trim())
        .where((title) => title.isNotEmpty)
        .join(' · ');
    return _profilePage(
      title: 'Tóm tắt hồ sơ',
      subtitle: 'Kiểm tra thông tin trước khi gửi.',
      children: [
        _SummarySection(
          title: 'Dịch vụ',
          value: serviceNames?.isNotEmpty == true
              ? serviceNames!
              : '${selectedServices.length} dịch vụ đã chọn',
          onEdit: () => setState(() {
            flowDirection = -1;
            returnToSummary = true;
            step = 1;
          }),
        ),
        _SummarySection(
          title: 'Kinh nghiệm',
          actionLabel: 'Xem',
          value: '${_experienceLabel()} · ${description.text.trim()}',
          onEdit: () => setState(() {
            flowDirection = -1;
            returnToSummary = true;
            profilePage = 1;
          }),
        ),
        _SummarySection(
          title: 'Khu vực',
          value: _areaSummary(),
          onEdit: () => setState(() {
            flowDirection = -1;
            returnToSummary = true;
            step = 2;
          }),
        ),
        _SummarySection(
          title: 'Giấy tờ',
          value:
              '${documentType == 'passport' ? 'Hộ chiếu' : 'CCCD'} · $identityImages ảnh · Đã kiểm tra thông tin\n${fullName.text} · ${documentNumber.text}',
          onEdit: () => setState(() {
            flowDirection = -1;
            returnToSummary = true;
            profilePage = 0;
            identityReviewPage = 1;
            identityReviewCompleted = false;
          }),
        ),
        _SummarySection(
          title: 'Chứng chỉ (${certificateUrls.length})',
          actionLabel: 'Xem',
          value: certificateSummary.isEmpty
              ? 'Không có chứng chỉ'
              : certificateSummary,
          onEdit: () => setState(() {
            flowDirection = -1;
            returnToSummary = true;
            profilePage = 2;
          }),
          showDivider: false,
        ),
      ],
    );
  }

  String _experienceLabel() {
    final years = int.tryParse(experience.text) ?? 0;
    if (years <= 2) return '1–2 năm';
    if (years <= 5) return '3–5 năm';
    return 'Trên 5 năm';
  }

  String _areaSummary() {
    final entries = area.text
        .split(';')
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    if (entries.isEmpty) return '';
    final firstParts = entries.first.split(',').map((value) => value.trim());
    final province = firstParts.length > 1 ? firstParts.last : '';
    final wards = entries
        .map((entry) => entry.split(',').first.trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    return province.isEmpty ? wards : '$province\n$wards';
  }

  Widget _profilePage({
    String? eyebrow,
    required String title,
    String? subtitle,
    required List<Widget> children,
  }) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
    children: [
      if (eyebrow != null) ...[
        Text(eyebrow, style: _T.overline),
        const SizedBox(height: 8),
      ],
      Text(title, style: _T.heading),
      if (subtitle != null) ...[
        const SizedBox(height: 7),
        Text(subtitle, style: _T.body),
      ],
      const SizedBox(height: 18),
      ...children,
    ],
  );

  Widget _page({
    required String title,
    required String subtitle,
    required List<Widget> children,
  }) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
    children: [
      Text(title, style: _T.heading),
      const SizedBox(height: 8),
      Text(subtitle, style: _T.body),
      const SizedBox(height: 24),
      ...children,
    ],
  );

  Widget _statusView(ProviderApplication item) {
    final approved = item.status == 'approved';
    return Column(
      children: [
        _topBar(approved ? 'Hồ sơ đối tác' : 'Đăng ký đối tác'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 36, 20, 28),
            children: [
              Icon(
                approved ? Icons.verified_rounded : Icons.check_circle_rounded,
                size: 88,
                color: approved ? const Color(0xFF23845A) : _C.primary,
              ),
              const SizedBox(height: 24),
              Text(
                approved ? 'Hồ sơ đã được duyệt' : 'Gửi hồ sơ thành công',
                style: _T.heading,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                approved
                    ? 'Bạn đã có thể bắt đầu hoạt động với vai trò Đối tác Handigo.'
                    : 'Handigo đã nhận được hồ sơ và sẽ thông báo khi xét duyệt hoàn tất.',
                style: _T.body,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              _Receipt(item),
              const SizedBox(height: 16),
              const _Hint(
                'Bạn sẽ nhận được thông báo ngay khi trạng thái hồ sơ thay đổi.',
              ),
            ],
          ),
        ),
        _ActionBar(
          label: 'Hoàn tất',
          onPrimary: context.canPop() ? () => context.pop() : null,
        ),
      ],
    );
  }

  Widget _rejection(ProviderApplication item) => Container(
    margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFFFFECEE),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.error_outline, color: _C.danger, size: 21),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            item.rejectionReason ??
                item.rejectionNotes ??
                'Hồ sơ cần bổ sung. Vui lòng kiểm tra lại thông tin.',
            style: const TextStyle(color: _C.ink, fontSize: 13, height: 1.4),
          ),
        ),
      ],
    ),
  );

  Widget _networkError() => Column(
    children: [
      _topBar('Đăng ký đối tác'),
      Expanded(
        child: Center(
          child: _Empty(
            Icons.wifi_off_rounded,
            'Không thể tải hồ sơ',
            'Vui lòng kiểm tra kết nối mạng và thử lại.',
            action: () {
              _didHydrate = false;
              ref.invalidate(providerApplicationProvider);
            },
          ),
        ),
      ),
    ],
  );

  Widget _topBar(String title, {VoidCallback? onBack, bool help = false}) =>
      SizedBox(
        height: 56,
        child: Row(
          children: [
            SizedBox(
              width: 72,
              child: InkWell(
                onTap:
                    onBack ?? (context.canPop() ? () => context.pop() : null),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.arrow_back_ios_new_rounded, size: 16),
                    SizedBox(height: 1),
                    Text('Quay lại', style: _T.navigation),
                  ],
                ),
              ),
            ),
            Expanded(
              child: Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: _C.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            SizedBox(
              width: 72,
              child: help
                  ? InkWell(
                      onTap: () => showAboutDialog(
                        context: context,
                        applicationName: 'Handigo Đối tác',
                        applicationVersion: 'Hồ sơ đăng ký',
                      ),
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.headset_mic_outlined,
                            size: 18,
                            color: _C.primary,
                          ),
                          SizedBox(height: 1),
                          Text('Trợ giúp', style: _T.navigationPrimary),
                        ],
                      ),
                    )
                  : null,
            ),
          ],
        ),
      );

  Widget _label(String value) => Text(
    value,
    style: const TextStyle(
      color: _C.ink,
      fontSize: 14,
      fontWeight: FontWeight.w600,
    ),
  );

  InputDecoration _input({String? hint, IconData? icon, String? suffix}) =>
      InputDecoration(
        hintText: hint,
        suffixText: suffix,
        prefixIcon: icon == null ? null : Icon(icon, color: _C.muted, size: 21),
        hintStyle: const TextStyle(color: _C.muted, fontSize: 14),
        filled: true,
        fillColor: _C.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        enabledBorder: _border(_C.border),
        focusedBorder: _border(_C.primary, 1.5),
      );

  OutlineInputBorder _border(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: color, width: width),
      );
}

class _Progress extends StatelessWidget {
  const _Progress(this.step);
  final int step;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(20, 4, 20, 9),
    color: _C.background,
    child: Column(
      children: [
        Row(
          children: [
            Text('BƯỚC $step/3', style: _T.overline),
            const Spacer(),
            Text('${step == 3 ? 100 : step * 33}%', style: _T.overline),
          ],
        ),
        const SizedBox(height: 7),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: step / 3,
            minHeight: 4,
            backgroundColor: _C.primarySoft,
            color: _C.primary,
          ),
        ),
      ],
    ),
  );
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.label,
    required this.onPrimary,
    this.onSave,
    this.onSecondary,
    this.saving = false,
  });
  final String label;
  final VoidCallback? onPrimary;
  final VoidCallback? onSave;
  final VoidCallback? onSecondary;
  final bool saving;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.fromLTRB(20, onSave == null ? 12 : 4, 20, 16),
    decoration: const BoxDecoration(
      color: _C.surface,
      border: Border(top: BorderSide(color: _C.divider)),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (onSave != null)
          Align(
            alignment: Alignment.centerRight,
            child: SizedBox(
              height: 38,
              child: TextButton(
                onPressed: saving ? null : onSave,
                child: const Text(
                  'Lưu nháp',
                  style: TextStyle(
                    color: _C.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        Row(
          children: [
            if (onSecondary != null) ...[
              SizedBox(
                width: 112,
                height: 48,
                child: FilledButton(
                  onPressed: saving ? null : onSecondary,
                  style: FilledButton.styleFrom(
                    backgroundColor: _C.primarySoft,
                    foregroundColor: _C.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text(
                    'Quay lại',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: SizedBox(
                height: 48,
                child: FilledButton(
                  onPressed: saving ? null : onPrimary,
                  style: FilledButton.styleFrom(
                    backgroundColor: _C.primary,
                    disabledBackgroundColor: _C.disabled,
                    disabledForegroundColor: _C.muted,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          label,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _ServiceGroup extends StatelessWidget {
  const _ServiceGroup({
    required this.title,
    required this.subtitle,
    required this.open,
    required this.selectedCount,
    required this.onToggle,
    required this.children,
  });
  final String title;
  final String subtitle;
  final bool open;
  final int selectedCount;
  final VoidCallback onToggle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      InkWell(
        onTap: onToggle,
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: _C.ink,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle, style: _T.micro),
                  ],
                ),
              ),
              if (selectedCount > 0)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(
                    '$selectedCount đã chọn',
                    style: _T.navigationPrimary,
                  ),
                ),
              Icon(
                open
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
                size: 20,
                color: _C.ink,
              ),
            ],
          ),
        ),
      ),
      if (open) ...children,
      const SizedBox(height: 4),
    ],
  );
}

class _ServiceCheck extends StatelessWidget {
  const _ServiceCheck({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Material(
      color: _C.surface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? _C.primary : _C.divider),
          ),
          child: Row(
            children: [
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: selected ? _C.primary : _C.surface,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: selected ? _C.primary : _C.border),
                ),
                child: selected
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: _C.ink,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _AreaChip extends StatelessWidget {
  const _AreaChip({required this.label, required this.onDeleted});
  final String label;
  final VoidCallback onDeleted;

  @override
  Widget build(BuildContext context) => Container(
    height: 32,
    padding: const EdgeInsets.only(left: 10, right: 4),
    decoration: BoxDecoration(
      color: _C.primarySoft,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: _C.primary,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(
          width: 32,
          height: 32,
          child: IconButton(
            tooltip: 'Bỏ chọn $label',
            padding: EdgeInsets.zero,
            onPressed: onDeleted,
            icon: const Icon(Icons.close_rounded, size: 15),
            color: _C.primary,
          ),
        ),
      ],
    ),
  );
}

class _AreaSkeleton extends StatelessWidget {
  const _AreaSkeleton({required this.lines});
  final int lines;

  @override
  Widget build(BuildContext context) => Column(
    children: List.generate(
      lines,
      (index) => Container(
        height: 48,
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: _C.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _C.divider),
        ),
      ),
    ),
  );
}

class _WardLoading extends StatelessWidget {
  const _WardLoading();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: _C.primarySoft,
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Đang tải phường/xã...',
              style: TextStyle(
                color: _C.primary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 3),
            Text(
              'Vui lòng chờ. Danh sách thuộc tỉnh/thành đã chọn.',
              style: _T.micro,
            ),
          ],
        ),
      ),
      const SizedBox(height: 10),
      const _AreaSkeleton(lines: 3),
    ],
  );
}

class _WardEmpty extends StatelessWidget {
  const _WardEmpty({required this.query, required this.onClear});
  final String query;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        width: 76,
        height: 76,
        decoration: BoxDecoration(
          color: _C.primarySoft,
          borderRadius: BorderRadius.circular(22),
        ),
        child: const Icon(
          Icons.search_off_rounded,
          color: _C.primary,
          size: 32,
        ),
      ),
      const SizedBox(height: 12),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _C.primarySoft,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Không tìm thấy phường/xã',
              style: TextStyle(
                color: _C.primary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              query.isEmpty
                  ? 'Không có khu vực phù hợp.'
                  : 'Không có kết quả “$query”. Hãy thử tên khác hoặc xóa từ khóa.',
              style: _T.micro,
            ),
          ],
        ),
      ),
      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        height: 44,
        child: TextButton(
          onPressed: onClear,
          style: TextButton.styleFrom(
            backgroundColor: _C.primarySoft,
            foregroundColor: _C.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          child: const Text(
            'Xóa từ khóa',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    ],
  );
}

class _WardError extends StatelessWidget {
  const _WardError({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        width: 76,
        height: 76,
        decoration: BoxDecoration(
          color: const Color(0xFFFFECEE),
          borderRadius: BorderRadius.circular(22),
        ),
        child: const Icon(Icons.wifi_off_rounded, color: _C.danger, size: 32),
      ),
      const SizedBox(height: 12),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFECEE),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Không tải được danh sách',
              style: TextStyle(
                color: _C.danger,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Kiểm tra kết nối mạng rồi thử lại. Tỉnh/thành đã chọn được giữ nguyên.',
              style: _T.micro,
            ),
          ],
        ),
      ),
      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        height: 44,
        child: FilledButton(
          onPressed: onRetry,
          style: FilledButton.styleFrom(
            backgroundColor: _C.primarySoft,
            foregroundColor: _C.primary,
            elevation: 0,
          ),
          child: const Text('Thử lại'),
        ),
      ),
    ],
  );
}

class _ProfileSectionHeader extends StatelessWidget {
  const _ProfileSectionHeader({
    required this.title,
    this.open = false,
    this.onTap,
  });
  final String title;
  final bool open;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: _C.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Icon(
              open
                  ? Icons.keyboard_arrow_up_rounded
                  : Icons.keyboard_arrow_down_rounded,
              size: 19,
              color: onTap == null ? _C.ink : _C.primary,
            ),
          ],
        ),
      ),
    ),
  );
}

class _DocumentTypeSwitch extends StatelessWidget {
  const _DocumentTypeSwitch({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      _item('cccd', 'CCCD'),
      const SizedBox(width: 8),
      _item('passport', 'Hộ chiếu'),
    ],
  );

  Widget _item(String option, String label) {
    final selected = value == option;
    return Expanded(
      child: SizedBox(
        height: 46,
        child: FilledButton(
          onPressed: () => onChanged(option),
          style: FilledButton.styleFrom(
            backgroundColor: selected ? _C.primary : _C.primarySoft,
            foregroundColor: selected ? Colors.white : _C.primary,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9),
            ),
          ),
          child: Text(label, style: const TextStyle(fontSize: 11)),
        ),
      ),
    );
  }
}

class _DocumentSlot extends StatelessWidget {
  const _DocumentSlot({
    required this.icon,
    required this.title,
    required this.uploaded,
    required this.onTap,
    this.fileName,
  });
  final IconData icon;
  final String title;
  final bool uploaded;
  final VoidCallback onTap;
  final String? fileName;

  @override
  Widget build(BuildContext context) => Material(
    color: uploaded ? _C.primarySoft : _C.surface,
    borderRadius: BorderRadius.circular(10),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 96,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          border: Border.all(color: uploaded ? _C.primary : _C.divider),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              uploaded ? Icons.check_circle_rounded : icon,
              size: 23,
              color: _C.primary,
            ),
            const SizedBox(height: 7),
            Text(
              title,
              style: const TextStyle(
                color: _C.ink,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              uploaded ? (fileName ?? 'Đã tải lên') : 'Chạm để tải',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: _T.micro,
            ),
          ],
        ),
      ),
    ),
  );
}

class _UploadProgressCard extends StatelessWidget {
  const _UploadProgressCard({
    required this.fileName,
    required this.documentLabel,
    required this.progress,
  });
  final String fileName;
  final String documentLabel;
  final double progress;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _ProfileSectionHeader(title: 'CCCD hoặc hộ chiếu', open: true),
      _FileRow(name: fileName, trailing: 'Hủy'),
      const SizedBox(height: 10),
      ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(
          minHeight: 4,
          value: progress,
          backgroundColor: _C.border,
          color: _C.primary,
        ),
      ),
      const SizedBox(height: 7),
      Text(
        'Đang tải ảnh $documentLabel · ${(progress * 100).round()}%',
        style: _T.navigationPrimary,
      ),
      const SizedBox(height: 16),
      const _Hint(
        'Đã lưu ảnh xong, OCR sẽ bắt đầu đọc thông tin và chỉ dùng trong hồ sơ này.',
      ),
    ],
  );
}

class _UploadedFiles extends StatelessWidget {
  const _UploadedFiles({
    required this.frontName,
    required this.backName,
    required this.passportName,
    required this.documentType,
  });
  final String? frontName;
  final String? backName;
  final String? passportName;
  final String documentType;

  @override
  Widget build(BuildContext context) {
    final names = documentType == 'passport'
        ? [passportName]
        : [frontName, backName];
    return Column(
      children: names
          .whereType<String>()
          .map((name) => _FileRow(name: name, trailing: 'Xem'))
          .toList(),
    );
  }
}

class _FileRow extends StatelessWidget {
  const _FileRow({required this.name, required this.trailing});
  final String name;
  final String trailing;

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(minHeight: 52),
    padding: const EdgeInsets.symmetric(horizontal: 12),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: _C.divider)),
    ),
    child: Row(
      children: [
        const Icon(Icons.description_outlined, color: _C.primary, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _C.ink,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Text('Đã tải lên', style: _T.micro),
            ],
          ),
        ),
        Text(
          trailing,
          style: const TextStyle(
            color: _C.primary,
            fontSize: 9,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _OcrReadingIcon extends StatelessWidget {
  const _OcrReadingIcon();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: _C.primarySoft,
          borderRadius: BorderRadius.circular(22),
        ),
        child: const Icon(
          Icons.document_scanner_outlined,
          color: _C.primary,
          size: 32,
        ),
      ),
      const SizedBox(height: 12),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _C.primarySoft,
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Đang đọc thông tin từ ảnh...',
              style: TextStyle(
                color: _C.primary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Tên, số giấy tờ và các thông tin khác sẽ được tự điền để bạn kiểm tra.',
              style: _T.micro,
            ),
          ],
        ),
      ),
    ],
  );
}

class _OcrSuccessCard extends StatelessWidget {
  const _OcrSuccessCard();

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _C.primarySoft,
      borderRadius: BorderRadius.circular(10),
    ),
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Đã đọc thông tin từ ảnh',
          style: TextStyle(
            color: _C.primary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        SizedBox(height: 4),
        Text(
          'Kiểm tra từng trường. Chạm vào thông tin để sửa nếu chưa chính xác.',
          style: _T.micro,
        ),
      ],
    ),
  );
}

class _OcrField extends StatelessWidget {
  const _OcrField({
    required this.label,
    required this.controller,
    this.hint,
    this.focusNode,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.maxLines = 1,
  });

  final String label;
  final String? hint;
  final TextEditingController controller;
  final FocusNode? focusNode;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final int maxLines;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    focusNode: focusNode,
    keyboardType: keyboardType,
    textCapitalization: textCapitalization,
    maxLines: maxLines,
    style: const TextStyle(
      color: _C.ink,
      fontSize: 12,
      fontWeight: FontWeight.w600,
    ),
    decoration: _ocrDecoration(label: label, hint: hint),
  );
}

class _OcrGenderField extends StatelessWidget {
  const _OcrGenderField({required this.value, required this.onChanged});

  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
    key: ValueKey(value),
    initialValue: value,
    isExpanded: true,
    style: const TextStyle(
      color: _C.ink,
      fontSize: 12,
      fontWeight: FontWeight.w600,
    ),
    icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18),
    decoration: _ocrDecoration(label: 'Giới tính'),
    items: const [
      DropdownMenuItem(value: 'male', child: Text('Nam')),
      DropdownMenuItem(value: 'female', child: Text('Nữ')),
      DropdownMenuItem(value: 'other', child: Text('Khác')),
    ],
    onChanged: onChanged,
  );
}

InputDecoration _ocrDecoration({required String label, String? hint}) =>
    InputDecoration(
      labelText: label,
      hintText: hint,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      labelStyle: const TextStyle(color: _C.muted, fontSize: 10),
      hintStyle: const TextStyle(color: _C.muted, fontSize: 11),
      filled: true,
      fillColor: _C.surface,
      contentPadding: const EdgeInsets.fromLTRB(12, 15, 12, 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _C.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _C.primary, width: 1.5),
      ),
    );

class _OcrWarning extends StatelessWidget {
  const _OcrWarning({required this.messages});
  final List<String> messages;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF5E6),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(messages.join('\n'), style: _T.micro),
  );
}

class _VerifiedDocumentRow extends StatelessWidget {
  const _VerifiedDocumentRow({required this.documentType, required this.onTap});

  final String documentType;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        constraints: const BoxConstraints(minHeight: 56),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: _C.divider)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'CCCD hoặc hộ chiếu',
                    style: TextStyle(
                      color: _C.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    documentType == 'passport'
                        ? 'Đã kiểm tra thông tin hộ chiếu'
                        : 'Đã kiểm tra thông tin CCCD',
                    style: _T.micro,
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.check_circle_outline_rounded,
              color: Color(0xFF168968),
              size: 20,
            ),
            const SizedBox(width: 14),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: _C.primary,
              size: 20,
            ),
          ],
        ),
      ),
    ),
  );
}

class _CertificateCard extends StatelessWidget {
  const _CertificateCard({
    required this.title,
    required this.fileName,
    required this.issuer,
    required this.issuedAt,
    required this.onDelete,
    required this.onEdit,
  });

  final String title;
  final String fileName;
  final String issuer;
  final String issuedAt;
  final VoidCallback onDelete;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(14, 10, 8, 8),
    decoration: BoxDecoration(
      color: _C.surface,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Column(
      children: [
        Row(
          children: [
            const Icon(Icons.description_outlined, color: _C.primary, size: 19),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title.isEmpty ? 'Chứng chỉ chưa đặt tên' : title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _C.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _T.micro,
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: onDelete,
              child: const Text('Xóa', style: _T.navigationPrimary),
            ),
          ],
        ),
        if (issuer.isNotEmpty || issuedAt.isNotEmpty) ...[
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              [issuer, issuedAt].where((value) => value.isNotEmpty).join(' · '),
              style: _T.micro,
            ),
          ),
        ],
        Row(
          children: [
            const Expanded(
              child: Text(
                '✓ Đã tải lên',
                style: TextStyle(
                  color: Color(0xFF168968),
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: onEdit,
              child: const Text('Chỉnh sửa', style: _T.navigationPrimary),
            ),
          ],
        ),
      ],
    ),
  );
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({
    required this.title,
    required this.value,
    required this.onEdit,
    this.actionLabel = 'Sửa',
    this.showDivider = true,
  });

  final String title;
  final String value;
  final VoidCallback onEdit;
  final String actionLabel;
  final bool showDivider;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 8),
    decoration: BoxDecoration(
      border: showDivider
          ? const Border(bottom: BorderSide(color: _C.divider))
          : null,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: _C.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            SizedBox(
              height: 48,
              child: TextButton(
                onPressed: onEdit,
                child: Text(actionLabel, style: _T.navigationPrimary),
              ),
            ),
          ],
        ),
        Text(value.isEmpty ? 'Chưa cập nhật' : value, style: _T.body),
      ],
    ),
  );
}

class _IntroArtwork extends StatelessWidget {
  const _IntroArtwork();

  @override
  Widget build(BuildContext context) => Container(
    height: 164,
    decoration: BoxDecoration(
      color: _C.primarySoft,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Center(
      child: Container(
        width: 76,
        height: 76,
        decoration: const BoxDecoration(
          color: _C.surface,
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.handyman_rounded, size: 38, color: _C.primary),
      ),
    ),
  );
}

class _Benefit extends StatelessWidget {
  const _Benefit(this.icon, this.title, this.description);
  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: _C.primarySoft,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: _C.primary),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: _C.ink,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(description, style: _T.caption),
          ],
        ),
      ),
    ],
  );
}

class _ReferralCard extends StatelessWidget {
  const _ReferralCard();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: _C.primarySoft,
      borderRadius: BorderRadius.circular(10),
    ),
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Cần chuẩn bị',
          style: TextStyle(
            color: _C.primary,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
        SizedBox(height: 4),
        Text(
          'Dịch vụ, khu vực, CCCD/Hộ chiếu, chứng chỉ nếu có.',
          style: _T.micro,
        ),
      ],
    ),
  );
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _C.primarySoft,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.info_outline, color: _C.primary, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(color: _C.ink, fontSize: 13, height: 1.45),
          ),
        ),
      ],
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty(this.icon, this.title, this.description, {this.action});
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback? action;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 58, color: _C.primary),
        const SizedBox(height: 16),
        Text(
          title,
          style: const TextStyle(
            color: _C.ink,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(description, style: _T.body, textAlign: TextAlign.center),
        if (action != null) ...[
          const SizedBox(height: 16),
          OutlinedButton(onPressed: action, child: const Text('Thử lại')),
        ],
      ],
    ),
  );
}

class _Receipt extends StatelessWidget {
  const _Receipt(this.item);
  final ProviderApplication item;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _C.surface,
      border: Border.all(color: _C.border),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      children: [
        _row('Mã hồ sơ', _shortId(item.id)),
        const Divider(height: 25, color: _C.divider),
        _row('Trạng thái', _statusLabel(item.status)),
        const Divider(height: 25, color: _C.divider),
        _row('Dịch vụ', '${item.serviceIds.length} dịch vụ'),
      ],
    ),
  );

  Widget _row(String label, String value) => Row(
    children: [
      Expanded(child: Text(label, style: _T.body)),
      Text(
        value,
        style: const TextStyle(color: _C.ink, fontWeight: FontWeight.w600),
      ),
    ],
  );
}

abstract final class _C {
  static const background = Color(0xFFF6F5FA);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF131B2E);
  static const muted = Color(0xFF626779);
  static const primary = Color(0xFF3525CD);
  static const primarySoft = Color(0xFFEEEBFF);
  static const disabled = Color(0xFFE6E2EF);
  static const border = Color(0xFFDDD9EA);
  static const divider = Color(0xFFEDEAF3);
  static const danger = Color(0xFFC64050);
}

abstract final class _T {
  static const overline = TextStyle(
    color: _C.primary,
    fontSize: 9,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );
  static const hero = TextStyle(
    color: _C.ink,
    fontSize: 24,
    height: 1.08,
    fontWeight: FontWeight.w800,
  );
  static const heading = TextStyle(
    color: _C.ink,
    fontSize: 20,
    height: 1.25,
    fontWeight: FontWeight.w800,
  );
  static const body = TextStyle(color: _C.muted, fontSize: 11, height: 1.5);
  static const caption = TextStyle(color: _C.muted, fontSize: 10, height: 1.4);
  static const micro = TextStyle(color: _C.muted, fontSize: 9, height: 1.35);
  static const navigation = TextStyle(color: _C.ink, fontSize: 8, height: 1.2);
  static const navigationPrimary = TextStyle(
    color: _C.primary,
    fontSize: 8,
    height: 1.2,
    fontWeight: FontWeight.w600,
  );
}

String _initials(String value) {
  final words = value.trim().split(RegExp(r'\s+'));
  if (words.isEmpty || words.first.isEmpty) return 'HG';
  if (words.length == 1) return words.first.substring(0, 1).toUpperCase();
  return '${words.first[0]}${words.last[0]}'.toUpperCase();
}

String _categoryHint(String value) {
  final normalized = value.toLowerCase();
  if (normalized.contains('điện') || normalized.contains('nước')) {
    return 'Sửa điện dân dụng, cấp thoát nước';
  }
  if (normalized.contains('lạnh') || normalized.contains('điều hòa')) {
    return 'Vệ sinh, sửa chữa điện lạnh';
  }
  if (normalized.contains('vệ sinh')) {
    return 'Dọn dẹp và vệ sinh nhà cửa';
  }
  return 'Chọn dịch vụ trong danh mục';
}

String _statusLabel(String value) => switch (value) {
  'draft' => 'Bản nháp',
  'pending' => 'Đang chờ duyệt',
  'resubmitted' => 'Đã gửi lại',
  'approved' => 'Đã duyệt',
  'rejected' => 'Cần bổ sung',
  _ => value,
};

String _shortId(String value) => value.length <= 8
    ? value.toUpperCase()
    : value.substring(value.length - 8).toUpperCase();
