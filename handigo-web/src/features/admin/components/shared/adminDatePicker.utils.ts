export interface DateWheelParts { year: number; month: number; day: number; hour: number; minute: number }
export type DateWheelPart = keyof DateWheelParts;
const pad = (value: number) => String(value).padStart(2, '0');

export const daysInMonth = (year: number, month: number) =>
  month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;

export const dateWheelValue = (parts: DateWheelParts, includeTime: boolean) => {
  const date = `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(Math.min(parts.day, daysInMonth(parts.year, parts.month)))}`;
  return includeTime ? `${date}T${pad(parts.hour)}:${pad(parts.minute)}` : date;
};

export const dateWheelParts = (value: string, now = new Date()): DateWheelParts => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (match) {
    const [, year, month, day, hour = '0', minute = '0'] = match;
    const parts = { year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: Number(minute) };
    if (parts.year >= 1 && parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= daysInMonth(parts.year, parts.month)
      && parts.hour <= 23 && parts.minute <= 59) return parts;
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() };
};

const boundary = (value: string | undefined, includeTime: boolean, upper = false) => {
  if (!value) return undefined;
  return includeTime ? value.length === 10 ? `${value}T${upper ? '23:59' : '00:00'}` : value.slice(0, 16) : value.slice(0, 10);
};

export const clampDateWheel = (value: string, includeTime: boolean, min?: string, max?: string) => {
  const lower = boundary(min, includeTime);
  const upper = boundary(max, includeTime, true);
  if (lower && value < lower) return lower;
  if (upper && value > upper) return upper;
  return value;
};

export const updateDateWheel = (value: string, part: DateWheelPart, next: number, includeTime: boolean, min?: string, max?: string) =>
  clampDateWheel(dateWheelValue({ ...dateWheelParts(value), [part]: next }, includeTime), includeTime, min, max);

export const dateWheelUnavailable = (value: string, part: DateWheelPart, next: number, includeTime: boolean, min?: string, max?: string) => {
  const parts = { ...dateWheelParts(value), [part]: next };
  const from = { ...parts };
  const to = { ...parts };
  if (part === 'year') { from.month = 1; to.month = 12; }
  if (part === 'year' || part === 'month') { from.day = 1; to.day = daysInMonth(to.year, to.month); }
  if (part !== 'hour' && part !== 'minute') { from.hour = 0; to.hour = 23; }
  if (part !== 'minute') { from.minute = 0; to.minute = 59; }
  const lower = boundary(min, includeTime);
  const upper = boundary(max, includeTime, true);
  return Boolean((lower && dateWheelValue(to, includeTime) < lower) || (upper && dateWheelValue(from, includeTime) > upper));
};

export const displayDateWheel = (value: string, includeTime: boolean) => {
  if (!value) return includeTime ? 'Chọn ngày và giờ' : 'Chọn ngày';
  const { year, month, day, hour, minute } = dateWheelParts(value);
  return `${pad(day)}/${pad(month)}/${year}${includeTime ? ` ${pad(hour)}:${pad(minute)}` : ''}`;
};
