// Không dùng ngày không hợp lệ hoặc dữ liệu trước lần thực thi làm bằng chứng ghi thành công.
export function happenedAfter(value: Date | string | null | undefined, startedAt?: string) {
  const started = Date.parse(startedAt ?? "");
  const happened = value instanceof Date ? value.getTime() : Date.parse(value ?? "");
  return Number.isFinite(started) && Number.isFinite(happened) && happened >= started;
}
