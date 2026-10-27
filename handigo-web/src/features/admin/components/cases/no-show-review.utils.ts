import { caseDateTime } from "./case-table-columns";

export const formatNoShowDate = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? caseDateTime.format(new Date(value)) : "Chưa xác định";

export const getNoShowUserDescription = (description: string) => description
  .split(/\r?\nThợ xác nhận đã gọi hoặc nhắn tin nhưng không liên hệ được khách\./)[0].trim();
