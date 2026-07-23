import { FileWarning, Flag, Headphones, type LucideIcon } from "lucide-react";
import type { CreateCaseKind } from "./CreateCaseModal";

export type CaseTab = CreateCaseKind;

export const TAB_CONFIG: Array<{
  value: CaseTab;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "complaint",
    label: "Khiếu nại",
    description: "Khiếu nại đơn đã hoàn thành",
    icon: FileWarning,
  },
  {
    value: "ticket",
    label: "Hỗ trợ",
    description: "Trao đổi với bộ phận hỗ trợ",
    icon: Headphones,
  },
  {
    value: "report",
    label: "Báo cáo",
    description: "Báo cáo hành vi hoặc đơn dịch vụ",
    icon: Flag,
  },
];
