// Chuẩn hóa bản ghi trình duyệt thành PCM mono 16 kHz, không cần thư viện chuyển mã.
export async function quotationAudioToWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration > 90.5 || decoded.duration < 0.2) throw new Error('Bản ghi cần dài từ 0,2 đến 90 giây.');
    const count = Math.min(Math.floor(decoded.duration * 16000), 90 * 16000);
    const buffer = new ArrayBuffer(44 + count * 2);
    const view = new DataView(buffer);
    const write = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, 'data'); view.setUint32(40, count * 2, true);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    for (let index = 0; index < count; index++) {
      const from = Math.floor(index * decoded.sampleRate / 16000);
      const to = Math.min(decoded.length, Math.max(from + 1, Math.floor((index + 1) * decoded.sampleRate / 16000)));
      let sum = 0;
      for (const channel of channels) for (let sample = from; sample < to; sample++) sum += channel[sample];
      const value = Math.max(-1, Math.min(1, sum / ((to - from) * channels.length)));
      view.setInt16(44 + index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  } finally { await context.close(); }
}
