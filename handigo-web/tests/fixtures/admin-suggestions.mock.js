const clone = value => JSON.parse(JSON.stringify(value));
const initial = { _id: '507f1f77bcf86cd799439011', providerId: 'provider-test', suggestionType: 'service', suggestedServiceName: 'Bảo dưỡng thiết bị',
  description: 'Mô tả đề xuất đầy đủ', categoryId: '507f1f77bcf86cd799439012', status: 'pending', adminNote: '', createdAt: '2026-10-29T01:00:00Z' };
let record = clone(initial);
window.__suggestionRequests = [];
window.__resetSuggestions = () => { record = clone(initial); window.__suggestionRequests = []; window.__suggestionError = 0; };
export const serviceSuggestionApi = {
  async list({ status }) { return { items: !status || record.status === status ? [clone(record)] : [], total: 1 }; },
  async detail() { return clone(record); },
  async update(id, payload) {
    window.__suggestionRequests.push({ id, payload });
    await new Promise(resolve => setTimeout(resolve, 20));
    if (window.__suggestionError) {
      if (window.__suggestionError === 409) record = { ...record, status: 'approved', createdServiceId: { _id: 'service-test', name: 'Dịch vụ đã tạo' } };
      throw { response: { status: window.__suggestionError, data: { message: 'Không thể duyệt đề xuất thử nghiệm.' } } };
    }
    record = { ...record, ...payload, createdServiceId: { _id: 'service-test', name: payload.serviceDraft?.name || 'Dịch vụ đã tạo' } };
    return clone(record);
  },
};
export const categoryServiceApi = { async listCategories() { return { items: [{ _id: initial.categoryId, name: 'Thiết bị gia đình', isActive: true }] }; } };
