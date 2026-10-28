interface EvidenceTime {
  occurredAt?: string | null;
  dateLabel?: string | null;
  time?: string | null;
}

// Ngày tương đối luôn neo vào lần tải ảnh, không đổi theo ngày admin mở hồ sơ.
export const resolveNoShowEvidenceTime = (event: EvidenceTime, uploadedAt?: Date | null): string | null => {
  const anchor = uploadedAt?.getTime();
  const absolute = event.occurredAt ? Date.parse(event.occurredAt) : NaN;
  const label = event.dateLabel?.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
  let resolved = absolute;
  if (label) {
    const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(event.time?.trim() ?? "");
    if (!clock) return null;
    const hour = Number(clock[1]);
    const minute = Number(clock[2]);
    const second = Number(clock[3] ?? 0);
    if (hour > 23 || minute > 59 || second > 59) return null;
    let year: number;
    let month: number;
    let day: number;
    if (["hom nay", "hom qua"].includes(label)) {
      if (!Number.isFinite(anchor)) return null;
      const local = new Date(anchor! + 7 * 3600_000);
      const target = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (label === "hom qua" ? 1 : 0)));
      year = target.getUTCFullYear(); month = target.getUTCMonth() + 1; day = target.getUTCDate();
    } else {
      const date = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(label);
      if (!date) return null;
      day = Number(date[1]); month = Number(date[2]); year = Number(date[3]);
      const check = new Date(Date.UTC(year, month - 1, day));
      if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    }
    resolved = Date.UTC(year, month - 1, day, hour, minute, second) - 7 * 3600_000;
    if (event.occurredAt && (!Number.isFinite(absolute) || Math.floor(absolute / 60_000) !== Math.floor(resolved / 60_000))) return null;
  }
  if (!Number.isFinite(resolved) || (Number.isFinite(anchor) && resolved > anchor!)) return null;
  return new Date(resolved).toISOString();
};
