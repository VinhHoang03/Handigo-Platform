import api from '@/api/client';
import type { QuotationAgentResult, QuotationAgentSnapshot, QuotationHistoryItem } from '../types/quotationAgent.types';

export const quotationAgentApi = {
  async history(orderId: string, query: string, signal: AbortSignal) {
    const response = await api.get<{ success: boolean; data: { items: QuotationHistoryItem[]; autoFillId: string | null } }>(
      `/orders/${orderId}/quotation-agent/history`, { params: { query }, signal });
    return response.data.data;
  },
  async assist(orderId: string, instruction: string, snapshot: QuotationAgentSnapshot, signal: AbortSignal) {
    const response = await api.post<{ success: boolean; data: QuotationAgentResult }>(
      `/orders/${orderId}/quotation-agent/assist`, { instruction, ...snapshot }, { signal, timeout: 85_000 });
    return response.data.data;
  },
  async transcribe(orderId: string, audio: Blob, signal: AbortSignal) {
    const form = new FormData();
    form.append('audio', audio, 'bao-gia.wav');
    const response = await api.post<{ success: boolean; data: { transcript: string } }>(
      `/orders/${orderId}/quotation-agent/transcribe`, form,
      { signal, timeout: 40_000, headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data.data.transcript;
  },
};
