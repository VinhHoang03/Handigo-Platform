export const rewardNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
export const rewardMoney = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
export const rewardDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
