import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Sparkles } from 'lucide-react';
import { quotationAgentApi } from '../../api/quotationAgent.api';
import { quotationAudioToWav } from '../../utils/quotationAudio';
import type { QuotationAgentResult, QuotationAgentSnapshot } from '../../types/quotationAgent.types';
import { getErrorMessage } from '@/utils/apiError';
import { Modal } from '@/components/common/Modal';

interface Props {
  orderId: string;
  snapshot: QuotationAgentSnapshot;
  disabled?: boolean;
  onApply: (result: QuotationAgentResult) => boolean;
  onBusyChange: (busy: boolean) => void;
  open?: boolean;
  onClose?: () => void;
}

export function QuotationAgentPanel({ orderId, snapshot, disabled, onApply, onBusyChange, open, onClose }: Props) {
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<QuotationAgentResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    onBusyChange(working || recording);
  }, [working, recording, onBusyChange]);

  useEffect(() => () => {
    generation.current++;
    request.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); }
    stream.current?.getTracks().forEach((track) => track.stop());
  }, [orderId]);

  const run = async (text = instruction) => {
    if (!text.trim() || working || recording || disabled) return;
    const controller = new AbortController(); request.current = controller;
    setWorking(true); setError(''); setResult(null); setStatus('Đang phân tích và đối chiếu báo giá…');
    try {
      const reply = await quotationAgentApi.assist(orderId, text, snapshot, controller.signal);
      if (controller.signal.aborted) return;
      const hasChanges = reply.updates.length || reply.inspectionNote !== undefined || reply.recommendation !== undefined;
      if (hasChanges && !onApply(reply)) {
        setError('Form đã thay đổi trong lúc AI xử lý. Chưa áp dụng kết quả cũ; bấm Điền vào báo giá để xử lý lại trên dữ liệu mới.');
      } else {
        setResult(reply);
        if (hasChanges) setInstruction('');
        setStatus(hasChanges ? 'Đã điền vào form. Kiểm tra các dòng trước khi lưu báo giá.' : reply.message);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(getErrorMessage(failure, 'Không thể xử lý báo giá. Form hiện tại được giữ nguyên.'));
    } finally { if (!controller.signal.aborted) setWorking(false); }
  };

  const record = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Trình duyệt chưa hỗ trợ ghi âm. Bạn vẫn có thể nhập mô tả báo giá.'); return;
    }
    const current = ++generation.current;
    setError(''); setWorking(true); setStatus('Đang xin quyền micro…');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      capture.onerror = () => {
        if (timer.current) clearTimeout(timer.current);
        capture.onstop = null;
        media.getTracks().forEach((track) => track.stop());
        if (current === generation.current) { setError('Không thể ghi âm. Vui lòng thử lại hoặc nhập mô tả.'); setRecording(false); setWorking(false); }
      };
      capture.onstop = async () => {
        if (timer.current) clearTimeout(timer.current);
        media.getTracks().forEach((track) => track.stop());
        if (current !== generation.current) return;
        setRecording(false); setWorking(true); setStatus('Đang chuyển giọng nói thành văn bản…');
        const controller = new AbortController(); request.current = controller;
        try {
          const wav = await quotationAudioToWav(new Blob(chunks, { type: capture.mimeType }));
          if (current !== generation.current) return;
          const transcript = await quotationAgentApi.transcribe(orderId, wav, controller.signal);
          if (controller.signal.aborted) return;
          setInstruction((previous) => `${previous.trim()}${previous.trim() ? '\n' : ''}${transcript}`.slice(0, 6000));
          setStatus('Đã nhận dạng giọng nói. Kiểm tra nội dung rồi bấm Điền vào báo giá.');
        } catch (failure) {
          if (!controller.signal.aborted && current === generation.current) setError(getErrorMessage(failure, 'Không thể nhận dạng giọng nói. Hãy ghi âm lại hoặc nhập mô tả.'));
        } finally { if (current === generation.current) setWorking(false); }
      };
      capture.start(); setRecording(true); setWorking(false); setStatus('Đang ghi âm, tối đa 90 giây. Bấm Dừng khi nói xong.');
      timer.current = setTimeout(() => { if (capture.state === 'recording') capture.stop(); }, 89_000);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      if (current === generation.current) { setWorking(false); setError('Không truy cập được micro. Hãy cấp quyền hoặc nhập mô tả báo giá.'); }
    }
  };

  const panel = <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-label="Giọng nói AI">
    <p className="font-semibold text-on-surface">Giọng nói AI</p>
    <p className="text-sm text-on-surface-variant">Ghi âm tên hạng mục, số lượng và đơn giá. Kiểm tra hoặc sửa nội dung nhận dạng trước khi điền vào báo giá.</p>
    <label className="block text-sm font-medium" htmlFor={`quotation-voice-${orderId}`}>Nội dung báo giá</label>
    <textarea id={`quotation-voice-${orderId}`} aria-label="Mô tả báo giá" value={instruction} maxLength={6000} rows={3}
      disabled={working || recording || disabled} onChange={(event) => { setInstruction(event.target.value); setResult(null); }}
      placeholder="Ví dụ: thay 2 tụ 35 µF, mỗi cái 180 nghìn, công thay 100 nghìn…"
      className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm" />
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={working || disabled} onClick={() => recording ? recorder.current?.stop() : void record()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 px-3 py-2 text-sm disabled:opacity-50">
        {recording ? <Square size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}{recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
      </button>
      <button type="button" disabled={working || recording || disabled || !instruction.trim()} onClick={() => void run()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm text-white disabled:opacity-50"><Sparkles size={16} aria-hidden="true" />Điền vào báo giá</button>
      {working && <button type="button" onClick={() => { generation.current++; request.current?.abort(); setWorking(false); setStatus('Đã dừng xử lý; form được giữ nguyên.'); }} className="px-3 text-sm text-error">Dừng xử lý</button>}
    </div>
    {status && <p role="status" className="text-sm">{status}</p>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {result && <div className="space-y-2 text-sm">
      <p>{result.message}</p>
      {result.warnings.map((warning) => <p key={warning} className="text-amber-800">{warning}</p>)}
      {result.sources.map((source) => <p key={source.id} className="text-xs text-on-surface-variant">Giá tham khảo: {source.title}, {source.unitPrice.toLocaleString('vi-VN')}đ — {new Date(source.usedAt).toLocaleDateString('vi-VN')}.</p>)}
      {result.choiceGroups?.map((group) => <div key={group.label}><p>{group.label}</p><div className="flex flex-wrap gap-2">{group.options.map((option) => <button key={option} type="button" disabled={working || disabled} className="rounded-xl border px-3 py-2 text-left"
        onClick={() => { const text = `${instruction}\n${group.label}: ${option}`; setInstruction(text); void run(text); }}>{option}</button>)}</div></div>)}
    </div>}
  </section>;

  if (open === undefined) return panel;
  const close = () => { if (!working && !recording) onClose?.(); };
  return <Modal open={open} title="Nhập báo giá bằng giọng nói AI" size="sm" onClose={close}
    closeOnEsc={!working && !recording} closeOnOverlayClick={!working && !recording}>
    {panel}
    <div className="mt-4 flex justify-end">
      <button type="button" disabled={working || recording} onClick={close} className="btn-secondary">Trở về báo giá</button>
    </div>
  </Modal>;
}
