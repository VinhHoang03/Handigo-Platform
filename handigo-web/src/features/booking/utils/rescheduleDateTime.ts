export const vietnamDateTimeValue = (timestamp: number) =>
  new Date(timestamp + 7 * 3_600_000).toISOString().slice(0, 16);

export const rescheduleTimestamp = (value: string) => Date.parse(`${value}:00+07:00`);

export const isRescheduleTimeAllowed = (value: string, earliest: number) => {
  const time = value.slice(11, 16);
  return (/^(?:0[89]|1\d|20):[0-5]\d$/.test(time) || time === '21:00')
    && rescheduleTimestamp(value) >= earliest;
};

export const firstRescheduleTime = (day: string, earliest: number) => {
  const start = Math.max(rescheduleTimestamp(`${day}T08:00`), Math.ceil(earliest / 60_000) * 60_000);
  const value = vietnamDateTimeValue(start);
  return value.slice(0, 10) === day && isRescheduleTimeAllowed(value, earliest) ? value : null;
};
