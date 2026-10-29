export const currentDashboardMonth = (now = new Date()) => {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { fromDate: `${prefix}-01`, toDate: `${prefix}-${lastDay}` };
};
